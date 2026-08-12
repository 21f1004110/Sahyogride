import re
from collections import Counter
from datetime import date as date_type

from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session

from app.errors import AppError
from app.models import Hold, Reservation, ReservationStatus, Seat, SeatStatus, Trip, User
from app.schemas import BusStopOut, PassengerItem, SeatOut, TripCreateRequest, TripDetailOut
from app.services import ai_service

# Common filler words in a natural-language query ("I need a ride to the
# hospital tomorrow morning") that shouldn't be matched literally - the
# keyword fallback (used whenever AI is off/fails, per CLAUDE.md rule #3)
# has no real language understanding, so it tokenizes and drops these
# instead of requiring the entire phrase as one literal substring, which
# otherwise almost never matches a trip's plain origin/destination/purpose
# text (e.g. "ride to the airport" doesn't contain "airport" as a whole-
# phrase substring, but should still match a trip destined for one).
_SEARCH_STOPWORDS = {
    "a", "an", "the", "to", "for", "in", "on", "of", "at", "and", "or", "with",
    "is", "are", "i", "my", "me", "need", "want", "some", "please", "ride",
    "trip", "find", "looking", "there", "any", "seat", "book", "get",
}


def _search_tokens(q: str) -> list[str]:
    words = re.findall(r"[a-zA-Z0-9]+", q.lower())
    return [w for w in words if len(w) >= 3 and w not in _SEARCH_STOPWORDS]


def create_trip(db: Session, coordinator: User, data: TripCreateRequest) -> Trip:
    trip = Trip(
        coordinator_id=coordinator.id,
        origin=data.origin,
        destination=data.destination,
        departure_time=data.departure_time,
        total_seats=data.total_seats,
        purpose=data.purpose,
        origin_lat=data.origin_lat,
        origin_lng=data.origin_lng,
        destination_lat=data.destination_lat,
        destination_lng=data.destination_lng,
    )
    db.add(trip)
    db.flush()

    for seat_number in range(1, data.total_seats + 1):
        db.add(Seat(trip_id=trip.id, seat_number=str(seat_number)))

    db.commit()
    db.refresh(trip)
    return trip


MAX_SEARCH_RESULTS = 50


def _seats_available_subquery():
    return (
        select(func.count(Seat.id))
        .where(Seat.trip_id == Trip.id, Seat.status == SeatStatus.AVAILABLE)
        .correlate(Trip)
        .scalar_subquery()
        .label("seats_available")
    )


def search_trips(
    db: Session,
    origin: str | None = None,
    destination: str | None = None,
    date: date_type | None = None,
    q: str | None = None,
) -> list[tuple[Trip, int]]:
    query = db.query(Trip, _seats_available_subquery())

    if origin:
        query = query.filter(Trip.origin.ilike(f"%{origin}%"))
    if destination:
        query = query.filter(Trip.destination.ilike(f"%{destination}%"))
    if date:
        query = query.filter(func.date(Trip.departure_time) == date)
    if q:
        whole_pattern = f"%{q}%"
        conditions = [
            Trip.origin.ilike(whole_pattern),
            Trip.destination.ilike(whole_pattern),
            Trip.purpose.ilike(whole_pattern),
        ]
        for token in _search_tokens(q):
            token_pattern = f"%{token}%"
            conditions += [
                Trip.origin.ilike(token_pattern),
                Trip.destination.ilike(token_pattern),
                Trip.purpose.ilike(token_pattern),
            ]
        query = query.filter(or_(*conditions))

    return query.order_by(Trip.departure_time).limit(MAX_SEARCH_RESULTS).all()


def list_my_trips(db: Session, coordinator_id: int) -> list[tuple[Trip, int]]:
    return (
        db.query(Trip, _seats_available_subquery())
        .filter(Trip.coordinator_id == coordinator_id)
        .order_by(Trip.departure_time.desc())
        .all()
    )


def list_trip_passengers(db: Session, trip_id: int, coordinator_id: int) -> tuple[Trip, list[PassengerItem]]:
    trip = db.get(Trip, trip_id)
    if trip is None:
        raise AppError("NOT_FOUND")
    if trip.coordinator_id != coordinator_id:
        raise AppError("NOT_OWNER")

    rows = (
        db.query(Reservation, Seat.seat_number, User.name)
        .join(Seat, Seat.id == Reservation.seat_id)
        .join(User, User.id == Reservation.rider_id)
        .filter(Reservation.trip_id == trip_id, Reservation.status == ReservationStatus.CONFIRMED)
        .all()
    )
    rows.sort(key=lambda row: int(row[1]))

    passengers = [
        PassengerItem(
            reservation_id=reservation.id,
            rider_name=rider_name,
            seat_number=seat_number,
            confirmed_at=reservation.confirmed_at,
            ai_urgency_label=reservation.ai_urgency_label,
            ai_accessibility_tags=reservation.ai_accessibility_tags,
            passenger_name=reservation.passenger_name,
            passenger_phone=reservation.passenger_phone,
        )
        for reservation, seat_number, rider_name in rows
    ]
    return trip, passengers


def get_passenger_digest(trip: Trip, passengers: list[PassengerItem]) -> str | None:
    """Read-only, computed synchronously per request - see
    ai_service.summarize_passenger_mix for why a sync call is fine here.
    """
    urgency_counts = Counter(p.ai_urgency_label for p in passengers if p.ai_urgency_label is not None)
    return ai_service.summarize_passenger_mix(
        total_seats=trip.total_seats,
        confirmed_count=len(passengers),
        urgency_counts=dict(urgency_counts),
    )


def get_trip_detail(db: Session, trip_id: int, rider_id: int) -> TripDetailOut:
    trip = db.get(Trip, trip_id)
    if trip is None:
        raise AppError("NOT_FOUND")

    held_seat_id = (
        db.query(Hold.seat_id).filter(Hold.trip_id == trip_id, Hold.rider_id == rider_id).scalar()
    )

    seats = sorted(trip.seats, key=lambda s: int(s.seat_number))
    seat_items = [
        SeatOut(
            id=seat.id,
            seat_number=seat.seat_number,
            status=seat.status.value,
            held_by_me=seat.id == held_seat_id,
        )
        for seat in seats
    ]

    return TripDetailOut(
        id=trip.id,
        coordinator_id=trip.coordinator_id,
        origin=trip.origin,
        destination=trip.destination,
        departure_time=trip.departure_time,
        total_seats=trip.total_seats,
        purpose=trip.purpose,
        ai_summary=trip.ai_summary,
        origin_lat=trip.origin_lat,
        origin_lng=trip.origin_lng,
        destination_lat=trip.destination_lat,
        destination_lng=trip.destination_lng,
        seats=seat_items,
        bus_stops=[BusStopOut.model_validate(stop) for stop in trip.bus_stops],
        current_stop_sequence=trip.current_stop_sequence,
    )
