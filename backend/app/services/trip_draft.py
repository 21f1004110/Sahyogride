# Turns a coordinator's one-sentence description of a trip into a
# structured draft that prefills the Create Trip form - the reverse
# direction of ai_search.py (there: natural language IN, matching trips
# OUT; here: natural language IN, a blank trip form OUT). Stateless -
# doesn't touch the database at all, so there's no transaction to worry
# about and nothing here can create a trip itself - CLAUDE.md rule #3,
# the coordinator always reviews and submits the form themselves.

import re
from datetime import date

from app.schemas import TripDraftResponse
from app.services import ai_service
from app.services.query_understanding import parse_query

# Deterministic fallback pieces, used whenever AI is off/unconfigured/
# times out - reuses query_understanding.py for date/time-of-day/purpose
# (same parsing ai_search.py already relies on) and adds two small
# regexes of its own for what that module doesn't cover: an explicit
# "from X to Y" route and a seat count.
_FROM_TO_PATTERN = re.compile(
    r"from\s+(?P<origin>.+?)\s+to\s+(?P<destination>.+?)"
    r"(?:\s+(?:this|next|today|tomorrow|on|at|for)\b|[,.]|$)",
    re.IGNORECASE,
)
_SEATS_PATTERN = re.compile(r"\b(\d{1,3})\s*seats?\b", re.IGNORECASE)

# A representative clock time for a matched time-of-day window - a
# starting point the coordinator adjusts in one click, not a claim of
# precision.
_TIME_OF_DAY_CLOCK = {"morning": "09:00", "afternoon": "14:00", "evening": "18:00", "night": "21:00"}


def _fallback_draft(description: str) -> TripDraftResponse:
    parsed = parse_query(description)

    origin = destination = None
    match = _FROM_TO_PATTERN.search(description)
    if match:
        origin = match.group("origin").strip(" ,.") or None
        destination = match.group("destination").strip(" ,.") or None

    seats_match = _SEATS_PATTERN.search(description)
    total_seats = int(seats_match.group(1)) if seats_match else None

    return TripDraftResponse(
        origin=origin,
        destination=destination,
        departure_date=parsed["travel_date"].isoformat() if parsed["travel_date"] else None,
        departure_time=_TIME_OF_DAY_CLOCK.get(parsed["time_of_day"]),
        purpose=parsed["purpose"],
        total_seats=total_seats,
        fallback=True,
    )


def parse_trip_draft(description: str) -> TripDraftResponse:
    result = ai_service.parse_trip_description(description, today=date.today().isoformat())
    if result is not None:
        return TripDraftResponse(
            origin=result.origin,
            destination=result.destination,
            departure_date=result.departure_date,
            departure_time=result.departure_time,
            purpose=result.purpose,
            total_seats=result.total_seats,
            fallback=False,
        )
    return _fallback_draft(description)
