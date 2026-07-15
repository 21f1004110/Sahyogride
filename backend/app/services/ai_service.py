# The ONLY file in this codebase that imports an AI library - CLAUDE.md
# rule #3 (AI has zero write powers and total call isolation). Every public
# function here returns None on ANY failure - AI disabled, no API key,
# timeout, network error, malformed response - and NEVER raises. Callers
# always have a safe fallback path; a failed AI call is not a bug.
#
# AI_ENABLED=false short-circuits every function in _get_client() before
# any network call is attempted. See docs/AI_PROMPT_SPEC.md for the
# prompt and response schema behind each public function here.

import concurrent.futures
import json
import logging
from typing import Callable, Literal, TypeVar

from openai import OpenAI
from pydantic import BaseModel, Field

from app.config import settings

logger = logging.getLogger(__name__)

T = TypeVar("T")

_executor = concurrent.futures.ThreadPoolExecutor(max_workers=4, thread_name_prefix="ai-call")
_client: OpenAI | None = None
_client_checked = False


def _get_client() -> OpenAI | None:
    """None whenever AI shouldn't be called at all - disabled, or no key
    configured - so callers short-circuit before any network attempt.
    """
    global _client, _client_checked
    if not settings.ai_enabled or not settings.ai_api_key:
        return None
    if not _client_checked:
        _client = OpenAI(api_key=settings.ai_api_key)
        _client_checked = True
    return _client


def _run_with_timeout(fn: Callable[[], T]) -> T | None:
    """Runs fn in a worker thread and enforces AI_TIMEOUT_SECONDS. Returns
    None on timeout, a malformed/unvalidatable response, or any other
    exception - this is the single safety envelope every public function
    below goes through, so none of them can ever raise.
    """
    future = _executor.submit(fn)
    try:
        return future.result(timeout=settings.ai_timeout_seconds)
    except Exception:
        logger.warning("AI call failed or timed out", exc_info=True)
        return None


class ReservationTriageResult(BaseModel):
    urgency_label: Literal["low", "medium", "high"]
    urgency_score: float = Field(ge=0, le=1)


def triage_reservation_urgency(purpose: str | None) -> ReservationTriageResult | None:
    """Read-only judgement of how urgent a reservation looks, from the
    trip's stated purpose alone. Cannot book, cancel, or modify anything -
    see docs/AI_PROMPT_SPEC.md for the exact prompt and schema.
    """
    client = _get_client()
    if client is None or not purpose:
        return None

    def _call() -> ReservationTriageResult:
        response = client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[
                {
                    "role": "system",
                    "content": (
                        "You triage how urgent a free community shuttle reservation is, "
                        "based only on its stated purpose. Reply with JSON only, no prose: "
                        '{"urgency_label": "low"|"medium"|"high", "urgency_score": <0..1>}. '
                        "Medical, dialysis, and exam purposes are typically high urgency; "
                        "unspecified or general/errand purposes are low."
                    ),
                },
                {"role": "user", "content": purpose},
            ],
            response_format={"type": "json_object"},
            timeout=settings.ai_timeout_seconds,
        )
        raw = json.loads(response.choices[0].message.content)
        return ReservationTriageResult.model_validate(raw)

    return _run_with_timeout(_call)


EMBEDDING_MODEL = "text-embedding-3-small"


def embed_text(text: str) -> list[float] | None:
    """Embedding for a trip (SAHYOG-26, background task after trip commit)
    or a search query (SAHYOG-27, AssistantBox). Dimension must match
    EMBEDDING_DIM in models.py (1536).
    """
    client = _get_client()
    if client is None or not text:
        return None

    def _call() -> list[float]:
        response = client.embeddings.create(
            model=EMBEDDING_MODEL,
            input=text,
            timeout=settings.ai_timeout_seconds,
        )
        return response.data[0].embedding

    return _run_with_timeout(_call)
