from sqlalchemy.orm import Session

from app.models import Seat, Trip, User
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
