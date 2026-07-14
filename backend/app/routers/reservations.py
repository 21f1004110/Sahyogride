from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.deps import require_role
from app.models import User, UserRole
from app.schemas import ReservationCreateRequest, ReservationOut
from app.services.booking import confirm_reservation

router = APIRouter(prefix="/reservations", tags=["reservations"])


@router.post("", response_model=ReservationOut, status_code=status.HTTP_201_CREATED)
def create_reservation_endpoint(
    body: ReservationCreateRequest,
    db: Session = Depends(get_db),
    rider: User = Depends(require_role(UserRole.RIDER)),
) -> ReservationOut:
    return confirm_reservation(db, body.hold_id, rider.id)

# GET /reservations/me and POST /reservations/{id}/cancel land in SAHYOG-20, 21.
