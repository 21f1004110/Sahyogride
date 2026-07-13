from datetime import date as date_type

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models import Seat, SeatStatus, Trip, User
from app.schemas import TripCreateRequest


def create_trip(db: Session, coordinator: User, data: TripCreateRequest) -> Trip:
    trip = Trip(
        coordinator_id=coordinator.id,
        origin=data.origin,
        destination=data.destination,
        departure_time=data.departure_time,
        total_seats=data.total_seats,
        purpose=data.purpose,
    )
    db.add(trip)
    db.flush()

    for seat_number in range(1, data.total_seats + 1):
        db.add(Seat(trip_id=trip.id, seat_number=str(seat_number)))

    db.commit()
    db.refresh(trip)
    return trip


def search_trips(
    db: Session,
    origin: str | None = None,
    destination: str | None = None,
    date: date_type | None = None,
    q: str | None = None,
) -> list[tuple[Trip, int]]:
    seats_available = (
        select(func.count(Seat.id))
        .where(Seat.trip_id == Trip.id, Seat.status == SeatStatus.AVAILABLE)
        .correlate(Trip)
        .scalar_subquery()
        .label("seats_available")
    )

    query = db.query(Trip, seats_available)

    if origin:
        query = query.filter(Trip.origin.ilike(f"%{origin}%"))
    if destination:
        query = query.filter(Trip.destination.ilike(f"%{destination}%"))
    if date:
        query = query.filter(func.date(Trip.departure_time) == date)
    if q:
        pattern = f"%{q}%"
        query = query.filter(
            Trip.origin.ilike(pattern) | Trip.destination.ilike(pattern) | Trip.purpose.ilike(pattern)
        )

    return query.order_by(Trip.departure_time).all()
