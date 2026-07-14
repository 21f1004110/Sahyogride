# This is the second star test - CLAUDE.md rule #3: the app must work
# completely with AI switched off. A regression here is a blocker for any
# further AI ticket, same as test_concurrency.py is for the booking core.

import uuid

from fastapi.testclient import TestClient

from app.config import settings
from app.database import SessionLocal
from app.main import app
from app.models import Seat

client = TestClient(app)


def unique_email(prefix: str) -> str:
    return f"{prefix}.{uuid.uuid4().hex[:12]}@example.com"


def seat_ids_for(trip_id: int) -> list[int]:
    db = SessionLocal()
    try:
        seats = db.query(Seat).filter(Seat.trip_id == trip_id).order_by(Seat.seat_number).all()
        return [s.id for s in seats]
    finally:
        db.close()


def test_app_works_completely_with_ai_disabled(monkeypatch):
    monkeypatch.setattr(settings, "ai_enabled", False)

    # register: coordinator and rider
    coordinator_res = client.post(
        "/auth/register",
        json={
            "name": "Coordinator",
            "email": unique_email("coordinator"),
            "password": "password123",
            "role": "coordinator",
        },
    )
    assert coordinator_res.status_code == 201, coordinator_res.text
    coordinator_token = coordinator_res.json()["token"]

    rider_res = client.post(
        "/auth/register",
        json={
            "name": "Rider",
            "email": unique_email("rider"),
            "password": "password123",
            "role": "rider",
        },
    )
    assert rider_res.status_code == 201, rider_res.text
    rider_token = rider_res.json()["token"]

    def auth(token: str) -> dict:
        return {"Authorization": f"Bearer {token}"}

    # create a trip (coordinator)
    trip_res = client.post(
        "/trips",
        json={
            "origin": "City Hospital",
            "destination": "Railway Station",
            "departure_time": "2026-07-15T09:30:00Z",
            "total_seats": 2,
            "purpose": "medical",
        },
        headers=auth(coordinator_token),
    )
    assert trip_res.status_code == 201, trip_res.text
    trip_id = trip_res.json()["id"]

    # search (rider)
    search_res = client.get("/trips", params={"destination": "Railway Station"}, headers=auth(rider_token))
    assert search_res.status_code == 200, search_res.text
    assert any(t["id"] == trip_id for t in search_res.json()["trips"])

    # hold (rider)
    seat_id = seat_ids_for(trip_id)[0]
    hold_res = client.post("/holds", json={"seat_id": seat_id}, headers=auth(rider_token))
    assert hold_res.status_code == 201, hold_res.text
    hold_id = hold_res.json()["id"]

    # confirm (rider)
    confirm_res = client.post("/reservations", json={"hold_id": hold_id}, headers=auth(rider_token))
    assert confirm_res.status_code == 201, confirm_res.text
    reservation_id = confirm_res.json()["id"]
    assert confirm_res.json()["status"] == "confirmed"

    # cancel (rider)
    cancel_res = client.post(f"/reservations/{reservation_id}/cancel", headers=auth(rider_token))
    assert cancel_res.status_code == 200, cancel_res.text
    assert cancel_res.json()["status"] == "cancelled"
