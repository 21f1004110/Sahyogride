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
