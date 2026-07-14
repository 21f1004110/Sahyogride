# Orchestrates AI triage as a background task after a reservation commits.
# Never called from inside hold_seat()/confirm_reservation() - CLAUDE.md
# rule #2 (zero AI calls inside a booking transaction). This module writes
# only to a reservation's own ai_* columns; it has no power to touch
# seats, holds, or any reservation's booking state - CLAUDE.md rule #3.

import logging
from datetime import datetime, timezone

from app.database import SessionLocal
from app.models import Reservation, Trip
from app.services import ai_service

logger = logging.getLogger(__name__)


def run_reservation_triage(reservation_id: int, trip_id: int) -> None:
    """Runs as a FastAPI BackgroundTask, after the reservation's own
    request has already returned a response. Opens its own DB session
    rather than reusing the request's, since a background task can
    outlive the request-scoped session from get_db(). Never raises -
    a failed or disabled triage just leaves the ai_* columns null.
    """
    db = SessionLocal()
    try:
        trip = db.get(Trip, trip_id)
        purpose = trip.purpose if trip is not None else None

        result = ai_service.triage_reservation_urgency(purpose)
        if result is None:
            return

        reservation = db.get(Reservation, reservation_id)
        if reservation is None:
            return

        reservation.ai_urgency_label = result.urgency_label
        reservation.ai_urgency_score = result.urgency_score
        reservation.ai_triage_completed_at = datetime.now(timezone.utc)
        db.commit()
    except Exception:
        logger.exception("Reservation triage failed for reservation_id=%s", reservation_id)
        db.rollback()
    finally:
        db.close()
