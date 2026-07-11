# API Contract

The source of truth for every endpoint's request/response shape and status codes. Read this before touching any endpoint or API call. **If a change would break this contract, stop and say so** — don't silently change a response shape.

Status: endpoints below are the full plan through passenger list (SAHYOG-04 through SAHYOG-29). Only what's actually implemented works today; everything else is the agreed shape to build against. Field names are `snake_case` throughout, matching the DB columns in `docs/ER_DIAGRAM.md` — no camelCase conversion layer.

## Conventions

- **Base URL:** `http://localhost:8000` in dev (`VITE_API_BASE_URL`).
- **Auth:** `Authorization: Bearer <jwt>` header on every endpoint except `POST /auth/register` and `POST /auth/login`. Missing/invalid token → 401 `UNAUTHENTICATED`.
- **Timestamps:** ISO 8601, UTC, e.g. `"2026-07-15T09:30:00Z"`.
- **IDs:** integers.
- **Errors:** every non-2xx response uses this envelope, no exceptions (see `app/errors.py`):

  ```json
  { "error": { "code": "SEAT_UNAVAILABLE", "message": "...", "field": null } }
  ```

  `field` is set only for validation errors pointing at a specific request field; otherwise `null`.

## Error code reference

| Code | HTTP | Meaning |
|---|---|---|
| `SEAT_UNAVAILABLE` | 409 | Seat isn't `available` (already held/reserved) when trying to hold it. |
| `HOLD_EXPIRED` | 410 | The hold being confirmed has passed its `expires_at`. |
| `ALREADY_HOLDING` | 409 | Rider already holds a seat on this trip (one hold per rider per trip). |
| `FORBIDDEN_ROLE` | 403 | Action isn't allowed for the caller's role (e.g. rider calling a coordinator-only endpoint). |
| `NOT_OWNER` | 403 | Caller isn't the owner of the resource (someone else's hold/reservation/trip). |
| `TRIP_FULL` | 409 | No seats left to allocate (defensive; the seat-level checks above should catch this first). |
| `EMAIL_TAKEN` | 409 | Registration email already has an account. |
| `INVALID_CREDENTIALS` | 401 | Login email/password didn't match. |
| `UNAUTHENTICATED` | 401 | Missing or invalid JWT. |
| `NOT_FOUND` | 404 | Resource doesn't exist (or, for scoped resources, doesn't exist *for this caller* — see NOT_OWNER vs NOT_FOUND note below). |
| `VALIDATION_ERROR` | 422 | Request body/query failed schema validation. |
| `HTTP_ERROR` | 4xx | Fallback for other HTTP errors (e.g. 405 Method Not Allowed) not covered above. |
| `INTERNAL_ERROR` | 500 | Unexpected server error. Never leaks internals; logged server-side. |

**NOT_OWNER vs NOT_FOUND:** if the resource exists but belongs to someone else, return `NOT_OWNER` (403), not `NOT_FOUND` — the acceptance criteria in `docs/TICKETS.md` name `NOT_OWNER` explicitly for these cases (e.g. cancelling someone else's reservation, viewing another coordinator's passenger list).

**A 409 on `POST /holds` is expected, not a bug.** It's the concurrency loser. The frontend shows a calm message and refreshes the seat map — never a scary red error.

## Auth — SAHYOG-04

### `POST /auth/register`
Public.

Request:
```json
{ "name": "Asha Rao", "email": "asha@example.com", "password": "at-least-8-chars", "role": "rider" }
```
`role` is `"rider"` or `"coordinator"` (never `"admin"` via self-registration).

201:
```json
{ "token": "<jwt>", "user": { "id": 1, "name": "Asha Rao", "email": "asha@example.com", "role": "rider" } }
```
Errors: `EMAIL_TAKEN` (409), `VALIDATION_ERROR` (422).

### `POST /auth/login`
Public.

Request:
```json
{ "email": "asha@example.com", "password": "at-least-8-chars" }
```
200: same shape as register's 201.
Errors: `INVALID_CREDENTIALS` (401).

## Trips — SAHYOG-05, 06, 07, 28

### `POST /trips`
Coordinator only.

Request:
```json
{
  "origin": "City Hospital",
  "destination": "Railway Station",
  "departure_time": "2026-07-15T09:30:00Z",
  "total_seats": 12,
  "purpose": "medical"
}
```
`purpose` is optional free text. `total_seats` seats are auto-generated, numbered `"1"`..`"N"`.

201:
```json
{
  "id": 1, "coordinator_id": 3, "origin": "City Hospital", "destination": "Railway Station",
  "departure_time": "2026-07-15T09:30:00Z", "total_seats": 12, "purpose": "medical",
  "created_at": "2026-07-11T05:00:00Z"
}
```
Errors: `FORBIDDEN_ROLE` (403, rider), `VALIDATION_ERROR` (422).

