import uuid

from fastapi.testclient import TestClient

from app.database import SessionLocal
from app.main import app
from app.models import Seat, SeatStatus
from app.services import ai_service
from app.services.ai_service import SeatRecommendationResult

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


def seat_numbers_for(trip_id: int) -> list[str]:
    db = SessionLocal()
    try:
        seats = db.query(Seat).filter(Seat.trip_id == trip_id).order_by(Seat.seat_number).all()
        return [s.seat_number for s in seats]
    finally:
        db.close()


def test_recommendation_returns_ai_pick_when_it_is_actually_available(monkeypatch):
    fake_result = SeatRecommendationResult(seat_number="2", reason="Aisle seat, easy to reach.")
    monkeypatch.setattr(ai_service, "recommend_seat", lambda note, seats: fake_result)

    coordinator = register("coordinator")
    rider = register("rider")
    trip = create_trip(coordinator["token"])

    res = client.post(
        f"/trips/{trip['id']}/seat-recommendation",
        json={"note": "I use a wheelchair"},
        headers=auth_header(rider["token"]),
    )
    assert res.status_code == 200
    body = res.json()
    assert body["seat_number"] == "2"
    assert body["reason"] == "Aisle seat, easy to reach."
    assert body["fallback"] is False


def test_recommendation_falls_back_when_ai_picks_an_unavailable_seat(monkeypatch):
    # Hallucinated / stale seat_number that isn't in the trip's actual
    # available set - must never be trusted or returned as-is.
    fake_result = SeatRecommendationResult(seat_number="999", reason="Made up.")
    monkeypatch.setattr(ai_service, "recommend_seat", lambda note, seats: fake_result)

    coordinator = register("coordinator")
    rider = register("rider")
    trip = create_trip(coordinator["token"], total_seats=3)

    res = client.post(
        f"/trips/{trip['id']}/seat-recommendation",
        json={"note": "anything"},
        headers=auth_header(rider["token"]),
    )
    assert res.status_code == 200
    body = res.json()
    assert body["fallback"] is True
    assert body["seat_number"] == "1"  # lowest-numbered available seat


def test_recommendation_falls_back_when_ai_disabled(monkeypatch):
    monkeypatch.setattr(ai_service, "recommend_seat", lambda note, seats: None)

    coordinator = register("coordinator")
    rider = register("rider")
    trip = create_trip(coordinator["token"])

    res = client.post(
        f"/trips/{trip['id']}/seat-recommendation",
        json={"note": "anything"},
        headers=auth_header(rider["token"]),
    )
    assert res.status_code == 200
    body = res.json()
    assert body["fallback"] is True
    assert body["seat_number"] == "1"


def test_recommendation_returns_nulls_when_no_seats_available(monkeypatch):
    coordinator = register("coordinator")
    rider = register("rider")
    trip = create_trip(coordinator["token"], total_seats=1)

    db = SessionLocal()
    try:
        seat = db.query(Seat).filter(Seat.trip_id == trip["id"]).first()
        seat.status = SeatStatus.RESERVED
        db.commit()
    finally:
        db.close()

    res = client.post(
        f"/trips/{trip['id']}/seat-recommendation",
        json={"note": "anything"},
        headers=auth_header(rider["token"]),
    )
    assert res.status_code == 200
    body = res.json()
    assert body == {"seat_number": None, "reason": None, "fallback": True}


def test_recommendation_never_holds_the_seat_itself(monkeypatch):
    fake_result = SeatRecommendationResult(seat_number="1", reason="Front row.")
    monkeypatch.setattr(ai_service, "recommend_seat", lambda note, seats: fake_result)

    coordinator = register("coordinator")
    rider = register("rider")
    trip = create_trip(coordinator["token"])

    client.post(
        f"/trips/{trip['id']}/seat-recommendation",
        json={"note": "anything"},
        headers=auth_header(rider["token"]),
    )

    db = SessionLocal()
    try:
        seat = db.query(Seat).filter(Seat.trip_id == trip["id"], Seat.seat_number == "1").first()
        assert seat.status == SeatStatus.AVAILABLE  # untouched - suggestion only
    finally:
        db.close()


def test_recommendation_forbidden_for_coordinator():
    coordinator = register("coordinator")
    trip = create_trip(coordinator["token"])

    res = client.post(
        f"/trips/{trip['id']}/seat-recommendation",
        json={"note": "anything"},
        headers=auth_header(coordinator["token"]),
    )
    assert res.status_code == 403
    assert res.json()["error"]["code"] == "FORBIDDEN_ROLE"


def test_recommendation_not_found_for_missing_trip():
    rider = register("rider")
    res = client.post(
        "/trips/999999/seat-recommendation",
        json={"note": "anything"},
        headers=auth_header(rider["token"]),
    )
    assert res.status_code == 404


def test_recommendation_rejects_empty_note():
    rider = register("rider")
    coordinator = register("coordinator")
    trip = create_trip(coordinator["token"])
    res = client.post(
        f"/trips/{trip['id']}/seat-recommendation",
        json={"note": ""},
        headers=auth_header(rider["token"]),
    )
    assert res.status_code == 422


def test_recommendation_requires_auth():
    res = client.post("/trips/1/seat-recommendation", json={"note": "anything"})
    assert res.status_code == 401
