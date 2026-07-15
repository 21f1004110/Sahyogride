# Orchestrates trip embedding as a background task after a trip commits.
# Never called from inside create_trip() - CLAUDE.md rule #2. Writes only
# to a trip's own embedding column - CLAUDE.md rule #3.

import logging

from app.database import SessionLocal
from app.models import Trip
from app.services import ai_service

logger = logging.getLogger(__name__)


def embedding_text_for(trip: Trip) -> str:
    text = f"{trip.origin} to {trip.destination}"
    if trip.purpose:
        text += f": {trip.purpose}"
    return text


def run_trip_embedding(trip_id: int) -> None:
    """Runs as a FastAPI BackgroundTask, after the trip's own create
    request has already returned a response. Opens its own DB session
    rather than reusing the request's. Never raises - a failed or
    disabled embedding just leaves trips.embedding null, and the trip
    keeps working with plain keyword search (SAHYOG-06).
    """
    db = SessionLocal()
    try:
        trip = db.get(Trip, trip_id)
        if trip is None:
            return

        embedding = ai_service.embed_text(embedding_text_for(trip))
        if embedding is None:
            return

        trip.embedding = embedding
        db.commit()
    except Exception:
        logger.exception("Trip embedding failed for trip_id=%s", trip_id)
        db.rollback()
    finally:
        db.close()
