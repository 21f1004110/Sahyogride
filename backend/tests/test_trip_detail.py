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


def create_trip(coordinator_token: str, total_seats: int = 12) -> dict:
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


def test_get_trip_detail_requires_auth():
    res = client.get("/trips/1")
    assert res.status_code == 401
    assert res.json()["error"]["code"] == "UNAUTHENTICATED"


def test_get_trip_detail_not_found():
    rider = register("rider")
    res = client.get("/trips/99999999", headers=auth_header(rider["token"]))
    assert res.status_code == 404
    assert res.json()["error"]["code"] == "NOT_FOUND"


def test_get_trip_detail_returns_seats_in_numeric_order():
    coordinator = register("coordinator")
    rider = register("rider")
    trip = create_trip(coordinator["token"], total_seats=12)

    res = client.get(f"/trips/{trip['id']}", headers=auth_header(rider["token"]))
    assert res.status_code == 200
    body = res.json()
    assert body["id"] == trip["id"]
    assert body["total_seats"] == 12
    assert [s["seat_number"] for s in body["seats"]] == [str(n) for n in range(1, 13)]
    assert all(s["status"] == "available" and s["held_by_me"] is False for s in body["seats"])


def test_held_by_me_true_only_for_the_holding_rider():
    coordinator = register("coordinator")
    rider_a = register("rider")
    rider_b = register("rider")
    trip = create_trip(coordinator["token"])

    db = SessionLocal()
    try:
        seat = db.query(Seat).filter(Seat.trip_id == trip["id"]).order_by(Seat.seat_number).first()
        seat.status = SeatStatus.HELD
        db.add(
            Hold(
                seat_id=seat.id,
                trip_id=trip["id"],
                rider_id=rider_a["user"]["id"],
                expires_at=datetime.now(timezone.utc) + timedelta(minutes=5),
            )
        )
        db.commit()
        held_seat_id = seat.id
    finally:
        db.close()

    res_a = client.get(f"/trips/{trip['id']}", headers=auth_header(rider_a["token"]))
    seat_a = next(s for s in res_a.json()["seats"] if s["id"] == held_seat_id)
    assert seat_a["status"] == "held"
    assert seat_a["held_by_me"] is True

    res_b = client.get(f"/trips/{trip['id']}", headers=auth_header(rider_b["token"]))
    seat_b = next(s for s in res_b.json()["seats"] if s["id"] == held_seat_id)
    assert seat_b["status"] == "held"
    assert seat_b["held_by_me"] is False


def test_reserved_seat_shows_reserved_status():
    coordinator = register("coordinator")
    rider = register("rider")
    viewer = register("rider")
    trip = create_trip(coordinator["token"])

    db = SessionLocal()
    try:
        seat = db.query(Seat).filter(Seat.trip_id == trip["id"]).order_by(Seat.seat_number).first()
        seat.status = SeatStatus.RESERVED
        db.add(
            Reservation(
                seat_id=seat.id,
                trip_id=trip["id"],
                rider_id=rider["user"]["id"],
                status=ReservationStatus.CONFIRMED,
            )
        )
        db.commit()
        reserved_seat_id = seat.id
    finally:
        db.close()

    res = client.get(f"/trips/{trip['id']}", headers=auth_header(viewer["token"]))
    seat_out = next(s for s in res.json()["seats"] if s["id"] == reserved_seat_id)
    assert seat_out["status"] == "reserved"
    assert seat_out["held_by_me"] is False
