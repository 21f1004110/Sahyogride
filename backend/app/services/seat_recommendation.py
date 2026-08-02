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
    # identically, never retried or remapped. Deterministic fallback so
    # the endpoint always returns a usable seat when one exists.
    fallback_seat = min(available, key=lambda s: int(s.seat_number))
    return SeatRecommendationResponse(
        seat_number=fallback_seat.seat_number,
        reason="Nearest available seat (AI suggestion unavailable).",
        fallback=True,
    )
