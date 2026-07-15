"""One-off script: backfill embeddings for trips that don't have one yet
(created before SAHYOG-26, or created while AI was disabled/unreachable).
Safe to re-run - only touches trips where embedding IS NULL, and simply
skips a trip (leaving it null) if the AI call fails, same as the
background task on trip creation does.

Usage: python backfill_embeddings.py
"""

from app.database import SessionLocal
from app.models import Trip
from app.services import ai_service
from app.services.trip_embedding import embedding_text_for


def main() -> None:
    db = SessionLocal()
    try:
        trips = db.query(Trip).filter(Trip.embedding.is_(None)).all()
        print(f"{len(trips)} trip(s) missing an embedding.")

        updated = 0
        for trip in trips:
            embedding = ai_service.embed_text(embedding_text_for(trip))
            if embedding is None:
                print(f"  trip {trip.id}: skipped (AI disabled, unconfigured, or call failed)")
                continue
            trip.embedding = embedding
            updated += 1
            print(f"  trip {trip.id}: embedded")

        db.commit()
        print(f"Done. {updated}/{len(trips)} trip(s) embedded.")
    finally:
        db.close()


if __name__ == "__main__":
    main()
