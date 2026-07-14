from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.deps import require_role
from app.models import User, UserRole
from app.schemas import (
    ReservationCancelOut,
    ReservationCreateRequest,
    ReservationHistoryResponse,
    ReservationOut,
)
from app.services.booking import cancel_reservation, confirm_reservation, list_my_reservations

router = APIRouter(prefix="/reservations", tags=["reservations"])


@router.post("", response_model=ReservationOut, status_code=status.HTTP_201_CREATED)
def create_reservation_endpoint(
    body: ReservationCreateRequest,
    db: Session = Depends(get_db),
    rider: User = Depends(require_role(UserRole.RIDER)),
) -> ReservationOut:
    return confirm_reservation(db, body.hold_id, rider.id)


@router.get("/me", response_model=ReservationHistoryResponse)
def list_my_reservations_endpoint(
    db: Session = Depends(get_db),
    rider: User = Depends(require_role(UserRole.RIDER)),
) -> ReservationHistoryResponse:
    return ReservationHistoryResponse(reservations=list_my_reservations(db, rider.id))


@router.post("/{reservation_id}/cancel", response_model=ReservationCancelOut)
def cancel_reservation_endpoint(
    reservation_id: int,
    db: Session = Depends(get_db),
    rider: User = Depends(require_role(UserRole.RIDER)),
) -> ReservationCancelOut:
    return cancel_reservation(db, reservation_id, rider.id)
