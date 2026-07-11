# SahyogRide — Ticket Backlog

29 tickets, sized for a 5-person team over 11 days, one commit per ticket. Order below is **build order** (each ticket only depends on earlier ones). This is not the same as the **priority-for-cutting-scope order** in CLAUDE.md — if the deadline forces a cut, drop from the bottom up: passenger list → AI → cancellation/history → auth/trips, but **never** cut core booking (SAHYOG-15–19).

Each ticket: branch name, commit message, acceptance criteria. Read `/docs/API_CONTRACT.md` before starting any ticket that touches an endpoint (create it in SAHYOG-03 and keep it updated as the contract changes).

---

## Phase 0 — Foundation

### SAHYOG-01 — Repo scaffolding
`feat/SAHYOG-01-scaffolding` · `feat(SAHYOG-01): scaffold backend and frontend project structure`

- [ ] `/backend` FastAPI app boots (`uvicorn app.main:app --reload`) and serves `/docs`
- [ ] `/frontend` Vite + React 18 + Tailwind app boots (`npm run dev`)
- [ ] Folder layout matches CLAUDE.md exactly (routers/, services/, components/, pages/, context/)
- [ ] `.env.example` for both, matching the Environment section of CLAUDE.md
- [ ] Empty stub files for `/docs/API_CONTRACT.md`, `ER_DIAGRAM.md`, `BACKEND.md`, `FRONTEND.md`, `AI_PROMPT_SPEC.md`
- [ ] `requirements.txt` / `package.json` pinned with stack from CLAUDE.md

### SAHYOG-02 — Database schema & migrations
`feat/SAHYOG-02-db-schema` · `feat(SAHYOG-02): add core data models and initial migration`

- [ ] `models.py`: `User`, `Trip`, `Seat`, `Hold`, `Reservation` (SQLAlchemy 2.0)
- [ ] `UNIQUE(seat_id)` on `holds`; partial unique index `UNIQUE(seat_id) WHERE status='confirmed'` on `reservations`
- [ ] All `ai_*` columns and `trips.embedding` nullable
- [ ] All datetimes timezone-aware UTC
- [ ] Alembic initialized, first migration applies cleanly (`alembic upgrade head`)
- [ ] `ER_DIAGRAM.md` filled in with schema + the reference SQL for the two constraints above
- [ ] `seed.py` creates a demo coordinator, rider, and one trip with seats

### SAHYOG-03 — API contract & error envelope
`feat/SAHYOG-03-api-contract` · `feat(SAHYOG-03): define API contract and shared error handling`

- [ ] `/docs/API_CONTRACT.md` written: every endpoint planned through passenger list, with request/response shapes and status codes
- [ ] `errors.py`: standard envelope `{ "error": { "code", "message", "field" } }`
- [ ] Exception handler registered in `main.py`; codes from CLAUDE.md (`SEAT_UNAVAILABLE`, `HOLD_EXPIRED`, `ALREADY_HOLDING`, `FORBIDDEN_ROLE`, `NOT_OWNER`, `TRIP_FULL`) return the right HTTP status
- [ ] `config.py` loads all env vars from CLAUDE.md's Environment section with sane defaults

---

## Phase 1 — Auth & Trips

### SAHYOG-04 — Register & login
`feat/SAHYOG-04-auth` · `feat(SAHYOG-04): add JWT auth with register and login`

- [ ] `POST /auth/register`, `POST /auth/login` per API contract
- [ ] bcrypt password hashing, `python-jose` JWT issuance
- [ ] Role stored (`rider` | `coordinator`)
- [ ] `deps.py`: `get_current_user`, role-guard dependency (403 `FORBIDDEN_ROLE`)
- [ ] Frontend: `api/auth.js`, `context/AuthContext.jsx`, login/register forms
- [ ] Invalid credentials return proper error envelope, not a raw 500

### SAHYOG-05 — Coordinator: create trip
`feat/SAHYOG-05-create-trip` · `feat(SAHYOG-05): allow coordinators to create trips with seats`

- [ ] `POST /trips` — coordinator-only (403 for riders)
- [ ] Auto-generates `total_seats` `Seat` rows numbered "1"…"N"
- [ ] `pages/CreateTrip.jsx` — form with validation, loading/error states
- [ ] Rider attempting this endpoint gets `FORBIDDEN_ROLE`

### SAHYOG-06 — Rider: search trips
`feat/SAHYOG-06-search-trips` · `feat(SAHYOG-06): add trip search for riders`

- [ ] `GET /trips` with filters per API contract (e.g. date, origin/destination text match — no maps)
- [ ] `pages/SearchTrips.jsx` — loading, empty, and error states (no blank page)
- [ ] Mobile layout verified at 375px width

