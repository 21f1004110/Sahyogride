# AI Prompt Spec

Prompts and response schemas for every AI call, filled in starting SAHYOG-23. Every schema here must be validated before use per CLAUDE.md rule #3.

All calls live in `app/services/ai_service.py` and share one safety envelope (`_run_with_timeout`):

- `AI_ENABLED=false` or a missing `AI_API_KEY` short-circuits to `None` before any network call.
- Every call is bounded by `AI_TIMEOUT_SECONDS` (default 5s).
- Any failure — timeout, network error, malformed JSON, schema validation failure — returns `None`. No public function in `ai_service.py` ever raises.
- Model: `gpt-4o-mini` (OpenAI). Embeddings (SAHYOG-26): `text-embedding-3-small`, 1536 dimensions, matching `EMBEDDING_DIM` in `models.py`.

## Reservation urgency triage — SAHYOG-25

`triage_reservation_urgency(purpose: str | None) -> ReservationTriageResult | None`

Read-only. Fires as a background task **after** `confirm_reservation()` commits — never inside the booking transaction (CLAUDE.md rule #2). Populates `reservations.ai_urgency_label` / `ai_urgency_score`, both nullable, both left `null` on any failure.

**System prompt:**
```
You triage how urgent a free community shuttle reservation is, based only
on its stated purpose. Reply with JSON only, no prose:
{"urgency_label": "low"|"medium"|"high", "urgency_score": <0..1>}.
Medical, dialysis, and exam purposes are typically high urgency;
unspecified or general/errand purposes are low.
```

**User message:** the trip's `purpose` field, verbatim.

**Response schema** (`ReservationTriageResult`):
```python
class ReservationTriageResult(BaseModel):
    urgency_label: Literal["low", "medium", "high"]
    urgency_score: float = Field(ge=0, le=1)
```

## Trip embeddings & semantic search — SAHYOG-26

`embed_text(text: str) -> list[float] | None` (`ai_service.py`), model `text-embedding-3-small`, 1536 dimensions matching `EMBEDDING_DIM`/`trips.embedding` in `models.py`.

**Embedding input** (`trip_embedding.embedding_text_for`): `f"{origin} to {destination}"`, plus `f": {purpose}"` when a purpose is set. Fires as a background task **after** `create_trip()` commits (`app/services/trip_embedding.py`) — never inside the trip-creation transaction. `backfill_embeddings.py` runs the same embedding for any existing trip where `embedding IS NULL` (safe to re-run).

**`POST /ai/search`** (`app/services/ai_search.py`): embeds the query, then ranks trips by pgvector `cosine_distance` and keeps only those within `SEMANTIC_THRESHOLD` (`distance <= 1 - SEMANTIC_THRESHOLD`, since cosine distance = 1 − cosine similarity). Whenever `embed_text()` returns `None` — AI off, unconfigured, or the call fails — falls back to the plain keyword search from SAHYOG-06 and sets `"fallback": true`. A successful search that simply finds nothing above the threshold returns `"fallback": false` with an empty `trips` list; `fallback` means "AI didn't run," not "AI found nothing."

## Trip summary blurb — SAHYOG-31

`summarize_trip(origin: str, destination: str, purpose: str | None) -> str | None`

Read-only. Fires as a background task **after** `create_trip()` commits, in the same task as the embedding above (`app/services/trip_embedding.py`) — never inside the trip-creation transaction. Populates `trips.ai_summary`, nullable, left `null` on any failure.

**System prompt:**
```
You write a single short, warm, rider-facing sentence (max 160
characters) describing a free community shuttle trip, given its
origin, destination, and optional purpose. Reply with JSON only,
no prose: {"summary": "<sentence>"}. No exclamation points, no
emoji, no invented details beyond what's given.
```

**User message:** `f"Origin: {origin}\nDestination: {destination}\nPurpose: {purpose or 'unspecified'}"`

**Response schema** (`TripSummaryResult`):
```python
class TripSummaryResult(BaseModel):
    summary: str = Field(min_length=1, max_length=200)
```

## Passenger-mix digest — SAHYOG-32

`summarize_passenger_mix(total_seats: int, confirmed_count: int, urgency_counts: dict[str, int]) -> str | None`

Read-only, cannot alter any booking/reservation state. Called **synchronously** from `GET /trips/{id}/passengers` (`app/services/trip_service.get_passenger_digest`) — this is a read endpoint, not `hold_seat()`/`confirm_reservation()`, so a sync call under the standard timeout is fine, same precedent as `POST /ai/search`. Not stored; recomputed every request. `null` whenever AI is off/unconfigured, the call fails, or there are zero confirmed passengers.

**System prompt:**
```
You write a single short sentence (max 200 characters) summarising
how full a free community shuttle trip is and how many confirmed
riders were flagged high/medium/low urgency, for a coordinator
skimming a passenger list. Reply with JSON only, no prose:
{"digest": "<sentence>"}.
```

**User message:** `f"Total seats: {total_seats}\nConfirmed: {confirmed_count}\nUrgency counts: {json.dumps(urgency_counts)}"`

**Response schema** (`PassengerMixDigestResult`):
```python
class PassengerMixDigestResult(BaseModel):
    digest: str = Field(min_length=1, max_length=240)
```

## Seat recommendation — SAHYOG-38

`recommend_seat(note: str, available_seats: list[dict]) -> SeatRecommendationResult | None`

Read-only, zero write power. Called **synchronously** from `POST /trips/{id}/seat-recommendation` (`app/services/seat_recommendation.py`) — a read/suggest endpoint, not `hold_seat()`/`confirm_reservation()`. The caller re-validates the returned `seat_number` against the trip's *currently* available seats before trusting it — an invalid/hallucinated/now-unavailable value is discarded and replaced with a deterministic fallback (lowest-numbered available seat), never retried or coerced. `available_seats` items are `{"seat_number", "row", "side", "edge"}`, derived purely from `seat_number` via `SEATS_PER_ROW = 4` (mirrors `SeatMap.jsx`'s row/aisle layout) — no new seat metadata column.

