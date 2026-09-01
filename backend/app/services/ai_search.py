# Orchestrates AI semantic search: embeds the query, ranks trips by
# cosine distance, and falls back to a synonym-aware, scored keyword
# search whenever AI is off or the embedding call fails - never an
# empty failure with no results if a keyword match exists
# (API_CONTRACT.md). Read-only: this module can only ever return trips,
# never book, cancel, or modify anything - CLAUDE.md rule #3.
#
# Both paths run the query through query_understanding.parse_query()
# first (plain keyword/date parsing, not a model call) so the frontend
# can always show what the search understood, and both paths return a
# match_score + match_reason per trip - this is what makes the keyword
# fallback feel like more than a blind substring match: it bridges
# "I need to see a doctor" to a trip whose purpose is just "medical",
# and explains *why* each result was picked.

from sqlalchemy import or_
from sqlalchemy.orm import Session

from app.config import settings
from app.models import Trip
from app.schemas import AISearchResponse, AISearchTripItem, ParsedQuery
from app.services import ai_service
from app.services.query_understanding import TIME_OF_DAY_WINDOWS, _in_time_window, parse_query
from app.services.trip_service import _search_tokens, _seats_available_subquery, search_trips

MAX_AI_SEARCH_RESULTS = 12


def _score_and_reason(trip: Trip, query_lower: str, tokens: list[str], parsed: dict) -> tuple[float, str]:
    origin_l = trip.origin.lower()
    dest_l = trip.destination.lower()
    purpose_l = (trip.purpose or "").lower()

    score = 0.0
    reasons: list[str] = []

    if query_lower in origin_l or query_lower in dest_l or (purpose_l and query_lower in purpose_l):
        score += 0.45
        reasons.append("matches your request closely")

    token_hits = [t for t in tokens if t in origin_l or t in dest_l or t in purpose_l]
    if token_hits:
        score += min(0.3, 0.1 * len(token_hits))
        shown = ", ".join(dict.fromkeys(token_hits[:3]))  # de-dupe, keep order
        reasons.append(f"mentions {shown}")

    if parsed["purpose"] and parsed["purpose"] in purpose_l:
        score += 0.3
        # Skip the redundant-sounding reason when the purpose word itself
        # was already the token hit shown above (e.g. query "medical trip").
        if parsed["purpose"] not in token_hits:
            reasons.append(f"a {parsed['purpose']} trip")

    if parsed["travel_date"] and trip.departure_time.date() == parsed["travel_date"]:
        score += 0.3
        reasons.append(f"departs {parsed['date_label']}")

    if parsed["time_of_day"] and _in_time_window(trip.departure_time.hour, TIME_OF_DAY_WINDOWS[parsed["time_of_day"]]):
        score += 0.2
        reasons.append(f"a {parsed['time_of_day']} departure")

    location_hint = parsed["location_hint"]
    if location_hint and (location_hint in origin_l or location_hint in dest_l):
        score += 0.35
        if location_hint not in token_hits:
            reasons.append(f"goes to the {location_hint}")

    score = round(min(score, 1.0), 2)
    if not reasons:
        return 0.05, "Loosely related to your request."
    if len(reasons) == 1:
        return score, f"Matched because it {reasons[0]}."
    return score, "Matched because it " + ", ".join(reasons[:-1]) + f", and {reasons[-1]}."


def _smart_fallback(db: Session, query: str, parsed: dict) -> list[AISearchTripItem]:
    query_lower = query.lower()
    tokens = _search_tokens(query)

    combined: dict[int, tuple[Trip, int]] = {
        trip.id: (trip, seats_available) for trip, seats_available in search_trips(db, q=query)
    }

    # Bridges vocabulary the rider used ("hospital") to a purpose category
    # a coordinator actually set ("medical") even when no literal word
    # overlaps - this is the one thing plain keyword search can't do.
    if parsed["purpose"]:
        purpose_rows = (
            db.query(Trip, _seats_available_subquery())
            .filter(Trip.purpose.ilike(f"%{parsed['purpose']}%"))
            # Newest first: many trips can share the same departure_time
            # (e.g. a busy demo day), and ordering by that alone would let
            # an arbitrary tie-break silently drop a genuinely-matching,
            # just-published trip once a database has more than `limit`
            # matches - recency is a safer tiebreak than insertion order.
            .order_by(Trip.id.desc())
            .limit(50)
            .all()
        )
        for trip, seats_available in purpose_rows:
            combined.setdefault(trip.id, (trip, seats_available))

    # Same bridge, but for *where* rather than *why*: "catch a flight"
    # shares no literal words with a trip whose destination is just "IGI
    # Airport" - search on the actual place word instead.
    if parsed["location_hint"]:
        location_rows = (
            db.query(Trip, _seats_available_subquery())
            .filter(
                or_(
                    Trip.origin.ilike(f"%{parsed['location_hint']}%"),
                    Trip.destination.ilike(f"%{parsed['location_hint']}%"),
                )
            )
            .order_by(Trip.id.desc())
            .limit(50)
            .all()
        )
        for trip, seats_available in location_rows:
            combined.setdefault(trip.id, (trip, seats_available))

    scored = [
        (*_score_and_reason(trip, query_lower, tokens, parsed), trip, seats_available)
        for trip, seats_available in combined.values()
    ]
    scored.sort(key=lambda row: row[0], reverse=True)

    return [
        AISearchTripItem(
            id=trip.id,
            origin=trip.origin,
            destination=trip.destination,
            departure_time=trip.departure_time,
            purpose=trip.purpose,
            seats_available=seats_available,
            total_seats=trip.total_seats,
            match_score=score,
            match_reason=reason,
        )
        for score, reason, trip, seats_available in scored[:MAX_AI_SEARCH_RESULTS]
    ]


def ai_search(db: Session, query: str) -> AISearchResponse:
    parsed = parse_query(query)
    parsed_out = ParsedQuery(**parsed)

    embedding = ai_service.embed_text(query)
    if embedding is None:
        return AISearchResponse(trips=_smart_fallback(db, query, parsed), fallback=True, parsed=parsed_out)

    distance_col = Trip.embedding.cosine_distance(embedding)
    rows = (
        db.query(Trip, distance_col.label("distance"))
        .filter(Trip.embedding.isnot(None))
        .order_by(distance_col)
        .limit(20)
        .all()
    )

    # cosine_distance = 1 - cosine_similarity, so a similarity threshold
    # becomes a maximum distance here.
    max_distance = 1 - settings.semantic_threshold
    matches = [(trip, distance) for trip, distance in rows if distance <= max_distance]

    trips = [
        AISearchTripItem(
            id=trip.id,
            origin=trip.origin,
            destination=trip.destination,
            departure_time=trip.departure_time,
            purpose=trip.purpose,
            match_score=round(1 - distance, 2),
            match_reason="Semantically similar to your request.",
        )
        for trip, distance in matches
    ]
    return AISearchResponse(trips=trips, fallback=False, parsed=parsed_out)
