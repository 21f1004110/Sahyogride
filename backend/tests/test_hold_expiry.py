import uuid
from datetime import datetime, timedelta, timezone

from fastapi.testclient import TestClient

from app.database import SessionLocal
from app.main import app
from app.models import Hold, Seat, SeatStatus
from app.services.booking import release_expired_holds

client = TestClient(app)


def unique_email(prefix: str) -> str:
    return f"{prefix}.{uuid.uuid4().hex[:12]}@example.com"


def register(role: str) -> dict:
    res = client.post(
        "/auth/register",
        json={"name": "Test User", "email": unique_email(role), "password": "password123", "role": role},
    )
    assert res.status_code == 201, res.text
    return res.json()


def auth_header(token: str) -> dict:
    return {"Authorization": f"Bearer {token}"}


def create_trip(coordinator_token: str, total_seats: int = 4) -> dict:
    payload = {
        "origin": "City Hospital",
        "destination": "Railway Station",
        "departure_time": "2026-07-15T09:30:00Z",
        "total_seats": total_seats,
        "purpose": "medical",
    }
    res = client.post("/trips", json=payload, headers=auth_header(coordinator_token))
    assert res.status_code == 201, res.text
    return res.json()


def seat_ids_for(trip_id: int) -> list[int]:
    db = SessionLocal()
    try:
        seats = db.query(Seat).filter(Seat.trip_id == trip_id).order_by(Seat.seat_number).all()
        return [s.id for s in seats]
    finally:
        db.close()


def hold_seat(rider_token: str, seat_id: int) -> dict:
    res = client.post("/holds", json={"seat_id": seat_id}, headers=auth_header(rider_token))
    assert res.status_code == 201, res.text
    return res.json()


def expire_hold(hold_id: int) -> None:
    db = SessionLocal()
    try:
        hold = db.get(Hold, hold_id)
        hold.expires_at = datetime.now(timezone.utc) - timedelta(seconds=1)
        db.commit()
    finally:
        db.close()


def test_release_expired_holds_frees_the_seat():
    coordinator = register("coordinator")
    rider = register("rider")
    trip = create_trip(coordinator["token"])
    seat_id = seat_ids_for(trip["id"])[0]
    hold = hold_seat(rider["token"], seat_id)
    expire_hold(hold["id"])

    db = SessionLocal()
    try:
        released = release_expired_holds(db)
        assert released == 1
        assert db.get(Hold, hold["id"]) is None
        seat = db.get(Seat, seat_id)
        assert seat.status == SeatStatus.AVAILABLE
    finally:
        db.close()


def test_release_expired_holds_leaves_valid_holds_alone():
    coordinator = register("coordinator")
    rider = register("rider")
    trip = create_trip(coordinator["token"])
    seat_id = seat_ids_for(trip["id"])[0]
    hold = hold_seat(rider["token"], seat_id)

    db = SessionLocal()
    try:
        released = release_expired_holds(db)
        assert released == 0
        assert db.get(Hold, hold["id"]) is not None
        seat = db.get(Seat, seat_id)
        assert seat.status == SeatStatus.HELD
    finally:
        db.close()


def test_hold_seat_immediately_reclaims_a_seat_whose_hold_expired():
    coordinator = register("coordinator")
    rider_a = register("rider")
    rider_b = register("rider")
    trip = create_trip(coordinator["token"])
    seat_id = seat_ids_for(trip["id"])[0]
    hold_a = hold_seat(rider_a["token"], seat_id)
    expire_hold(hold_a["id"])

    # rider_b holds it right away, with no sweep having run in between.
    res = client.post("/holds", json={"seat_id": seat_id}, headers=auth_header(rider_b["token"]))
    assert res.status_code == 201, res.text
    assert res.json()["rider_id"] == rider_b["user"]["id"]

    db = SessionLocal()
    try:
        assert db.get(Hold, hold_a["id"]) is None
    finally:
        db.close()
