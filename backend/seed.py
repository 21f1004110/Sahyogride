from datetime import datetime, timedelta, timezone

import bcrypt

from app.database import SessionLocal
from app.models import Seat, Trip, User, UserRole


def hash_password(raw: str) -> str:
    return bcrypt.hashpw(raw.encode(), bcrypt.gensalt()).decode()


def main() -> None:
    db = SessionLocal()
    try:
        coordinator = User(
            name="Demo Coordinator",
            email="coordinator@example.com",
            password_hash=hash_password("password123"),
            role=UserRole.COORDINATOR,
        )
        rider = User(
            name="Demo Rider",
            email="rider@example.com",
            password_hash=hash_password("password123"),
            role=UserRole.RIDER,
        )
        db.add_all([coordinator, rider])
        db.flush()

        trip = Trip(
            coordinator_id=coordinator.id,
            origin="City Hospital",
            destination="Railway Station",
            departure_time=datetime.now(timezone.utc) + timedelta(days=1),
            total_seats=4,
            purpose="medical",
        )
        db.add(trip)
        db.flush()

        db.add_all(Seat(trip_id=trip.id, seat_number=str(n)) for n in range(1, trip.total_seats + 1))

        db.commit()
        print(f"Seeded coordinator={coordinator.email} rider={rider.email} trip_id={trip.id}")
    finally:
        db.close()


if __name__ == "__main__":
    main()
