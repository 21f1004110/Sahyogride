import uuid

from fastapi.testclient import TestClient

from app.database import SessionLocal
from app.main import app
from app.models import Reservation, Seat
from app.services import ai_service
from app.services.ai_service import AccessibilityTagResult

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


def hold_and_confirm(rider_token: str, seat_id: int, notes: str | None = None) -> dict:
    hold_res = client.post("/holds", json={"seat_id": seat_id}, headers=auth_header(rider_token))
    assert hold_res.status_code == 201, hold_res.text
    body = {"hold_id": hold_res.json()["id"], "passenger_name": "Test Passenger", "passenger_phone": "9876543210"}
    if notes is not None:
        body["notes"] = notes
    confirm_res = client.post("/reservations", json=body, headers=auth_header(rider_token))
    assert confirm_res.status_code == 201, confirm_res.text
    return confirm_res.json()


def test_confirm_reservation_saves_accessibility_note_immediately():
    coordinator = register("coordinator")
    rider = register("rider")
    trip = create_trip(coordinator["token"])
    seat_id = seat_ids_for(trip["id"])[0]

    reservation = hold_and_confirm(rider["token"], seat_id, notes="I use a wheelchair")
    assert reservation["accessibility_note"] == "I use a wheelchair"

    db = SessionLocal()
    try:
        row = db.get(Reservation, reservation["id"])
        assert row.accessibility_note == "I use a wheelchair"
    finally:
        db.close()


def test_confirm_reservation_works_without_notes():
    coordinator = register("coordinator")
    rider = register("rider")
    trip = create_trip(coordinator["token"])
    seat_id = seat_ids_for(trip["id"])[0]

    reservation = hold_and_confirm(rider["token"], seat_id)
    assert reservation["accessibility_note"] is None


def test_note_classified_into_tag_when_ai_succeeds(monkeypatch):
    fake_result = AccessibilityTagResult(tag="wheelchair")
    monkeypatch.setattr(ai_service, "classify_accessibility_note", lambda note: fake_result)

    coordinator = register("coordinator")
    rider = register("rider")
    trip = create_trip(coordinator["token"])
    seat_id = seat_ids_for(trip["id"])[0]

    reservation = hold_and_confirm(rider["token"], seat_id, notes="I use a wheelchair")

    db = SessionLocal()
    try:
        row = db.get(Reservation, reservation["id"])
        assert row.ai_accessibility_tags == "wheelchair"
    finally:
        db.close()


def test_tag_stays_null_when_no_note_given(monkeypatch):
    called = []
    monkeypatch.setattr(
        ai_service, "classify_accessibility_note", lambda note: called.append(note) or None
    )

    coordinator = register("coordinator")
    rider = register("rider")
    trip = create_trip(coordinator["token"])
    seat_id = seat_ids_for(trip["id"])[0]

    reservation = hold_and_confirm(rider["token"], seat_id)

    db = SessionLocal()
    try:
        row = db.get(Reservation, reservation["id"])
        assert row.ai_accessibility_tags is None
    finally:
        db.close()
    assert called == [None]


def test_tag_stays_null_when_classification_fails(monkeypatch):
    monkeypatch.setattr(ai_service, "classify_accessibility_note", lambda note: None)

    coordinator = register("coordinator")
    rider = register("rider")
    trip = create_trip(coordinator["token"])
    seat_id = seat_ids_for(trip["id"])[0]

    reservation = hold_and_confirm(rider["token"], seat_id, notes="something unclear")
    assert reservation["status"] == "confirmed"  # endpoint still succeeds

    db = SessionLocal()
    try:
        row = db.get(Reservation, reservation["id"])
        assert row.ai_accessibility_tags is None
    finally:
        db.close()


def test_accessibility_tag_surfaced_in_passenger_list(monkeypatch):
    fake_result = AccessibilityTagResult(tag="elderly_support")
    monkeypatch.setattr(ai_service, "classify_accessibility_note", lambda note: fake_result)

    coordinator = register("coordinator")
    rider = register("rider")
    trip = create_trip(coordinator["token"])
    seat_id = seat_ids_for(trip["id"])[0]
    hold_and_confirm(rider["token"], seat_id, notes="elderly, needs boarding help")

    res = client.get(f"/trips/{trip['id']}/passengers", headers=auth_header(coordinator["token"]))
    assert res.status_code == 200
    passengers = res.json()["passengers"]
    assert passengers[0]["ai_accessibility_tags"] == "elderly_support"


def test_accessibility_note_max_length_enforced():
    coordinator = register("coordinator")
    rider = register("rider")
    trip = create_trip(coordinator["token"])
    seat_id = seat_ids_for(trip["id"])[0]

    hold_res = client.post("/holds", json={"seat_id": seat_id}, headers=auth_header(rider["token"]))
    res = client.post(
        "/reservations",
        json={
            "hold_id": hold_res.json()["id"],
            "notes": "x" * 501,
            "passenger_name": "Test Passenger",
            "passenger_phone": "9876543210",
        },
        headers=auth_header(rider["token"]),
    )
    assert res.status_code == 422
