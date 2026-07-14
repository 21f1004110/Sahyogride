import uuid
from datetime import datetime, timedelta, timezone

from fastapi.testclient import TestClient

from app.database import SessionLocal
from app.main import app
from app.models import Hold, Reservation, ReservationStatus, Seat, SeatStatus

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


def test_confirm_reservation_success():
    coordinator = register("coordinator")
    rider = register("rider")
    trip = create_trip(coordinator["token"])
    seat_id = seat_ids_for(trip["id"])[0]
    hold = hold_seat(rider["token"], seat_id)

    res = client.post("/reservations", json={"hold_id": hold["id"]}, headers=auth_header(rider["token"]))
    assert res.status_code == 201, res.text
    body = res.json()
    assert body["seat_id"] == seat_id
    assert body["trip_id"] == trip["id"]
    assert body["rider_id"] == rider["user"]["id"]
    assert body["status"] == "confirmed"
    assert body["confirmed_at"]

    db = SessionLocal()
    try:
        assert db.get(Hold, hold["id"]) is None
        seat = db.get(Seat, seat_id)
        assert seat.status == SeatStatus.RESERVED
        reservation = db.get(Reservation, body["id"])
        assert reservation.status == ReservationStatus.CONFIRMED
    finally:
        db.close()


def test_confirm_reservation_not_owner():
    coordinator = register("coordinator")
    rider_a = register("rider")
    rider_b = register("rider")
    trip = create_trip(coordinator["token"])
    seat_id = seat_ids_for(trip["id"])[0]
    hold = hold_seat(rider_a["token"], seat_id)

    res = client.post("/reservations", json={"hold_id": hold["id"]}, headers=auth_header(rider_b["token"]))
    assert res.status_code == 403
    assert res.json()["error"]["code"] == "NOT_OWNER"


def test_confirm_reservation_not_found():
    rider = register("rider")
    res = client.post("/reservations", json={"hold_id": 999999999}, headers=auth_header(rider["token"]))
    assert res.status_code == 404
    assert res.json()["error"]["code"] == "NOT_FOUND"


def test_confirm_reservation_expired_hold_returns_410():
    coordinator = register("coordinator")
    rider = register("rider")
    trip = create_trip(coordinator["token"])
    seat_id = seat_ids_for(trip["id"])[0]
    hold = hold_seat(rider["token"], seat_id)
    expire_hold(hold["id"])

    res = client.post("/reservations", json={"hold_id": hold["id"]}, headers=auth_header(rider["token"]))
    assert res.status_code == 410
    assert res.json()["error"]["code"] == "HOLD_EXPIRED"


def test_confirm_reservation_forbidden_for_coordinator():
    coordinator = register("coordinator")
    rider = register("rider")
    trip = create_trip(coordinator["token"])
    seat_id = seat_ids_for(trip["id"])[0]
    hold = hold_seat(rider["token"], seat_id)

    res = client.post("/reservations", json={"hold_id": hold["id"]}, headers=auth_header(coordinator["token"]))
    assert res.status_code == 403
    assert res.json()["error"]["code"] == "FORBIDDEN_ROLE"


def test_double_confirm_only_one_succeeds():
    coordinator = register("coordinator")
    rider = register("rider")
    trip = create_trip(coordinator["token"])
    seat_id = seat_ids_for(trip["id"])[0]
    hold = hold_seat(rider["token"], seat_id)

    first = client.post("/reservations", json={"hold_id": hold["id"]}, headers=auth_header(rider["token"]))
    assert first.status_code == 201

    second = client.post("/reservations", json={"hold_id": hold["id"]}, headers=auth_header(rider["token"]))
    assert second.status_code == 404
    assert second.json()["error"]["code"] == "NOT_FOUND"
