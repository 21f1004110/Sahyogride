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

Not yet implemented. Will embed `f"{origin} to {destination}: {purpose}"` via `text-embedding-3-small` as a background task after a trip commits, populating `trips.embedding` (nullable `Vector(1536)`). `POST /ai/search` will rank by cosine similarity above `SEMANTIC_THRESHOLD`, falling back to the plain keyword search from SAHYOG-06 when AI is off or the call fails.