### SAHYOG-07 — Trip detail & seat map (read-only)
`feat/SAHYOG-07-trip-detail` · `feat(SAHYOG-07): add trip detail page with read-only seat map`

- [ ] `GET /trips/{id}` returns trip + seat statuses (`available`/`held`/`reserved`)
- [ ] `components/SeatMap.jsx`, `components/Seat.jsx` — ≥44×44px, `aria-label` per seat, status conveyed by icon **and** colour, not colour alone
- [ ] `pages/TripDetail.jsx` — no hold/click behavior yet, that's SAHYOG-16
- [ ] Loading/empty/error states present

---

## Phase 2 — Core booking (🔥 the star — never weaken these)

### SAHYOG-15 — `hold_seat()` service with row locking
`feat/SAHYOG-15-hold-seat-service` · `feat(SAHYOG-15): add concurrency-safe hold_seat service`

- [ ] `services/booking.py`: `hold_seat(seat_id, rider_id)` using `SELECT ... FOR UPDATE`
- [ ] Relies on `UNIQUE(seat_id)` on `holds` as the second layer — no counter-based availability logic anywhere
- [ ] One hold per rider per trip enforced
- [ ] Zero AI calls in this function
- [ ] Unit tests for the happy path (not yet the concurrency stress test — that's SAHYOG-19)

### SAHYOG-16 — Hold endpoint + frontend hold flow
`feat/SAHYOG-16-seat-hold` · `feat(SAHYOG-16): add seat hold endpoint and hold UI`

- [ ] `POST /holds` per API contract; calls `hold_seat()`, never duplicates its logic in the router
- [ ] Returns 409 `SEAT_UNAVAILABLE` / `ALREADY_HOLDING` on conflict — routed through the standard envelope
- [ ] Frontend: clicking an available seat calls the endpoint; a losing 409 shows a calm message ("That seat was just taken — please pick another one") and refreshes the seat map — **never a scary red error**
- [ ] `components/HoldCountdown.jsx` shows the 5-minute TTL counting down
- [ ] `held_by_me` is read from the API response, never inferred from local state

### SAHYOG-17 — Confirm reservation
`feat/SAHYOG-17-confirm-reservation` · `feat(SAHYOG-17): add confirm_reservation with partial unique index`

- [ ] `services/booking.py`: `confirm_reservation(hold_id)` — zero AI calls
- [ ] Relies on the partial unique index `UNIQUE(seat_id) WHERE status='confirmed'` from SAHYOG-02 as the third layer
- [ ] `POST /reservations` per API contract; double-confirm is rejected (409)
- [ ] `pages/Confirmation.jsx`
- [ ] Confirming after hold expiry returns 410 `HOLD_EXPIRED`

### SAHYOG-18 — Hold expiry
`feat/SAHYOG-18-hold-expiry` · `feat(SAHYOG-18): release expired holds back to available`

- [ ] Expired holds (> `HOLD_TTL_MINUTES`) transition `held → available` automatically
- [ ] Implemented as a lightweight in-process background task — no new infra (no Redis/queues, per CLAUDE.md scope rules)
- [ ] A seat whose hold just expired can be immediately re-held by another rider
- [ ] Test: expired hold frees the seat

### SAHYOG-19 — Concurrency test suite (the star test)
`feat/SAHYOG-19-concurrency-tests` · `test(SAHYOG-19): add concurrency stress tests for seat holds`

- [ ] `tests/test_concurrency.py`
- [ ] `test_two_riders_one_seat_only_one_wins`: simultaneous holds on the same seat → exactly one 201, one 409, run 50 iterations, zero failures
- [ ] Capacity invariant test: confirmed reservations for a trip never exceed `trips.total_seats` under concurrent load
- [ ] Expired-hold-frees-seat and cancel-frees-seat covered here or cross-referenced from SAHYOG-18/20
- [ ] This test must pass before any later ticket is considered mergeable — treat a regression here as a blocker, not a nit

---

## Phase 3 — Cancellation & history

### SAHYOG-20 — Cancel reservation
`feat/SAHYOG-20-cancel-reservation` · `feat(SAHYOG-20): allow riders to cancel their reservation`

- [ ] `POST /reservations/{id}/cancel` — `NOT_OWNER` (403) if it isn't the caller's reservation
- [ ] Seat transitions `reserved → available` immediately
- [ ] Cancelling an already-cancelled reservation is a no-op or clear error, not a crash
- [ ] Frontend cancel button on `MyReservations`/`Confirmation`

### SAHYOG-21 — Reservation history page
`feat/SAHYOG-21-my-reservations` · `feat(SAHYOG-21): add reservation history page`

- [ ] `GET /reservations/me` (or per contract) — rider's past and upcoming reservations
- [ ] `pages/MyReservations.jsx` using TanStack Query for server state

### SAHYOG-22 — History empty/error states
`fix/SAHYOG-22-history-empty-state` · `fix(SAHYOG-22): add empty and error states to reservation history`

- [ ] New rider with zero reservations sees a friendly empty state, not a blank page
- [ ] Network/API failure on this page shows a retry-capable error state
- [ ] Verified at 375px width

---

## Phase 4 — AI features (only after Phases 0–3 are solid)

> If core booking, auth/trips, or cancellation/history are incomplete, **stop and say so** — do not start here. AI is explicitly last-priority in CLAUDE.md.

### SAHYOG-23 — AI service skeleton & kill switch
`feat/SAHYOG-23-ai-service-skeleton` · `feat(SAHYOG-23): add isolated ai_service with timeout and fallback`

- [ ] `services/ai_service.py` is the **only** file importing an AI library
- [ ] Every function has a 5-second timeout (`AI_TIMEOUT_SECONDS`) and returns `None` on any failure — never raises
- [ ] `AI_ENABLED=false` short-circuits every function to `None` immediately, no network call attempted
- [ ] All AI DB columns already nullable (from SAHYOG-02) — no migration needed here

### SAHYOG-24 — AI-disabled regression test (second star test)
`test/SAHYOG-24-ai-fallback-test` · `test(SAHYOG-24): prove app works fully with AI disabled`

- [ ] `tests/test_ai_fallback.py`: `test_app_works_completely_with_ai_disabled`
- [ ] With `AI_ENABLED=false`: register → search → hold → confirm → cancel all succeed end-to-end
- [ ] This test must pass before any further AI ticket is merged

### SAHYOG-25 — AI triage on reservation (post-commit, background)
`feat/SAHYOG-25-ai-triage` · `feat(SAHYOG-25): add background AI urgency triage after reservation commit`

- [ ] Fires **after** the reservation transaction commits, as a background task — never inside `hold_seat()`/`confirm_reservation()`
- [ ] LLM response schema-validated (Pydantic) before being written anywhere; invalid/timeout → column stays null, endpoint still returns 200
- [ ] AI has no write powers beyond its own `ai_*` columns — cannot touch seats/holds/reservations
- [ ] Works with `AI_ENABLED=false` (verified by re-running SAHYOG-24's test)

### SAHYOG-26 — Trip embeddings & semantic search
`feat/SAHYOG-26-trip-embeddings` · `feat(SAHYOG-26): add trip embeddings and semantic search fallback`

- [ ] Embeddings generated **after** trip commit, background task, using pgvector column from SAHYOG-02
- [ ] `backfill_embeddings.py` for existing trips
- [ ] Semantic search endpoint respects `SEMANTIC_THRESHOLD`; falls back to plain keyword search (SAHYOG-06) when AI is off or the call fails
- [ ] `AI_PROMPT_SPEC.md` documents the prompt/schema used

### SAHYOG-27 — Assistant search UI
`feat/SAHYOG-27-assistant-box` · `feat(SAHYOG-27): add read-only AI assistant search box`

- [ ] `components/AssistantBox.jsx` — natural-language query in, matching trips out
- [ ] Read-only: cannot book, cancel, or modify anything — it only calls the search endpoint
- [ ] On AI failure, UI shows normal search results (`fallback: true`) with no error styling, since a fallback is not a bug

---

## Phase 5 — Passenger list (coordinator, lowest priority)

### SAHYOG-28 — Passenger list endpoint
`feat/SAHYOG-28-passenger-list-api` · `feat(SAHYOG-28): add coordinator passenger list endpoint`

- [ ] `GET /trips/{id}/passengers` — coordinator-only, `NOT_OWNER` (403) if the trip isn't theirs
- [ ] Returns confirmed reservations only (not held/expired)

### SAHYOG-29 — Passenger list & my-trips UI
`feat/SAHYOG-29-passenger-list-ui` · `feat(SAHYOG-29): add MyTrips and PassengerList pages`

- [ ] `pages/MyTrips.jsx` — coordinator's own trips
- [ ] `pages/PassengerList.jsx` — loading/empty/error states
- [ ] Verified at 375px width

---

## Notes for whoever picks up a ticket

- One ticket = one branch = one commit (squash if you iterate locally). Don't bundle two tickets in one PR.
- If a ticket's acceptance criteria are ambiguous, ask before guessing — see CLAUDE.md.
- Any endpoint whose shape doesn't match `/docs/API_CONTRACT.md` is a stop-and-flag situation, not a silent fix.
- SAHYOG-15 through SAHYOG-19 and SAHYOG-24 are the two tests that carry this project's credibility. A PR that makes either flaky is not mergeable regardless of what else it does.
