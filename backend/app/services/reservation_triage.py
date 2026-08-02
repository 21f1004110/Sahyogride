# Orchestrates AI triage as a background task after a reservation commits.
# Never called from inside hold_seat()/confirm_reservation() - CLAUDE.md
# rule #2 (zero AI calls inside a booking transaction). This module writes
# only to a reservation's own ai_* columns (and, for the demand flag, the
# parent trip's) - it has no power to touch seats, holds, or any
# reservation's booking state - CLAUDE.md rule #3.

import logging
from datetime import datetime, timezone

from sqlalchemy import func

from app.database import SessionLocal
from app.models import Reservation, ReservationStatus, Trip
from app.services import ai_service

logger = logging.getLogger(__name__)

# Fraction of seats confirmed at which a trip gets flagged for coordinator
# attention (SAHYOG-42). Deterministic on purpose - "is this ratio over a
# threshold" is arithmetic, not a semantic judgment an LLM is needed for,
# so this flag is always accurate regardless of AI_ENABLED.
HIGH_DEMAND_THRESHOLD = 0.75


def _check_high_demand(db, trip: Trip) -> bool:
    """Never un-flags a trip once it crosses the threshold. Returns True
    only when this call is what newly set the flag (so the caller knows
    whether a commit is needed).
    """
    if trip.ai_high_demand or trip.total_seats == 0:
        return False

    confirmed_count = (
        db.query(func.count(Reservation.id))
        .filter(Reservation.trip_id == trip.id, Reservation.status == ReservationStatus.CONFIRMED)
        .scalar()
    )
    if confirmed_count / trip.total_seats >= HIGH_DEMAND_THRESHOLD:
        trip.ai_high_demand = True
        return True
    return False


def run_reservation_triage(reservation_id: int, trip_id: int) -> None:
    """Runs as a FastAPI BackgroundTask, after the reservation's own
    request has already returned a response. Opens its own DB session
    rather than reusing the request's, since a background task can
    outlive the request-scoped session from get_db(). Never raises -
    a failed or disabled triage just leaves the ai_* columns null.

    Also classifies the rider's optional accessibility_note (SAHYOG-40)
    and checks the parent trip's high-demand flag (SAHYOG-42) here rather
    than in separate background tasks - all are cheap, independent,
    post-commit checks on the same freshly-confirmed reservation, same
    precedent as trip_embedding.py combining embedding + summary in one
    task.
    """
    db = SessionLocal()
    try:
        reservation = db.get(Reservation, reservation_id)
        if reservation is None:
            return

        trip = db.get(Trip, trip_id)
        purpose = trip.purpose if trip is not None else None

        urgency = ai_service.triage_reservation_urgency(purpose)
        if urgency is not None:
            reservation.ai_urgency_label = urgency.urgency_label
            reservation.ai_urgency_score = urgency.urgency_score
            reservation.ai_triage_completed_at = datetime.now(timezone.utc)

        accessibility = ai_service.classify_accessibility_note(reservation.accessibility_note)
        if accessibility is not None:
            reservation.ai_accessibility_tags = accessibility.tag

        demand_flag_changed = _check_high_demand(db, trip) if trip is not None else False

        if urgency is not None or accessibility is not None or demand_flag_changed:
            db.commit()
    except Exception:
        logger.exception("Reservation triage failed for reservation_id=%s", reservation_id)
        db.rollback()
    finally:
        db.close()