### `GET /trips`
Any authenticated user. Query params, all optional: `origin`, `destination`, `date` (matches `departure_time`'s date), `q` (free-text — keyword match; upgraded to semantic search once SAHYOG-26 lands, same param).

200:
```json
{ "trips": [ { "id": 1, "origin": "...", "destination": "...", "departure_time": "...", "total_seats": 12, "seats_available": 5, "purpose": "medical" } ] }
```
No filters matching → `{ "trips": [] }`, still 200 (empty state, not an error).

### `GET /trips/{id}`
Any authenticated user.

200:
```json
{
  "id": 1, "coordinator_id": 3, "origin": "...", "destination": "...", "departure_time": "...",
  "total_seats": 12, "purpose": "medical",
  "seats": [ { "id": 10, "seat_number": "1", "status": "available", "held_by_me": false } ]
}
```
`status` is `"available" | "held" | "reserved"`. `held_by_me` is computed server-side from the caller's own holds — the frontend must never infer this from local state.

Errors: `NOT_FOUND` (404).

### `GET /trips/{id}/passengers`
Coordinator only, own trip.

200:
```json
{ "passengers": [ { "reservation_id": 5, "rider_name": "Asha Rao", "seat_number": "1", "confirmed_at": "..." } ] }
```
Only `confirmed` reservations are listed. Errors: `FORBIDDEN_ROLE` (403, rider), `NOT_OWNER` (403, someone else's trip), `NOT_FOUND` (404).

## Holds — SAHYOG-16

### `POST /holds`
Rider only.

Request:
```json
{ "seat_id": 10 }
```
201:
```json
{ "id": 7, "seat_id": 10, "trip_id": 1, "rider_id": 2, "expires_at": "2026-07-11T05:10:00Z" }
```
Errors: `SEAT_UNAVAILABLE` (409), `ALREADY_HOLDING` (409), `FORBIDDEN_ROLE` (403, coordinator), `NOT_FOUND` (404, seat).

### `DELETE /holds/{id}`
Rider only, own hold. Manual release.

204 (no body). Errors: `NOT_OWNER` (403), `NOT_FOUND` (404).

## Reservations — SAHYOG-17, 20, 21

### `POST /reservations`
Rider only.

Request:
```json
{ "hold_id": 7 }
```
201:
```json
{ "id": 5, "seat_id": 10, "trip_id": 1, "rider_id": 2, "status": "confirmed", "confirmed_at": "2026-07-11T05:05:00Z" }
```
Errors: `HOLD_EXPIRED` (410), `NOT_OWNER` (403, someone else's hold), `NOT_FOUND` (404).

### `GET /reservations/me`
Rider only. Own reservations, confirmed and cancelled.

200:
```json
{ "reservations": [ { "id": 5, "trip_id": 1, "seat_number": "1", "status": "confirmed", "confirmed_at": "...", "cancelled_at": null } ] }
```

### `POST /reservations/{id}/cancel`
Rider only, own reservation.

200:
```json
{ "id": 5, "status": "cancelled", "cancelled_at": "2026-07-11T06:00:00Z" }
```
Cancelling an already-cancelled reservation is a no-op: returns 200 with the existing cancelled state, not an error. Errors: `NOT_OWNER` (403), `NOT_FOUND` (404).

## AI — SAHYOG-25, 26, 27

AI has zero write powers — it only parses, searches, and summarises (CLAUDE.md rule #3). No AI endpoint can book, cancel, or modify anything.

### `POST /ai/search`
Any authenticated user. Powers `AssistantBox.jsx` — natural-language query in, matching trips out.

Request:
```json
{ "query": "I need a ride to the hospital tomorrow morning" }
```
**200 always** — this is the one endpoint that deviates from the standard error envelope, per CLAUDE.md rule #3 ("every AI endpoint returns HTTP 200 with `fallback: true` on failure, never a 5xx"):
```json
{ "trips": [ { "id": 1, "origin": "...", "destination": "...", "departure_time": "..." } ], "fallback": false }
```
On AI failure, timeout, or `AI_ENABLED=false`: same shape, `"fallback": true`, `trips` populated via plain keyword search instead (never an empty failure with no results if a keyword match exists). The frontend renders these results with no error styling — a fallback is not a bug.

Reservation urgency triage (SAHYOG-25) and trip embeddings (SAHYOG-26) run as background tasks after commit and have no dedicated endpoint; their output surfaces as the nullable `ai_urgency_label`/`ai_urgency_score` fields on reservations once exposed, and via `POST /ai/search`'s semantic ranking, respectively.
