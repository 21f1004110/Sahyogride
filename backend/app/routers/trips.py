from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.deps import require_role
from app.models import User, UserRole
from app.schemas import TripCreateRequest, TripOut
from app.services.trip_service import create_trip

router = APIRouter(prefix="/trips", tags=["trips"])


@router.post("", response_model=TripOut, status_code=status.HTTP_201_CREATED)
def create_trip_endpoint(
    body: TripCreateRequest,
    db: Session = Depends(get_db),
    coordinator: User = Depends(require_role(UserRole.COORDINATOR)),
) -> TripOut:
    trip = create_trip(db, coordinator, body)
    return trip
