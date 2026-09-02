# Orchestrates AI seat suggestion (SAHYOG-38): synchronous, read-only -
# this is a pure GET-shaped request/response, never inside hold_seat()/
# confirm_reservation()'s locked transaction, and it never calls either.
# The AI's suggested seat_number is always re-validated against the
# *current* available seats before being trusted - CLAUDE.md rule #3,
# never trust raw LLM output.

from sqlalchemy.orm import Session

from app.errors import AppError
from app.models import SeatStatus, Trip
from app.schemas import SeatRecommendationResponse
from app.services import ai_service

# Mirrors SeatMap.jsx's SEATS_PER_ROW (2 seats | aisle | 2 seats) so the
# row/side described to the AI matches what the rider actually sees.
SEATS_PER_ROW = 4


def _describe_position(seat_number: str) -> dict:
    idx = int(seat_number) - 1
    row = idx // SEATS_PER_ROW + 1
    col = idx % SEATS_PER_ROW
    side = "left" if col < SEATS_PER_ROW / 2 else "right"
    edge = "window" if col in (0, SEATS_PER_ROW - 1) else "aisle"
    return {"seat_number": seat_number, "row": row, "side": side, "edge": edge}


# Deterministic, keyword-driven fallback used whenever the real AI is
# unavailable (off, unconfigured, timed out, or hallucinated an
# unavailable seat) - this is the path that actually runs in this
# project's environment (no AI_API_KEY configured), so it needs to be
# genuinely useful on its own, not just "pick seat 1". Checked in order;
# first match wins. Each entry: (keywords, preferred edge, row preference, reason).
# row preference is "front" (closest to row 1), "back" (furthest row), or
# None (row doesn't matter - only the edge, if any, is honored).
_PREFERENCE_RULES: list[tuple[list[str], str | None, str | None, str]] = [
    (
        ["wheelchair", "walker", "crutch", "mobility"],
        "aisle",
        "front",
        "An aisle seat near the front, for easier wheelchair/mobility access and boarding.",
    ),
    (
        ["pregnant", "pregnancy"],
        "aisle",
        "front",
        "An aisle seat near the front, for easier and quicker access on and off.",
    ),
    (
        ["elderly", "senior citizen", "senior", "old age", "grandmother", "grandfather", "grandma", "grandpa"],
        "aisle",
        "front",
        "An aisle seat near the front, so there's less distance and no climbing over anyone.",
    ),
    (
        ["motion sickness", "car sick", "carsick", "nausea", "nauseous", "travel sickness"],
        None,
        "front",
        "A front-row seat, where the ride is smoothest and motion is felt least.",
    ),
    (
        ["toddler", "child", "kid", "infant", "baby"],
        "window",
        None,
        "A window seat, to keep a child settled and safely away from the aisle.",
    ),
    (
        ["back row", "sit at the back", "rear seat", "back of the bus", "last row", "quiet seat", "quieter"],
        None,
        "back",
        "A back-row seat, as requested - furthest from the door and the driver.",
    ),
    (
        ["aisle seat", "aisle", "leg room", "legroom", "stretch my legs"],
        "aisle",
        None,
        "An aisle seat, as requested, with easy access to get up.",
    ),
    (
        ["window seat", "by the window", "near the window", "window"],
        "window",
        None,
        "A window seat, as requested.",
    ),
]


def _infer_preference(note: str) -> tuple[str | None, str | None, str | None]:
    """Returns (preferred_edge, row_preference, reason) for the first
    matching rule, or (None, None, None) if the note matches nothing
    specific - callers fall back to nearest-available in that case.
    """
    lowered = note.lower()
    for keywords, edge, row_pref, reason in _PREFERENCE_RULES:
        if any(keyword in lowered for keyword in keywords):
            return edge, row_pref, reason
    return None, None, None


def _fallback_pick(available: list, note: str) -> tuple[str, str]:
    """Picks the best available seat for the note's inferred preference
    (edge + row), falling back to the plain nearest-available seat when
    nothing in the note matches a known need."""
    edge, row_pref, reason = _infer_preference(note)

    def sort_key(seat):
        pos = _describe_position(seat.seat_number)
        edge_penalty = 0 if edge is None or pos["edge"] == edge else 1
        if row_pref == "back":
            row_key = -pos["row"]
        elif row_pref == "front" or edge is not None:
            row_key = pos["row"]
        else:
            row_key = 0
        return (edge_penalty, row_key, int(seat.seat_number))

    best = min(available, key=sort_key)
    if reason is None:
        reason = "Nearest available seat (AI suggestion unavailable)."
    return best.seat_number, reason


def recommend_seat(db: Session, trip_id: int, note: str) -> SeatRecommendationResponse:
    trip = db.get(Trip, trip_id)
    if trip is None:
        raise AppError("NOT_FOUND")

    available = [s for s in trip.seats if s.status == SeatStatus.AVAILABLE]
    if not available:
        return SeatRecommendationResponse(seat_number=None, reason=None, fallback=True)

    positions = [_describe_position(s.seat_number) for s in available]
    result = ai_service.recommend_seat(note, positions)

    valid_numbers = {s.seat_number for s in available}
    if result is not None and result.seat_number in valid_numbers:
        return SeatRecommendationResponse(seat_number=result.seat_number, reason=result.reason, fallback=False)

    # AI off, timed out, or picked a seat_number that isn't actually
    # available right now (race condition or hallucination) - treated
    # identically, never retried or remapped. The fallback still reads
    # the rider's note for known needs (wheelchair, window, motion
    # sickness, travelling with a child, ...) instead of blindly
    # returning the lowest-numbered seat, so the endpoint stays useful
    # even with AI completely unavailable.
    seat_number, reason = _fallback_pick(available, note)
    return SeatRecommendationResponse(seat_number=seat_number, reason=reason, fallback=True)
