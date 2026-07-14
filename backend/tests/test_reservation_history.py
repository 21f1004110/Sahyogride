import uuid

from fastapi.testclient import TestClient

from app.database import SessionLocal
from app.main import app
from app.models import Seat

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


def hold_and_confirm(rider_token: str, seat_id: int) -> dict:
    hold_res = client.post("/holds", json={"seat_id": seat_id}, headers=auth_header(rider_token))
    assert hold_res.status_code == 201, hold_res.text
    confirm_res = client.post(
        "/reservations", json={"hold_id": hold_res.json()["id"]}, headers=auth_header(rider_token)
    )
    assert confirm_res.status_code == 201, confirm_res.text
    return confirm_res.json()


def test_my_reservations_empty_for_new_rider():
    rider = register("rider")
    res = client.get("/reservations/me", headers=auth_header(rider["token"]))
    assert res.status_code == 200
    assert res.json() == {"reservations": []}


def test_my_reservations_includes_confirmed_and_cancelled():
    coordinator = register("coordinator")
    rider = register("rider")
    trip = create_trip(coordinator["token"], total_seats=2)
    seats = seat_ids_for(trip["id"])

    confirmed = hold_and_confirm(rider["token"], seats[0])
    cancelled = hold_and_confirm(rider["token"], seats[1])
    client.post(f"/reservations/{cancelled['id']}/cancel", headers=auth_header(rider["token"]))

    res = client.get("/reservations/me", headers=auth_header(rider["token"]))
    assert res.status_code == 200
    items = {r["id"]: r for r in res.json()["reservations"]}

    assert items[confirmed["id"]]["status"] == "confirmed"
    assert items[confirmed["id"]]["cancelled_at"] is None
    assert items[confirmed["id"]]["trip_id"] == trip["id"]
    assert items[confirmed["id"]]["seat_number"]

    assert items[cancelled["id"]]["status"] == "cancelled"
    assert items[cancelled["id"]]["cancelled_at"] is not None


def test_my_reservations_only_shows_the_caller_own_reservations():
    coordinator = register("coordinator")
    rider_a = register("rider")
    rider_b = register("rider")
    trip = create_trip(coordinator["token"])
    seat_id = seat_ids_for(trip["id"])[0]
    hold_and_confirm(rider_a["token"], seat_id)

    res = client.get("/reservations/me", headers=auth_header(rider_b["token"]))
    assert res.status_code == 200
    assert res.json() == {"reservations": []}


def test_my_reservations_forbidden_for_coordinator():
    coordinator = register("coordinator")
    res = client.get("/reservations/me", headers=auth_header(coordinator["token"]))
    assert res.status_code == 403
    assert res.json()["error"]["code"] == "FORBIDDEN_ROLE"


def test_my_reservations_requires_auth():
    res = client.get("/reservations/me")
    assert res.status_code == 401
