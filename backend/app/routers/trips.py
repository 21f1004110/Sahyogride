from datetime import date as date_type

from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.deps import get_current_user, require_role
from app.models import User, UserRole
from app.schemas import TripCreateRequest, TripListItem, TripListResponse, TripOut
from app.services.trip_service import create_trip, search_trips

router = APIRouter(prefix="/trips", tags=["trips"])


@router.post("", response_model=TripOut, status_code=status.HTTP_201_CREATED)
def create_trip_endpoint(
    body: TripCreateRequest,
    db: Session = Depends(get_db),
    coordinator: User = Depends(require_role(UserRole.COORDINATOR)),
) -> TripOut:
    trip = create_trip(db, coordinator, body)
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
        )
        for trip, seats_available in results
    ]
    return TripListResponse(trips=trips)
