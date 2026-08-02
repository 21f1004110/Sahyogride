import uuid

from fastapi.testclient import TestClient

from app.config import settings
from app.database import SessionLocal
from app.main import app
from app.models import Seat, Trip

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


def create_trip(coordinator_token: str, total_seats: int = 4, destination: str | None = None) -> dict:
    payload = {
        "origin": "City Hospital",
        "destination": destination or f"Dest-{uuid.uuid4().hex[:8]}",
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


def get_flag(trip_id: int) -> bool | None:
    db = SessionLocal()
    try:
        return db.get(Trip, trip_id).ai_high_demand
    finally:
        db.close()


def test_flag_stays_null_below_threshold():
    coordinator = register("coordinator")
    rider = register("rider")
    trip = create_trip(coordinator["token"], total_seats=4)
    seats = seat_ids_for(trip["id"])

    hold_and_confirm(rider["token"], seats[0])  # 1/4 = 25%, well below 75%
    assert get_flag(trip["id"]) is None


def test_flag_set_once_threshold_crossed():
    coordinator = register("coordinator")
    trip = create_trip(coordinator["token"], total_seats=4)
    seats = seat_ids_for(trip["id"])

    for i in range(3):  # 3/4 = 75% -> crosses HIGH_DEMAND_THRESHOLD
        rider = register("rider")
        hold_and_confirm(rider["token"], seats[i])

    assert get_flag(trip["id"]) is True


def test_flag_works_identically_with_ai_disabled(monkeypatch):
    # The flag is deterministic arithmetic, not an AI call - must be
    # unaffected by AI_ENABLED, unlike every other ai_* column.
    monkeypatch.setattr(settings, "ai_enabled", False)

    coordinator = register("coordinator")
    trip = create_trip(coordinator["token"], total_seats=4)
    seats = seat_ids_for(trip["id"])

    for i in range(3):
        rider = register("rider")
        hold_and_confirm(rider["token"], seats[i])

    assert get_flag(trip["id"]) is True


def test_flag_never_unflags_after_cancellation():
    coordinator = register("coordinator")
    trip = create_trip(coordinator["token"], total_seats=4)
    seats = seat_ids_for(trip["id"])

    riders_reservations = []
    for i in range(3):
        rider = register("rider")
        reservation = hold_and_confirm(rider["token"], seats[i])
        riders_reservations.append((rider, reservation))

    assert get_flag(trip["id"]) is True

    rider, reservation = riders_reservations[0]
    cancel_res = client.post(f"/reservations/{reservation['id']}/cancel", headers=auth_header(rider["token"]))
    assert cancel_res.status_code == 200

    assert get_flag(trip["id"]) is True  # still flagged, never reset


def test_flag_surfaced_in_my_trips():
    coordinator = register("coordinator")
    trip = create_trip(coordinator["token"], total_seats=2)
    seats = seat_ids_for(trip["id"])

    for i in range(2):  # 2/2 = 100%
        rider = register("rider")
        hold_and_confirm(rider["token"], seats[i])

    res = client.get("/trips/mine", headers=auth_header(coordinator["token"]))
    assert res.status_code == 200
    flagged = next(t for t in res.json()["trips"] if t["id"] == trip["id"])
    assert flagged["ai_high_demand"] is True


def test_flag_null_in_trip_search_when_not_flagged():
    coordinator = register("coordinator")
    rider = register("rider")
    trip = create_trip(coordinator["token"], total_seats=4)

    res = client.get("/trips", params={"destination": trip["destination"]}, headers=auth_header(rider["token"]))
    assert res.status_code == 200
    found = next(t for t in res.json()["trips"] if t["id"] == trip["id"])
    assert found["ai_high_demand"] is None
