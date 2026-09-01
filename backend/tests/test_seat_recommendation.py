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


# ── Fallback effectiveness (SAHYOG-38 follow-up) ──────────────────────
# The fallback below runs whenever the real AI is unavailable - which is
# always, in an environment with no AI_API_KEY configured. These tests
# monkeypatch ai_service.recommend_seat to None explicitly (rather than
# relying on the environment having no key) so they stay meaningful even
# if a real key is ever configured for this test run. All use a 20-seat
# trip (5 rows of 4) so front/back and window/aisle differences actually
# exist to pick between.


def _seat_position(seat_number: str) -> dict:
    idx = int(seat_number) - 1
    row = idx // 4 + 1
    col = idx % 4
    edge = "window" if col in (0, 3) else "aisle"
    return {"row": row, "edge": edge}


def test_recommendation_fallback_wheelchair_prefers_aisle_seat_near_front(monkeypatch):
    monkeypatch.setattr(ai_service, "recommend_seat", lambda note, seats: None)
    coordinator = register("coordinator")
    rider = register("rider")
    trip = create_trip(coordinator["token"], total_seats=20)

    res = client.post(
        f"/trips/{trip['id']}/seat-recommendation",
        json={"note": "I use a wheelchair"},
        headers=auth_header(rider["token"]),
    )
    assert res.status_code == 200
    body = res.json()
    assert body["fallback"] is True
    pos = _seat_position(body["seat_number"])
    assert pos["edge"] == "aisle"
    assert pos["row"] == 1
    assert "aisle" in body["reason"].lower()


def test_recommendation_fallback_elderly_companion_prefers_aisle_seat_near_front(monkeypatch):
    monkeypatch.setattr(ai_service, "recommend_seat", lambda note, seats: None)
    coordinator = register("coordinator")
    rider = register("rider")
    trip = create_trip(coordinator["token"], total_seats=20)

    res = client.post(
        f"/trips/{trip['id']}/seat-recommendation",
        json={"note": "travelling with my elderly grandmother"},
        headers=auth_header(rider["token"]),
    )
    assert res.status_code == 200
    body = res.json()
    pos = _seat_position(body["seat_number"])
    assert pos["edge"] == "aisle"
    assert pos["row"] == 1


def test_recommendation_fallback_window_request_prefers_window_seat(monkeypatch):
    monkeypatch.setattr(ai_service, "recommend_seat", lambda note, seats: None)
    coordinator = register("coordinator")
    rider = register("rider")
    trip = create_trip(coordinator["token"], total_seats=20)

    res = client.post(
        f"/trips/{trip['id']}/seat-recommendation",
        json={"note": "I'd like a window seat please"},
        headers=auth_header(rider["token"]),
    )
    assert res.status_code == 200
    body = res.json()
    pos = _seat_position(body["seat_number"])
    assert pos["edge"] == "window"
    assert "window" in body["reason"].lower()


def test_recommendation_fallback_child_prefers_window_seat(monkeypatch):
    monkeypatch.setattr(ai_service, "recommend_seat", lambda note, seats: None)
    coordinator = register("coordinator")
    rider = register("rider")
    trip = create_trip(coordinator["token"], total_seats=20)

    res = client.post(
        f"/trips/{trip['id']}/seat-recommendation",
        json={"note": "travelling with a toddler"},
        headers=auth_header(rider["token"]),
    )
    assert res.status_code == 200
    body = res.json()
    pos = _seat_position(body["seat_number"])
    assert pos["edge"] == "window"


def test_recommendation_fallback_motion_sickness_prefers_front_row(monkeypatch):
    monkeypatch.setattr(ai_service, "recommend_seat", lambda note, seats: None)
    coordinator = register("coordinator")
    rider = register("rider")
    trip = create_trip(coordinator["token"], total_seats=20)

    res = client.post(
        f"/trips/{trip['id']}/seat-recommendation",
        json={"note": "I get really bad motion sickness"},
        headers=auth_header(rider["token"]),
    )
    assert res.status_code == 200
    body = res.json()
    pos = _seat_position(body["seat_number"])
    assert pos["row"] == 1
    assert "front" in body["reason"].lower()


def test_recommendation_fallback_aisle_request_prefers_aisle_seat(monkeypatch):
    monkeypatch.setattr(ai_service, "recommend_seat", lambda note, seats: None)
    coordinator = register("coordinator")
    rider = register("rider")
    trip = create_trip(coordinator["token"], total_seats=20)

    res = client.post(
        f"/trips/{trip['id']}/seat-recommendation",
        json={"note": "I need extra leg room, an aisle seat"},
        headers=auth_header(rider["token"]),
    )
    assert res.status_code == 200
    body = res.json()
    pos = _seat_position(body["seat_number"])
    assert pos["edge"] == "aisle"


def test_recommendation_fallback_prefers_available_aisle_seat_over_taken_one(monkeypatch):
    """The front-row aisle seats are already taken - the wheelchair
    preference must still land on an actually-available aisle seat, not
    just report failure or silently ignore the preference."""
    monkeypatch.setattr(ai_service, "recommend_seat", lambda note, seats: None)
    coordinator = register("coordinator")
    rider = register("rider")
    trip = create_trip(coordinator["token"], total_seats=20)

    # Reserve both row-1 aisle seats (seat numbers "2" and "3") so the
    # heuristic has to look further back.
    db = SessionLocal()
    try:
        for seat in db.query(Seat).filter(Seat.trip_id == trip["id"], Seat.seat_number.in_(["2", "3"])).all():
            seat.status = SeatStatus.RESERVED
        db.commit()
    finally:
        db.close()

    res = client.post(
        f"/trips/{trip['id']}/seat-recommendation",
        json={"note": "I use a wheelchair"},
        headers=auth_header(rider["token"]),
    )
    assert res.status_code == 200
    body = res.json()
    pos = _seat_position(body["seat_number"])
    assert pos["edge"] == "aisle"
    assert pos["row"] == 2  # nearest still-available aisle row
    assert body["seat_number"] in {"6", "7"}


def test_recommendation_fallback_no_keyword_match_still_picks_nearest_seat(monkeypatch):
    """No recognised need in the note - falls back to plain nearest-
    available, same guarantee as before this heuristic existed."""
    monkeypatch.setattr(ai_service, "recommend_seat", lambda note, seats: None)
    coordinator = register("coordinator")
    rider = register("rider")
    trip = create_trip(coordinator["token"], total_seats=20)

    res = client.post(
        f"/trips/{trip['id']}/seat-recommendation",
        json={"note": "no particular preference, anything works"},
        headers=auth_header(rider["token"]),
    )
    assert res.status_code == 200
    body = res.json()
    assert body["seat_number"] == "1"
    assert "nearest available" in body["reason"].lower()
