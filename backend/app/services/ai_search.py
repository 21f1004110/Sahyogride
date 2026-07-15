# Orchestrates AI semantic search: embeds the query, ranks trips by
# cosine distance, and falls back to the plain keyword search from
# SAHYOG-06 whenever AI is off or the embedding call fails - never an
# empty failure with no results if a keyword match exists
# (API_CONTRACT.md). Read-only: this module can only ever return trips,
# never book, cancel, or modify anything - CLAUDE.md rule #3.

from sqlalchemy.orm import Session

from app.config import settings
from app.models import Trip
from app.schemas import AISearchResponse, AISearchTripItem
from app.services import ai_service
from app.services.trip_service import search_trips


def _to_item(trip: Trip) -> AISearchTripItem:
    return AISearchTripItem(
        id=trip.id,
        origin=trip.origin,
        destination=trip.destination,
        departure_time=trip.departure_time,
    )


def _keyword_fallback(db: Session, query: str) -> list[AISearchTripItem]:
    results = search_trips(db, q=query)
    return [_to_item(trip) for trip, _seats_available in results]


def ai_search(db: Session, query: str) -> AISearchResponse:
    embedding = ai_service.embed_text(query)
    if embedding is None:
        return AISearchResponse(trips=_keyword_fallback(db, query), fallback=True)

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
    matches = [trip for trip, distance in rows if distance <= max_distance]

    return AISearchResponse(trips=[_to_item(t) for t in matches], fallback=False)
