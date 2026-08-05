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

## Trips — SAHYOG-05, 06, 07, 28, 29, 30, 31, 32, 38, 39, 42

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
{ "trips": [ { "id": 1, "origin": "...", "destination": "...", "departure_time": "...", "total_seats": 12, "seats_available": 5, "purpose": "medical", "ai_summary": "...", "ai_high_demand": true } ] }
```
No filters matching → `{ "trips": [] }`, still 200 (empty state, not an error). `ai_summary` (SAHYOG-31) is a nullable one-sentence AI blurb, populated by a post-commit background task — `null` until it completes, if AI is off, or if the call failed; never an error. `ai_high_demand` (SAHYOG-42) is `true` once a trip's confirmed-seat fill ratio crosses `HIGH_DEMAND_THRESHOLD` (75%), otherwise `null`. Despite the `ai_` prefix this is **not an LLM call** — a fill-ratio threshold is arithmetic, not a semantic judgment — so it's always accurate and works identically with `AI_ENABLED=false`. Never un-flags once set.

### `GET /trips/mine`
Coordinator only. Added for SAHYOG-29 (`MyTrips.jsx` needs a list of the caller's own trips) — not present in the original SAHYOG-03 draft of this contract.

200: same shape as `GET /trips` (including `ai_summary`/`ai_high_demand`), ordered by `departure_time` descending. Only trips where `coordinator_id` is the caller. No trips → `{ "trips": [] }`, 200. `ai_high_demand` is what `MyTrips.jsx` uses to flag trips needing coordinator attention.

Errors: `FORBIDDEN_ROLE` (403, rider).

### `GET /trips/{id}`
Any authenticated user.

200:
```json
{
  "id": 1, "coordinator_id": 3, "origin": "...", "destination": "...", "departure_time": "...",
  "total_seats": 12, "purpose": "medical", "ai_summary": "...",
  "seats": [ { "id": 10, "seat_number": "1", "status": "available", "held_by_me": false } ],
  "bus_stops": [ { "id": 1, "name": "City Hospital (boarding)", "sequence": 0 } ],
  "current_stop_sequence": null
}
```
`status` is `"available" | "held" | "reserved"`. `held_by_me` is computed server-side from the caller's own holds — the frontend must never infer this from local state. `ai_summary` — see `GET /trips` above. `bus_stops`/`current_stop_sequence` (SAHYOG-46) — see the Bus stops section below; both are plain coordinator-entered data, not AI, and default to `[]`/`null` until a coordinator sets a route. Riders poll this same endpoint every 5s (SAHYOG-35) to get live position updates — no separate tracking endpoint.

Errors: `NOT_FOUND` (404).

### `GET /trips/{id}/passengers`
Coordinator only, own trip.

200:
```json
{
  "passengers": [
    { "reservation_id": 5, "rider_name": "Asha Rao", "seat_number": "1", "confirmed_at": "...",
      "ai_urgency_label": "high", "ai_accessibility_tags": "wheelchair",
      "passenger_name": "Asha Rao", "passenger_phone": "+91 98765 43210" }
  ],
  "digest": "8 of 12 seats filled; 2 riders flagged high-urgency (medical)."
}
```
Only `confirmed` reservations are listed. `ai_urgency_label` (SAHYOG-30) is `"low" | "medium" | "high" | null` — null whenever AI is off, the SAHYOG-25 triage call failed, or hasn't completed yet; never an error. `ai_accessibility_tags` (SAHYOG-40) is one of `"wheelchair" | "mobility_assistance" | "visual_impairment" | "hearing_impairment" | "elderly_support" | "child_support" | "other" | null` — despite the plural name it holds exactly one tag, classified from the rider's optional `POST /reservations` note; `null` under the same conditions as `ai_urgency_label`. `digest` (SAHYOG-32) is a one-sentence AI summary of the passenger mix, computed synchronously per request with the standard 5s timeout — `null` under the same conditions, endpoint still 200. `passenger_name`/`passenger_phone` (SAHYOG-43) are the rider-supplied contact details for this specific booking (see `POST /reservations`) — not AI-derived, plain text, `null` only for reservations confirmed before SAHYOG-43 shipped.

Errors: `FORBIDDEN_ROLE` (403, rider), `NOT_OWNER` (403, someone else's trip), `NOT_FOUND` (404).

### `POST /trips/{id}/seat-recommendation`
Rider only.

Request:
```json
{ "note": "I use a wheelchair" }
```

200:
```json
{ "seat_number": "1", "reason": "Row 1, aisle side - closest to the front for easy boarding.", "fallback": false }
```
`seat_number` (SAHYOG-38) is always re-validated server-side against the trip's *currently* available seats before being returned — an AI answer that isn't actually available right now (hallucination or race condition) is discarded, never trusted, and replaced with the lowest-numbered available seat, `fallback: true`. Same fallback whenever AI is off, unconfigured, or times out. No seats available → `{ "seat_number": null, "reason": null, "fallback": true }`. This is a suggestion only — the AI never calls `POST /holds` itself; the rider still has to click the seat.

Errors: `FORBIDDEN_ROLE` (403, coordinator), `NOT_FOUND` (404), `VALIDATION_ERROR` (422, empty note).

### `GET /trips/{id}/similar?limit=3`
Any authenticated user.

200:
```json
{ "trips": [ { "id": 4, "origin": "...", "destination": "...", "departure_time": "...", "total_seats": 12, "seats_available": 6, "purpose": "medical", "ai_summary": "..." } ], "fallback": false }
```
`trips` (SAHYOG-39) is ranked by pgvector `cosine_distance` on `trips.embedding` against the requested trip's own embedding (same `SEMANTIC_THRESHOLD` as `POST /ai/search`), excluding the trip itself. Adds **no new AI network call** — it only reads the `embedding` column SAHYOG-26 already populates. Falls back to a same-destination keyword match (`fallback: true`) when the trip's own embedding is `null`, or when nothing clears the threshold but a same-destination trip exists.

Errors: `NOT_FOUND` (404).

### Bus stops — SAHYOG-46
Coordinator-entered route + manually-set live position. No AI, no GPS/maps library, no coordinates — plain names and a plain integer index the coordinator sets by hand. Not scope creep on CLAUDE.md's "no maps" exclusion: there is no map, just an ordered list and a status the coordinator updates.

#### `PUT /trips/{id}/stops`
Coordinator only, own trip. Replaces the trip's entire route in one call (simplest shape for filling in a route, including placeholder/dummy stop names, rather than add/reorder/delete one at a time).

Request:
```json
{ "stop_names": ["City Hospital (boarding)", "Market Square", "Town Hall", "Railway Station (destination)"] }
```
`stop_names`: 1-20 entries, each 1-255 chars after trimming, none blank.

200:
```json
[ { "id": 1, "name": "City Hospital (boarding)", "sequence": 0 }, { "id": 2, "name": "Market Square", "sequence": 1 } ]
```
Replacing the route resets `current_stop_sequence` to `null` — the old index may no longer be valid against the new list.

Errors: `FORBIDDEN_ROLE` (403, rider), `NOT_OWNER` (403, someone else's trip), `NOT_FOUND` (404), `VALIDATION_ERROR` (422, empty list or a blank/too-long name).

#### `PATCH /trips/{id}/stops/current`
Coordinator only, own trip. Marks which stop the vehicle is at right now.

Request:
```json
{ "sequence": 1 }
```

200:
```json
{ "stops": [ { "id": 1, "name": "City Hospital (boarding)", "sequence": 0 } ], "current_stop_sequence": 1 }
```

Errors: `FORBIDDEN_ROLE` (403, rider), `NOT_OWNER` (403), `NOT_FOUND` (404), `VALIDATION_ERROR` (422, no stops configured yet, or `sequence` outside the route's range).

Riders see the current position via `GET /trips/{id}`'s `bus_stops`/`current_stop_sequence` fields, polled every 5s by `BusStopTracker.jsx` (shown on `Confirmation.jsx` and `MyReservations.jsx`) — no separate read endpoint.

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

## Reservations — SAHYOG-17, 20, 21, 40, 43

### `POST /reservations`
Rider only.

Request:
```json
{ "hold_id": 7, "notes": "I use a wheelchair", "passenger_name": "Asha Rao", "passenger_phone": "+91 98765 43210" }
```
`notes` (SAHYOG-40) is optional, max 500 chars, plain rider-supplied text — written directly in the same transaction as the reservation, no AI call involved. Classified into `ai_accessibility_tags` afterward (see `GET /trips/{id}/passengers`).

`passenger_name` and `passenger_phone` (SAHYOG-43) are **required**, plain rider-supplied text, not AI — the actual traveller may not be the account holder, so this is captured per-booking rather than reused from the account's `name`. `passenger_name`: 1-120 chars. `passenger_phone`: 7-20 chars, digits plus `+`, `-`, `(`, `)`, and spaces only, at least 7 digits — a loose format check, not carrier/region validation. Both are written in the same transaction as the reservation itself (same pattern as `accessibility_note`); no AI call involved, no extra write power granted anywhere.

201:
```json
{ "id": 5, "seat_id": 10, "trip_id": 1, "rider_id": 2, "status": "confirmed", "confirmed_at": "2026-07-11T05:05:00Z", "accessibility_note": "I use a wheelchair", "passenger_name": "Asha Rao", "passenger_phone": "+91 98765 43210" }
```
Errors: `HOLD_EXPIRED` (410), `NOT_OWNER` (403, someone else's hold), `NOT_FOUND` (404), `VALIDATION_ERROR` (422, missing/blank `passenger_name` or `passenger_phone` that doesn't look like a phone number).

### `GET /reservations/me`
Rider only. Own reservations, confirmed and cancelled.

200:
```json
{
  "reservations": [
    { "id": 5, "trip_id": 1, "seat_number": "1", "status": "confirmed", "confirmed_at": "...", "cancelled_at": null,
      "trip_origin": "City Hospital", "trip_destination": "Railway Station", "departure_time": "..." }
  ]
}
```
`trip_origin`/`trip_destination`/`departure_time` (SAHYOG-34) let the frontend render the trip name and a status timeline without a second request per reservation.

### `POST /reservations/{id}/cancel`
Rider only, own reservation.

200:
```json
{ "id": 5, "status": "cancelled", "cancelled_at": "2026-07-11T06:00:00Z" }
```
Cancelling an already-cancelled reservation is a no-op: returns 200 with the existing cancelled state, not an error. Errors: `NOT_OWNER` (403), `NOT_FOUND` (404).

## AI — SAHYOG-25, 26, 27, 45

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

### `GET /ai/search?q=...`
Any authenticated user. Same underlying service as `POST /ai/search` above (same 200-always/fallback behaviour) — a query-param GET alias for clients that expect one. `AssistantBox.jsx` uses the POST form; this exists alongside it, not instead of it.

Reservation urgency triage (SAHYOG-25) and trip embeddings (SAHYOG-26) run as background tasks after commit and have no dedicated endpoint; their output surfaces as the nullable `ai_urgency_label`/`ai_urgency_score` fields on reservations once exposed, and via `POST /ai/search`'s semantic ranking, respectively.

### `POST /ai/assistant`
Any authenticated user (rider or coordinator). Powers `HelpAssistant.jsx`, the floating help widget shown on every page. Answers general how-does-this-app-work questions only — it has no database access and is never given any specific trip/reservation/account data, so it cannot look anything up even if asked to.

Request:
```json
{ "question": "How do I cancel my booking?" }
```

**200 always**, same fallback contract as `POST /ai/search`:
```json
{ "answer": "Go to 'My reservations' and tap 'Cancel' on the booking - this frees the seat immediately for another rider.", "fallback": true }
```
`fallback: false` means the AI answered (grounded in a fixed FAQ context, instructed to ignore any instructions embedded in the question itself — the prompt-injection defence for this endpoint, since it's the one AI surface that takes truly free-form user text). `fallback: true` means AI was off/unconfigured/failed and a deterministic FAQ keyword match answered instead (or a generic pointer to "My reservations"/"My trips" if nothing matched) — never an error, never a 5xx.

Errors: `UNAUTHENTICATED` (401), `VALIDATION_ERROR` (422, blank question).
