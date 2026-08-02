# Suggests alternative trips when one is nearly full (SAHYOG-39). Adds
# NO new AI network call: trips.embedding is already populated by
# SAHYOG-26's post-commit background task, so this is pure pgvector
# math against an already-existing column - read-only, same
# fallback-not-failure shape as ai_search.py.

from sqlalchemy.orm import Session

from app.config import settings
from app.errors import AppError
from app.models import Trip
from app.schemas import SimilarTripsResponse, TripListItem
from app.services.trip_service import _seats_available_subquery, search_trips


def _to_item(trip: Trip, seats_available: int) -> TripListItem:
    return TripListItem(
        id=trip.id,
        origin=trip.origin,
        destination=trip.destination,
        departure_time=trip.departure_time,
        total_seats=trip.total_seats,
        seats_available=seats_available,
        purpose=trip.purpose,
        ai_summary=trip.ai_summary,
    )


def _fallback_same_destination(db: Session, trip: Trip, limit: int) -> list[tuple[Trip, int]]:
    rows = search_trips(db, destination=trip.destination)
    return [(t, n) for t, n in rows if t.id != trip.id][:limit]


def find_similar_trips(db: Session, trip_id: int, limit: int = 3) -> SimilarTripsResponse:
    trip = db.get(Trip, trip_id)
    if trip is None:
        raise AppError("NOT_FOUND")

    if trip.embedding is None:
        rows = _fallback_same_destination(db, trip, limit)
        return SimilarTripsResponse(trips=[_to_item(t, n) for t, n in rows], fallback=True)

    distance_col = Trip.embedding.cosine_distance(trip.embedding)
    rows = (
        db.query(Trip, _seats_available_subquery(), distance_col.label("distance"))
        .filter(Trip.id != trip_id, Trip.embedding.isnot(None))
        .order_by(distance_col)
        .limit(limit)
        .all()
    )

    max_distance = 1 - settings.semantic_threshold
    matches = [(t, n) for t, n, distance in rows if distance <= max_distance]

    if not matches:
        fallback_rows = _fallback_same_destination(db, trip, limit)
        if fallback_rows:
            return SimilarTripsResponse(trips=[_to_item(t, n) for t, n in fallback_rows], fallback=True)
        return SimilarTripsResponse(trips=[], fallback=False)

    return SimilarTripsResponse(trips=[_to_item(t, n) for t, n in matches], fallback=False)
