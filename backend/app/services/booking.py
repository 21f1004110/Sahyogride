# hold_seat(), confirm_reservation(), and hold expiry land here starting SAHYOG-15.
# Zero AI calls in this module - see CLAUDE.md rule #2.

from datetime import datetime, timedelta, timezone

from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.config import settings
from app.errors import AppError
from app.models import Hold, Reservation, Seat, SeatStatus


def hold_seat(db: Session, seat_id: int, rider_id: int) -> Hold:
    """Concurrency-safe: SELECT ... FOR UPDATE locks the seat row so two
    simultaneous callers on the same seat_id serialize here, and the loser
    sees status != available. UNIQUE(seat_id) and UNIQUE(trip_id, rider_id)
    on the holds table are the second layer, guarding paths this lock alone
    doesn't cover (e.g. the one-hold-per-rider-per-trip check below, which
    is read-then-write against a different row than the one being locked).
    """
    seat = db.query(Seat).filter(Seat.id == seat_id).with_for_update().first()
    if seat is None:
        raise AppError("NOT_FOUND")

    if seat.status != SeatStatus.AVAILABLE:
        raise AppError("SEAT_UNAVAILABLE")

    already_holding = (
        db.query(Hold).filter(Hold.trip_id == seat.trip_id, Hold.rider_id == rider_id).first()
    )
    if already_holding is not None:
        raise AppError("ALREADY_HOLDING")

    expires_at = datetime.now(timezone.utc) + timedelta(minutes=settings.hold_ttl_minutes)
    hold = Hold(seat_id=seat.id, trip_id=seat.trip_id, rider_id=rider_id, expires_at=expires_at)
    seat.status = SeatStatus.HELD
    db.add(hold)

    try:
        db.commit()
    except IntegrityError as exc:
        db.rollback()
        constraint = getattr(getattr(exc.orig, "diag", None), "constraint_name", None)
        if constraint == "uq_holds_trip_rider":
            raise AppError("ALREADY_HOLDING") from exc
        raise AppError("SEAT_UNAVAILABLE") from exc

    db.refresh(hold)
    return hold


def release_hold(db: Session, hold_id: int, rider_id: int) -> None:
    hold = db.get(Hold, hold_id)
    if hold is None:
        raise AppError("NOT_FOUND")
    if hold.rider_id != rider_id:
        raise AppError("NOT_OWNER")

    seat = db.query(Seat).filter(Seat.id == hold.seat_id).with_for_update().first()
    db.delete(hold)
    if seat is not None and seat.status == SeatStatus.HELD:
        seat.status = SeatStatus.AVAILABLE
    db.commit()


def confirm_reservation(db: Session, hold_id: int, rider_id: int) -> Reservation:
    """Zero AI calls. Locking the hold row (rather than the seat) is what
    serializes a double-confirm race: the loser's SELECT ... FOR UPDATE
    blocks until the winner commits and deletes the row, so it then sees
    NOT_FOUND. The partial unique index uq_reservations_seat_confirmed
    (SAHYOG-02) is the third layer, a backstop against two *different*
    holds ever producing two confirmed reservations for the same seat -
    which the schema shouldn't allow (UNIQUE(seat_id) on holds) but the
    index guarantees it at the database level regardless.
    """
    hold = db.query(Hold).filter(Hold.id == hold_id).with_for_update().first()
    if hold is None:
        raise AppError("NOT_FOUND")
    if hold.rider_id != rider_id:
        raise AppError("NOT_OWNER")
    if hold.expires_at <= datetime.now(timezone.utc):
        raise AppError("HOLD_EXPIRED")

    seat = db.query(Seat).filter(Seat.id == hold.seat_id).with_for_update().first()
    reservation = Reservation(seat_id=hold.seat_id, trip_id=hold.trip_id, rider_id=rider_id)
    db.delete(hold)
    if seat is not None:
        seat.status = SeatStatus.RESERVED
    db.add(reservation)

    try:
        db.commit()
    except IntegrityError as exc:
        db.rollback()
        raise AppError("SEAT_UNAVAILABLE") from exc

    db.refresh(reservation)
    return reservation
