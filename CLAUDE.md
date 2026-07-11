# CLAUDE.md

Project context for Claude Code. Read this before any task.

---

## Project

**SahyogRide** — a community shuttle booking platform. NGOs/hospitals publish **free** shuttle trips for essential travel (medical, exams, work); people in need reserve limited seats.

Non-commercial. There is **no payment**. The product's value is *fair, error-free allocation of scarce free seats*.

**Deadline: 22 July 2026.** This is a university software-engineering project built by a 5-person team in 11 days. Prefer working, simple, well-tested code over clever or exhaustive code.

---

## 🔴 The three rules that matter most

### 1. Never break the concurrency core
The heart of this project is that **a seat can never be double-booked**, even when two riders click the same seat at the same millisecond.

This is guaranteed by three layers. Do not weaken any of them:
1. `SELECT ... FOR UPDATE` row lock in `hold_seat()`
2. `UNIQUE(seat_id)` constraint on the `holds` table
3. Partial unique index: `UNIQUE(seat_id) WHERE status='confirmed'` on `reservations`

Never replace seat rows with a seats-remaining counter. Never do check-then-write without a lock. The naive version is:
```python
# ❌ NEVER. Both requests read "available" and both write. Double-booked.
seat = db.query(Seat).filter(Seat.id == seat_id).first()
if seat.status == "available":
    seat.status = "held"
```

### 2. Never put an AI call inside a database transaction
A 3-second LLM call inside a `FOR UPDATE` lock holds that seat locked for 3 seconds and destroys the entire point of the project.

- AI triage fires **after** the reservation commits (background task).
- Trip embeddings are generated **after** the trip commits (background task).
- `hold_seat()` and `confirm_reservation()` contain **zero** AI calls.

### 3. The app must work completely with AI switched off
Set `AI_ENABLED=false` and every core flow (register → search → hold → confirm → cancel) must still work.

- All AI calls live in `app/services/ai_service.py`. Nothing else imports an AI library.
- Every AI call has a **5-second timeout** and returns `None` on failure — it never raises.
- Every AI endpoint returns **HTTP 200 with `fallback: true`** on failure, never a 5xx.
- All `ai_*` DB columns and `trips.embedding` are **nullable** by design.
- Every LLM response is **schema-validated** before use. Never trust raw LLM output.
- The AI has **zero write powers** — it parses, searches, and summarises. It can never book, cancel, or modify. This is our prompt-injection defence.

---

## Stack

| | |
|---|---|
| Backend | FastAPI (Python 3.11+), SQLAlchemy 2.0, Alembic, Pydantic v2 |
| DB | PostgreSQL 15+ with **pgvector** |
| Frontend | React 18 + Vite, Tailwind, TanStack Query, axios, react-router-dom |
| Auth | JWT (`python-jose`) + bcrypt |
| Tests | pytest + httpx (backend) |
| Deploy | Render (API + Postgres), Vercel (frontend) |

---

## Repo layout

```
/backend
  app/
    main.py config.py database.py models.py schemas.py deps.py errors.py
    routers/     auth.py trips.py holds.py reservations.py ai.py
    services/    booking.py      ← 🔥 the core: hold, confirm, expiry
                 ai_service.py   ← 🤖 ALL AI calls, isolated here
  tests/         test_concurrency.py  ← the star test
                 test_ai_fallback.py  ← proves app works with AI off
  alembic/ seed.py backfill_embeddings.py

/frontend
  src/
    api/         client.js auth.js trips.js booking.js ai.js
    components/  SeatMap.jsx Seat.jsx HoldCountdown.jsx AssistantBox.jsx
                 states/  (Loading, Empty, ErrorState)
    pages/       SearchTrips TripDetail Confirmation MyReservations
                 CreateTrip MyTrips PassengerList
    context/     AuthContext.jsx

/docs
  API_CONTRACT.md   ← the source of truth. Read before any endpoint work.
  ER_DIAGRAM.md     ← schema + reference SQL
  BACKEND.md  FRONTEND.md
  AI_PROMPT_SPEC.md
```

---

## Before you code

**Always read `/docs/API_CONTRACT.md` first** when touching any endpoint or API call. It is the agreed contract between backend and frontend. Request/response shapes, status codes, and error codes must match it **exactly**.

**If a change would break the contract, stop and say so.** Do not silently change a response shape — it breaks the other developer.

---

## Domain model (essentials)

- **Roles:** `rider` | `coordinator` (+ `admin`). Riders search/hold/reserve/cancel. Coordinators create trips and view their own passenger lists.
- **Seat lifecycle:** `available → held → reserved`, plus `held → available` (5-min expiry or manual release) and `reserved → available` (cancellation).
- **Seats are rows**, auto-generated on trip creation (`total_seats` of them, numbered "1"…"N").
- **Holds** are short-lived (5 min TTL, `HOLD_TTL_MINUTES`). One hold per seat; one hold per rider per trip.
- **Invariant that must never break:** confirmed reservations for a trip ≤ `trips.total_seats`.

