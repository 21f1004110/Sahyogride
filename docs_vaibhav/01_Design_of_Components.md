# SahyogRide — Design of Components

Status: reflects the codebase as of **13 July 2026** (commit `6738686`). Components marked
**(planned)** have page/file stubs in the repo but are not yet wired into routing or the API —
they belong to tickets later in `docs/TICKETS.md` (SAHYOG-17, 20, 21, 28, 29).

---

## 1. High-level architecture

```
┌─────────────────────────┐        HTTPS / JSON        ┌──────────────────────────┐
│   Frontend (React+Vite) │ ─────────────────────────▶ │   Backend (FastAPI)      │
│   localhost:5173        │ ◀───────────────────────── │   localhost:8000         │
└─────────────────────────┘                             └───────────┬──────────────┘
                                                                      │ SQLAlchemy 2.0
                                                                      ▼
                                                          ┌──────────────────────────┐
                                                          │ PostgreSQL 15 + pgvector │
                                                          └──────────────────────────┘

Backend calls out to a hosted LLM API ONLY from app/services/ai_service.py,
and ONLY after a DB transaction has committed (never inside a lock).
```

The system is a conventional 3-tier web app. The one architectural rule that shapes every
component boundary is **CLAUDE.md rule #2**: AI calls are isolated to a single service module
and are never made inside a database transaction.

---

## 2. Backend components

### 2.1 Routers (`backend/app/routers/`) — HTTP boundary only

Routers validate the request (via Pydantic schemas), call exactly one service function, and
translate the result/exception into an HTTP response. No business logic lives here.

| Router | Prefix | Endpoints (implemented) | Endpoints (planned) |
|---|---|---|---|
| `auth.py` | `/auth` | `POST /register`, `POST /login` | — |
| `trips.py` | `/trips` | `POST /trips`, `GET /trips`, `GET /trips/{id}` | `GET /trips/{id}/passengers` (SAHYOG-28) |
| `holds.py` | `/holds` | `POST /holds`, `DELETE /holds/{id}` | — |
| `reservations.py` | `/reservations` | — (router registered, no routes yet) | `POST /reservations`, `POST /reservations/{id}/cancel`, `GET /reservations/me` (SAHYOG-17, 20, 21) |
| `ai.py` | `/ai` | — (router registered, no routes yet) | semantic search endpoint (SAHYOG-26/27) |

### 2.2 Services (`backend/app/services/`) — business logic

| Service | Responsibility | Key functions |
|---|---|---|
| `auth_service.py` | Password hashing, JWT issuance/verification, user registration/login | `hash_password`, `verify_password`, `create_access_token`, `decode_access_token`, `register_user`, `authenticate_user` |
| `trip_service.py` | Trip CRUD, search, seat-map assembly | `create_trip`, `search_trips`, `get_trip_detail` |
| `booking.py` | 🔥 **The core.** Seat hold, release, confirm, expiry — the only place that touches seat concurrency | `hold_seat` (row-locked), `release_hold` — `confirm_reservation` and expiry sweep are planned (SAHYOG-17/18) |
| `ai_service.py` | The **only** file in the codebase that imports an AI library. Triage, embeddings, semantic search. Every function: 5s timeout, returns `None` on any failure, short-circuits immediately when `AI_ENABLED=false` | planned (SAHYOG-23–27) |

**Why this split matters:** `booking.py` contains zero AI calls and zero HTTP concerns — it is
the one file whose correctness the two star tests (`test_concurrency.py`,
`test_ai_fallback.py`) depend on. Keeping it isolated from `ai_service.py` is what makes rule #2
enforceable by inspection.

### 2.3 Cross-cutting backend components

| Component | File | Purpose |
|---|---|---|
| `models.py` | SQLAlchemy ORM | `User`, `Trip`, `Seat`, `Hold`, `Reservation` — see Class Diagram (`02_Class_Diagram.svg`) |
| `schemas.py` | Pydantic v2 | Request/response contracts — no raw dicts cross the router boundary |
| `deps.py` | FastAPI dependencies | `get_db`, `get_current_user`, role-guard dependency (403 `FORBIDDEN_ROLE`) |
| `errors.py` | Exception handling | Standard error envelope `{ "error": { "code", "message", "field" } }`, registered as a global exception handler in `main.py` |
| `config.py` | Settings | Loads all env vars from CLAUDE.md's Environment section |
| `database.py` | Engine/session | SQLAlchemy `Base`, session factory |

---

## 3. Frontend components (`frontend/src/`)