**System prompt:**
```
You suggest ONE specific seat for a rider on a free community
shuttle, based on their short note and the list of currently
available seats (each with a row number - row 1 is nearest the
driver/front - and a window/aisle side). Reply with JSON only, no
prose: {"seat_number": "<one of the given seat_numbers, exactly>",
"reason": "<one short sentence>"}. You must pick seat_number from
the provided list only - never invent one.
```

**User message:** `json.dumps({"note": note, "available_seats": available_seats})`

**Response schema** (`SeatRecommendationResult`):
```python
class SeatRecommendationResult(BaseModel):
    seat_number: str
    reason: str = Field(min_length=1, max_length=200)
```

## Similar trips — SAHYOG-39

No new prompt, no new AI call. `GET /trips/{id}/similar` (`app/services/similar_trips.py`) reuses the `trips.embedding` column SAHYOG-26 already populates, ranking other trips by pgvector `cosine_distance` against the requested trip's own embedding — the exact same math as `POST /ai/search`, just trip-to-trip instead of query-to-trip. This entry exists so the absence of a prompt here doesn't look like an oversight.

## Accessibility note classification — SAHYOG-40

`classify_accessibility_note(note: str | None) -> AccessibilityTagResult | None`

Read-only, zero write power. Fires inside the existing `run_reservation_triage` background task (`app/services/reservation_triage.py`), **after** `confirm_reservation()` commits — never inside the booking transaction. The rider's `accessibility_note` itself is plain user input written directly in that transaction (no AI involved); only the classification into `ai_accessibility_tags` happens here, afterward. Populates `reservations.ai_accessibility_tags`, nullable, left `null` on any failure or when no note was given.

**System prompt:**
```
You classify a free-text accessibility note from a community
shuttle rider into exactly one tag. Reply with JSON only, no
prose: {"tag": "wheelchair"|"mobility_assistance"|
"visual_impairment"|"hearing_impairment"|"elderly_support"|
"child_support"|"other"}. Pick the single closest tag; use
"other" if the note does not clearly match any specific category.
```

**User message:** the rider's `accessibility_note`, verbatim.

**Response schema** (`AccessibilityTagResult`):
```python
class AccessibilityTagResult(BaseModel):
    tag: Literal[
        "wheelchair", "mobility_assistance", "visual_impairment",
        "hearing_impairment", "elderly_support", "child_support", "other",
    ]
```

## Trip high-demand flag — SAHYOG-42

No new prompt, no new AI call. `trips.ai_high_demand` (checked in `app/services/reservation_triage._check_high_demand`, alongside the urgency/accessibility checks above, same background task) is set from a plain fill-ratio threshold — `confirmed_reservations / total_seats >= HIGH_DEMAND_THRESHOLD` (0.75) — not an LLM judgment. This entry exists so the `ai_` prefix on the column doesn't look like an undocumented AI call: it's namespaced with the other post-commit triage fields because it's computed in the same background task, not because it's AI-derived. It is always accurate and never affected by `AI_ENABLED`.