---

## Error handling

Every backend error returns this envelope:
```json
{ "error": { "code": "SEAT_UNAVAILABLE", "message": "...", "field": null } }
```

Key codes: `SEAT_UNAVAILABLE` (409), `HOLD_EXPIRED` (410), `ALREADY_HOLDING` (409), `FORBIDDEN_ROLE` (403), `NOT_OWNER` (403), `TRIP_FULL` (409).

**A 409 on the hold endpoint is expected, not a bug.** It's the concurrency loser. The frontend shows a calm message ("That seat was just taken — please pick another") and refreshes the seat map. **Never render a 409 as a scary red error.**

---

## Ticket workflow

Work is tracked as `SAHYOG-##` tickets. When I give you a ticket:

1. Read the ticket's acceptance criteria and the relevant section of `/docs/API_CONTRACT.md`.
2. Implement it — nothing more. **Do not build features from other tickets.** Scope discipline is critical; we have 11 days.
3. Write the tests the ticket asks for.
4. Confirm each acceptance criterion is met, explicitly.
5. Branch naming: `feat/SAHYOG-16-seat-hold`, `fix/SAHYOG-22-history-empty-state`.
6. Commits: `feat(SAHYOG-16): add row-level locking to seat hold`.

**Ticket priority order (never reorder):**
Core booking (SAHYOG-15/16/17/18/19) > auth & trips > cancellation & history > AI features > passenger list.

If asked to build an AI feature while the core is incomplete, **say so and push back.**

---

## Scope — do not build these

❌ Payment / payment gateway (the shuttles are free)
❌ Waitlist · QR passes · analytics dashboard · SMS/email · maps · admin panel
❌ Native mobile app · i18n
❌ Microservices, message queues, Redis, Docker Compose stacks, Kubernetes
❌ Training/fine-tuning any model — we call a hosted API and nothing more

If a task seems to need one of these, **stop and ask.** It's almost certainly scope creep.

---

## Code conventions

**Backend**
- Business logic goes in `services/`, not in routers. Routers validate, call a service, return.
- Pydantic schemas for all requests/responses. No raw dicts crossing the boundary.
- Type hints everywhere.
- Datetimes are **timezone-aware UTC** (`datetime.now(timezone.utc)`). Never naive.
- Never log or commit `AI_API_KEY`.

**Frontend**
- Every data screen handles **three states: loading, empty, error.** A blank page is a bug.
- Server state → TanStack Query. Local UI state → `useState`. Don't duplicate server state.
- `held_by_me` comes **from the API** — never infer "my seat" from local state.
- Accessibility matters: our users may be elderly or low-vision. Seats ≥ 44×44px, `aria-label` on every seat, **never colour alone** (every seat state also has an icon).
- Test at 375px width. Many riders are on phones.

---

## Commands

```bash
# Backend
cd backend && source venv/bin/activate
uvicorn app.main:app --reload           # → http://localhost:8000/docs
alembic upgrade head
python seed.py
python backfill_embeddings.py           # 🤖 needed for semantic search demo
pytest
pytest tests/test_concurrency.py -v     # 🔥 the star test

# Frontend
cd frontend
npm run dev                             # → http://localhost:5173
npm run build
```

---

## Environment

```env
DATABASE_URL=postgresql://user:pass@localhost:5432/sahyogride
JWT_SECRET=...
HOLD_TTL_MINUTES=5

# AI — the app MUST work with these unset/false
AI_ENABLED=true
AI_API_KEY=
AI_TIMEOUT_SECONDS=5
SEMANTIC_THRESHOLD=0.5
```

---

## Testing expectations

Two tests carry the project's credibility. Never let a change break them:

1. **`test_two_riders_one_seat_only_one_wins`** — two simultaneous holds on the same seat: exactly one gets 201, one gets 409. Run 50 iterations, zero failures.
2. **`test_app_works_completely_with_ai_disabled`** — with `AI_ENABLED=false`, register → search → hold → confirm → cancel all succeed.

Also: capacity is never exceeded under concurrent load; expired holds free their seat; cancellation frees the seat; double-confirm is rejected.

---

## How to work with me

- Be direct. If my approach is wrong or risks the concurrency core, **say so plainly** rather than implementing it.
- Prefer the simplest thing that satisfies the acceptance criteria. We have 11 days, not 8 weeks.
- Don't add abstractions, config layers, or "future-proofing" we didn't ask for.
- If a ticket's acceptance criteria are ambiguous, ask rather than guess.
- When done, state which acceptance criteria are met and which (if any) aren't.