### 3.1 Pages (`pages/`) — one per route

| Page | Route | Status |
|---|---|---|
| `Landing.jsx` | `/` (unauthenticated) | ✅ live |
| `Dashboard.jsx` | `/` (authenticated) | ✅ live |
| `Login.jsx` / `Register.jsx` | `/login`, `/register` | ✅ live |
| `SearchTrips.jsx` | `/trips` | ✅ live |
| `TripDetail.jsx` | `/trips/:id` | ✅ live (read-only seat map + hold flow) |
| `CreateTrip.jsx` | `/trips/new` (coordinator-only) | ✅ live |
| `Confirmation.jsx` | *(planned route)* | file exists, not routed — SAHYOG-17 |
| `MyReservations.jsx` | *(planned route)* | file exists, not routed — SAHYOG-21 |
| `MyTrips.jsx` | *(planned route)* | file exists, not routed — SAHYOG-29 |
| `PassengerList.jsx` | *(planned route)* | file exists, not routed — SAHYOG-29 |

### 3.2 Reusable components (`components/`)

| Component | Purpose |
|---|---|
| `Layout.jsx` | Shared shell (nav, auth-aware header) wrapping every authenticated page |
| `SeatMap.jsx` / `Seat.jsx` | Renders the seat grid; each `Seat` is ≥44×44px, has an `aria-label`, and conveys status via icon **and** colour (never colour alone) |
| `HoldCountdown.jsx` | Live countdown of the 5-minute hold TTL |
| `AssistantBox.jsx` | *(planned, SAHYOG-27)* read-only natural-language search box — cannot book/cancel, only calls the search endpoint |
| `states/Loading.jsx`, `states/Empty.jsx`, `states/ErrorState.jsx` | Shared loading/empty/error UI so every data screen handles all three states |
| `BackgroundBlobs.jsx`, `HeroIllustration.jsx`, `ScrollRouteRail.jsx`, `Avatar.jsx` | Visual/marketing components used on the landing page and layout chrome |

### 3.3 Data & state layer

| Component | Purpose |
|---|---|
| `api/client.js` | axios instance, base URL from `VITE_API_BASE_URL`, attaches JWT |
| `api/auth.js`, `api/trips.js`, `api/holds.js`, `api/booking.js`, `api/ai.js` | One module per backend router — thin wrappers, no logic |
| `context/AuthContext.jsx` | Holds the logged-in user + JWT; gates `RequireAuth`/`RequireCoordinator` routes in `App.jsx` |
| TanStack Query | All server state (trips, seats, reservations) — never duplicated into local `useState` |

---

## 4. Request flow — seat hold (the critical path)

```
Seat.jsx (click)
   │  onHold(seatId)
   ▼
api/holds.js  POST /holds { seat_id }
   │
   ▼
routers/holds.py  create_hold_endpoint()
   │  validates request, gets current rider from JWT
   ▼
services/booking.py  hold_seat(db, seat_id, rider_id)
   │  SELECT ... FOR UPDATE on the seat row   ← layer 1
   │  INSERT INTO holds (UNIQUE(seat_id))     ← layer 2
   ▼
201 Created + HoldOut          OR          409 SEAT_UNAVAILABLE / ALREADY_HOLDING
   │                                             │
   ▼                                             ▼
HoldCountdown starts                  Seat.jsx shows a calm message,
                                       refreshes the seat map (no red error)
```

No AI call appears anywhere on this path — see CLAUDE.md rule #2.

---

## 5. Component-level acceptance mapping

This mirrors the ticket phases in `docs/TICKETS.md`; use it to see which component a given
ticket touches:

| Phase | Backend components | Frontend components |
|---|---|---|
| 0 — Foundation | `models.py`, `database.py`, `errors.py`, `config.py`, Alembic | project scaffold |
| 1 — Auth & Trips | `auth.py`+`auth_service.py`, `trips.py`+`trip_service.py` | `AuthContext`, `Login`/`Register`, `CreateTrip`, `SearchTrips`, `TripDetail`, `SeatMap`/`Seat` |
| 2 — Core booking | `holds.py`, `reservations.py`, `booking.py` | `HoldCountdown`, hold click-flow in `Seat.jsx` |
| 3 — Cancellation & history | `reservations.py` (cancel + list) | `MyReservations.jsx` |
| 4 — AI features | `ai.py`, `ai_service.py` | `AssistantBox.jsx` |
| 5 — Passenger list | `trips.py` (`/passengers`) | `MyTrips.jsx`, `PassengerList.jsx` |
