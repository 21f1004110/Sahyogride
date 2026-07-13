from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.deps import require_role
from app.models import User, UserRole
from app.schemas import HoldCreateRequest, HoldOut
from app.services.booking import hold_seat, release_hold

router = APIRouter(prefix="/holds", tags=["holds"])


@router.post("", response_model=HoldOut, status_code=status.HTTP_201_CREATED)
def create_hold_endpoint(
    body: HoldCreateRequest,
    db: Session = Depends(get_db),
    rider: User = Depends(require_role(UserRole.RIDER)),
) -> HoldOut:
    return hold_seat(db, body.seat_id, rider.id)


@router.delete("/{hold_id}", status_code=status.HTTP_204_NO_CONTENT)
def release_hold_endpoint(
    hold_id: int,
    db: Session = Depends(get_db),
    rider: User = Depends(require_role(UserRole.RIDER)),
) -> None:
    release_hold(db, hold_id, rider.id)
