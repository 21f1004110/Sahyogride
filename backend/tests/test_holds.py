import uuid

from fastapi.testclient import TestClient

from app.database import SessionLocal
from app.main import app
from app.models import Hold, Seat, SeatStatus

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


def test_hold_seat_success():
    coordinator = register("coordinator")
    rider = register("rider")
    trip = create_trip(coordinator["token"])
    seat_id = seat_ids_for(trip["id"])[0]

    res = client.post("/holds", json={"seat_id": seat_id}, headers=auth_header(rider["token"]))
    assert res.status_code == 201, res.text
    body = res.json()
    assert body["seat_id"] == seat_id
    assert body["trip_id"] == trip["id"]
    assert body["rider_id"] == rider["user"]["id"]
    assert body["expires_at"]


def test_hold_seat_conflict_returns_seat_unavailable():
    coordinator = register("coordinator")
    rider_a = register("rider")
    rider_b = register("rider")
    trip = create_trip(coordinator["token"])
    seat_id = seat_ids_for(trip["id"])[0]

    res_a = client.post("/holds", json={"seat_id": seat_id}, headers=auth_header(rider_a["token"]))
    assert res_a.status_code == 201

    res_b = client.post("/holds", json={"seat_id": seat_id}, headers=auth_header(rider_b["token"]))
    assert res_b.status_code == 409
    assert res_b.json()["error"]["code"] == "SEAT_UNAVAILABLE"


def test_hold_seat_already_holding_returns_409():
    coordinator = register("coordinator")
    rider = register("rider")
    trip = create_trip(coordinator["token"])
    seats = seat_ids_for(trip["id"])

    res_first = client.post("/holds", json={"seat_id": seats[0]}, headers=auth_header(rider["token"]))
    assert res_first.status_code == 201

    res_second = client.post("/holds", json={"seat_id": seats[1]}, headers=auth_header(rider["token"]))
    assert res_second.status_code == 409
    assert res_second.json()["error"]["code"] == "ALREADY_HOLDING"


def test_hold_seat_forbidden_for_coordinator():
    coordinator = register("coordinator")
    trip = create_trip(coordinator["token"])
    seat_id = seat_ids_for(trip["id"])[0]

    res = client.post("/holds", json={"seat_id": seat_id}, headers=auth_header(coordinator["token"]))
    assert res.status_code == 403
    assert res.json()["error"]["code"] == "FORBIDDEN_ROLE"


def test_hold_seat_not_found():
    rider = register("rider")
    res = client.post("/holds", json={"seat_id": 999999999}, headers=auth_header(rider["token"]))
    assert res.status_code == 404
    assert res.json()["error"]["code"] == "NOT_FOUND"


def test_release_hold_frees_seat():
    coordinator = register("coordinator")
    rider = register("rider")
    trip = create_trip(coordinator["token"])
    seat_id = seat_ids_for(trip["id"])[0]

    hold_res = client.post("/holds", json={"seat_id": seat_id}, headers=auth_header(rider["token"]))
    hold_id = hold_res.json()["id"]

    res = client.delete(f"/holds/{hold_id}", headers=auth_header(rider["token"]))
    assert res.status_code == 204

    db = SessionLocal()
    try:
        assert db.get(Hold, hold_id) is None
        seat = db.get(Seat, seat_id)
        assert seat.status == SeatStatus.AVAILABLE
    finally:
        db.close()


def test_release_hold_not_owner():
    coordinator = register("coordinator")
    rider_a = register("rider")
    rider_b = register("rider")
    trip = create_trip(coordinator["token"])
    seat_id = seat_ids_for(trip["id"])[0]

    hold_res = client.post("/holds", json={"seat_id": seat_id}, headers=auth_header(rider_a["token"]))
    hold_id = hold_res.json()["id"]

    res = client.delete(f"/holds/{hold_id}", headers=auth_header(rider_b["token"]))
    assert res.status_code == 403
    assert res.json()["error"]["code"] == "NOT_OWNER"


def test_release_hold_not_found():
    rider = register("rider")
    res = client.delete("/holds/999999999", headers=auth_header(rider["token"]))
    assert res.status_code == 404
    assert res.json()["error"]["code"] == "NOT_FOUND"


def test_release_hold_lets_another_rider_hold_the_freed_seat():
    coordinator = register("coordinator")
    rider_a = register("rider")
    rider_b = register("rider")
    trip = create_trip(coordinator["token"])
    seat_id = seat_ids_for(trip["id"])[0]

    hold_res = client.post("/holds", json={"seat_id": seat_id}, headers=auth_header(rider_a["token"]))
    hold_id = hold_res.json()["id"]
    client.delete(f"/holds/{hold_id}", headers=auth_header(rider_a["token"]))

    res = client.post("/holds", json={"seat_id": seat_id}, headers=auth_header(rider_b["token"]))
    assert res.status_code == 201
