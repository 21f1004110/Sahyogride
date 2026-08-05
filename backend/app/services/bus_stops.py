# Coordinator-managed bus stop route + live status (SAHYOG-46). Plain
# names and a manually-set "current stop" index - no GPS, no maps
# library, no coordinates (CLAUDE.md scope exclusion). Zero AI
# involvement; not inside hold_seat()/confirm_reservation()'s locked
# transaction, doesn't touch seats/holds/reservations at all.

from sqlalchemy.orm import Session

from app.errors import AppError
from app.models import BusStop, Trip


def _own_trip(db: Session, trip_id: int, coordinator_id: int) -> Trip:
    trip = db.get(Trip, trip_id)
    if trip is None:
        raise AppError("NOT_FOUND")
    if trip.coordinator_id != coordinator_id:
        raise AppError("NOT_OWNER")
    return trip


def set_stops(db: Session, trip_id: int, coordinator_id: int, stop_names: list[str]) -> list[BusStop]:
    """Replaces the trip's entire route in one call - simplest shape for a
    coordinator filling in a route (possibly with placeholder/dummy stop
    names) rather than adding/reordering one at a time. Resets
    current_stop_sequence since the old index may no longer be valid
    against the new list.
    """
    trip = _own_trip(db, trip_id, coordinator_id)

    db.query(BusStop).filter(BusStop.trip_id == trip_id).delete()
    trip.current_stop_sequence = None

    stops = [BusStop(trip_id=trip_id, name=name, sequence=i) for i, name in enumerate(stop_names)]
    db.add_all(stops)
    db.commit()
    for stop in stops:
        db.refresh(stop)
    return stops


def set_current_stop(
    db: Session, trip_id: int, coordinator_id: int, sequence: int
) -> tuple[list[BusStop], int | None]:
    trip = _own_trip(db, trip_id, coordinator_id)

    stops = db.query(BusStop).filter(BusStop.trip_id == trip_id).order_by(BusStop.sequence).all()
    if not stops:
        raise AppError("VALIDATION_ERROR", message="This trip has no bus stops configured yet.")
    if sequence >= len(stops):
        raise AppError("VALIDATION_ERROR", message="That stop doesn't exist on this trip's route.")

    trip.current_stop_sequence = sequence
    db.commit()
    return stops, trip.current_stop_sequence
