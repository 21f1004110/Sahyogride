from datetime import date as date_type

from fastapi import APIRouter, BackgroundTasks, Depends, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.deps import get_current_user, require_role
from app.models import User, UserRole
from app.schemas import (
    BusStopOut,
    BusStopStatusResponse,
    PassengerListResponse,
    SeatRecommendationRequest,
    SeatRecommendationResponse,
    SetBusStopsRequest,
    SetCurrentStopRequest,
    SimilarTripsResponse,
    TripCreateRequest,
    TripDetailOut,
    TripListItem,
    TripListResponse,
    TripOut,
)
from app.services import bus_stops as bus_stops_service
from app.services.seat_recommendation import recommend_seat
from app.services.similar_trips import find_similar_trips
from app.services.trip_embedding import run_trip_embedding
from app.services.trip_service import (
    create_trip,
    get_passenger_digest,
    get_trip_detail,
    list_my_trips,
    list_trip_passengers,
    search_trips,
)

router = APIRouter(prefix="/trips", tags=["trips"])


@router.post("", response_model=TripOut, status_code=status.HTTP_201_CREATED)
def create_trip_endpoint(
    body: TripCreateRequest,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    coordinator: User = Depends(require_role(UserRole.COORDINATOR)),
) -> TripOut:
    trip = create_trip(db, coordinator, body)
    # Fires after this request's response is sent, never inside the
    # trip-creation transaction above - CLAUDE.md rule #2.
    background_tasks.add_task(run_trip_embedding, trip.id)
    return trip


@router.get("", response_model=TripListResponse)
def search_trips_endpoint(
    origin: str | None = None,
    destination: str | None = None,
    date: date_type | None = None,
    q: str | None = None,
    db: Session = Depends(get_db),
    _user: User = Depends(get_current_user),
) -> TripListResponse:
    results = search_trips(db, origin=origin, destination=destination, date=date, q=q)
    trips = [
        TripListItem(
            id=trip.id,
            origin=trip.origin,
            destination=trip.destination,
            departure_time=trip.departure_time,
            total_seats=trip.total_seats,
            seats_available=seats_available,
            purpose=trip.purpose,
            ai_summary=trip.ai_summary,
            ai_high_demand=trip.ai_high_demand,
        )
        for trip, seats_available in results
    ]
    return TripListResponse(trips=trips)


@router.get("/mine", response_model=TripListResponse)
def list_my_trips_endpoint(
    db: Session = Depends(get_db),
    coordinator: User = Depends(require_role(UserRole.COORDINATOR)),
) -> TripListResponse:
    results = list_my_trips(db, coordinator.id)
    trips = [
        TripListItem(
            id=trip.id,
            origin=trip.origin,
            destination=trip.destination,
            departure_time=trip.departure_time,
            total_seats=trip.total_seats,
            seats_available=seats_available,
            purpose=trip.purpose,
            ai_summary=trip.ai_summary,
            ai_high_demand=trip.ai_high_demand,
        )
        for trip, seats_available in results
    ]
    return TripListResponse(trips=trips)


@router.get("/{trip_id}", response_model=TripDetailOut)
def get_trip_endpoint(
    trip_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> TripDetailOut:
    return get_trip_detail(db, trip_id, user.id)


@router.get("/{trip_id}/passengers", response_model=PassengerListResponse)
def get_trip_passengers_endpoint(
    trip_id: int,
    db: Session = Depends(get_db),
    coordinator: User = Depends(require_role(UserRole.COORDINATOR)),
) -> PassengerListResponse:
    trip, passengers = list_trip_passengers(db, trip_id, coordinator.id)
    digest = get_passenger_digest(trip, passengers)
    return PassengerListResponse(passengers=passengers, digest=digest)


@router.post("/{trip_id}/seat-recommendation", response_model=SeatRecommendationResponse)
def seat_recommendation_endpoint(
    trip_id: int,
    body: SeatRecommendationRequest,
    db: Session = Depends(get_db),
    _rider: User = Depends(require_role(UserRole.RIDER)),
) -> SeatRecommendationResponse:
    return recommend_seat(db, trip_id, body.note)


@router.get("/{trip_id}/similar", response_model=SimilarTripsResponse)
def similar_trips_endpoint(
    trip_id: int,
    limit: int = 3,
    db: Session = Depends(get_db),
    _user: User = Depends(get_current_user),
) -> SimilarTripsResponse:
    return find_similar_trips(db, trip_id, limit=limit)


@router.put("/{trip_id}/stops", response_model=list[BusStopOut])
def set_bus_stops_endpoint(
    trip_id: int,
    body: SetBusStopsRequest,
    db: Session = Depends(get_db),
    coordinator: User = Depends(require_role(UserRole.COORDINATOR)),
) -> list[BusStopOut]:
    """Replaces the trip's entire route - see app/services/bus_stops.py."""
    stops = bus_stops_service.set_stops(db, trip_id, coordinator.id, body.stop_names)
    return [BusStopOut.model_validate(stop) for stop in stops]


@router.patch("/{trip_id}/stops/current", response_model=BusStopStatusResponse)
def set_current_stop_endpoint(
    trip_id: int,
    body: SetCurrentStopRequest,
    db: Session = Depends(get_db),
    coordinator: User = Depends(require_role(UserRole.COORDINATOR)),
) -> BusStopStatusResponse:
    stops, current_stop_sequence = bus_stops_service.set_current_stop(
        db, trip_id, coordinator.id, body.sequence
    )
    return BusStopStatusResponse(
        stops=[BusStopOut.model_validate(stop) for stop in stops],
        current_stop_sequence=current_stop_sequence,
    )
