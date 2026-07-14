import uuid

from fastapi.testclient import TestClient

from app.config import settings
from app.database import SessionLocal
from app.main import app
from app.models import Reservation, Seat
from app.services import ai_service
from app.services.ai_service import ReservationTriageResult

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


def create_trip(coordinator_token: str, purpose: str = "medical", total_seats: int = 4) -> dict:
    payload = {
        "origin": "City Hospital",
        "destination": "Railway Station",
        "departure_time": "2026-07-15T09:30:00Z",
        "total_seats": total_seats,
        "purpose": purpose,
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


def confirm_reservation_for(rider_token: str, seat_id: int) -> dict:
    hold_res = client.post("/holds", json={"seat_id": seat_id}, headers=auth_header(rider_token))
    assert hold_res.status_code == 201, hold_res.text
    confirm_res = client.post(
        "/reservations", json={"hold_id": hold_res.json()["id"]}, headers=auth_header(rider_token)
    )
    assert confirm_res.status_code == 201, confirm_res.text
    return confirm_res.json()


def test_confirm_reservation_populates_ai_fields_when_triage_succeeds(monkeypatch):
    fake_result = ReservationTriageResult(urgency_label="high", urgency_score=0.9)
    monkeypatch.setattr(ai_service, "triage_reservation_urgency", lambda purpose: fake_result)

    coordinator = register("coordinator")
    rider = register("rider")
    trip = create_trip(coordinator["token"], purpose="dialysis")
    seat_id = seat_ids_for(trip["id"])[0]

    reservation = confirm_reservation_for(rider["token"], seat_id)

    db = SessionLocal()
    try:
        row = db.get(Reservation, reservation["id"])
        assert row.ai_urgency_label == "high"
        assert row.ai_urgency_score == 0.9
        assert row.ai_triage_completed_at is not None
    finally:
        db.close()


def test_confirm_reservation_leaves_ai_fields_null_when_triage_returns_none(monkeypatch):
    monkeypatch.setattr(ai_service, "triage_reservation_urgency", lambda purpose: None)

    coordinator = register("coordinator")
    rider = register("rider")
    trip = create_trip(coordinator["token"])
    seat_id = seat_ids_for(trip["id"])[0]

    reservation = confirm_reservation_for(rider["token"], seat_id)
    assert reservation["status"] == "confirmed"  # endpoint still succeeds

    db = SessionLocal()
    try:
        row = db.get(Reservation, reservation["id"])
        assert row.ai_urgency_label is None
        assert row.ai_urgency_score is None
        assert row.ai_triage_completed_at is None
    finally:
        db.close()


def test_confirm_reservation_succeeds_with_ai_disabled(monkeypatch):
    monkeypatch.setattr(settings, "ai_enabled", False)

    coordinator = register("coordinator")
    rider = register("rider")
    trip = create_trip(coordinator["token"])
    seat_id = seat_ids_for(trip["id"])[0]

    reservation = confirm_reservation_for(rider["token"], seat_id)
    assert reservation["status"] == "confirmed"

    db = SessionLocal()
    try:
        row = db.get(Reservation, reservation["id"])
        assert row.ai_urgency_label is None
    finally:
        db.close()


def test_triage_never_touches_seat_or_hold_state(monkeypatch):
    """AI has zero write powers beyond its own ai_* columns - confirm the
    seat stays exactly RESERVED (from confirm_reservation, not the triage
    background task) regardless of what triage returns.
    """
    fake_result = ReservationTriageResult(urgency_label="low", urgency_score=0.1)
    monkeypatch.setattr(ai_service, "triage_reservation_urgency", lambda purpose: fake_result)

    coordinator = register("coordinator")
    rider = register("rider")
    trip = create_trip(coordinator["token"])
    seat_id = seat_ids_for(trip["id"])[0]

    confirm_reservation_for(rider["token"], seat_id)

    db = SessionLocal()
    try:
        seat = db.get(Seat, seat_id)
        assert seat.status.value == "reserved"
    finally:
        db.close()
