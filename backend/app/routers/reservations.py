from fastapi import APIRouter, BackgroundTasks, Depends, status
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
from app.services.reservation_triage import run_reservation_triage

router = APIRouter(prefix="/reservations", tags=["reservations"])


@router.post("", response_model=ReservationOut, status_code=status.HTTP_201_CREATED)
def create_reservation_endpoint(
    body: ReservationCreateRequest,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    rider: User = Depends(require_role(UserRole.RIDER)),
) -> ReservationOut:
    reservation = confirm_reservation(db, body.hold_id, rider.id)
    # Fires after this request's response is sent, never inside the
    # booking transaction above - CLAUDE.md rule #2.
    background_tasks.add_task(run_reservation_triage, reservation.id, reservation.trip_id)
    return reservation


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
