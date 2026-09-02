import uuid

from fastapi.testclient import TestClient

from app.main import app
from app.services import ai_service
from app.services.ai_service import TripDraftResult

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


def test_draft_uses_ai_result_when_available(monkeypatch):
    fake_result = TripDraftResult(
        origin="City Hospital",
        destination="Metro Station",
        departure_date="2026-08-14",
        departure_time="09:00",
        purpose="medical",
        total_seats=30,
    )
    monkeypatch.setattr(ai_service, "parse_trip_description", lambda description, today: fake_result)

    coordinator = register("coordinator")
    res = client.post(
        "/trips/draft",
        json={"description": "Shuttle for dialysis patients, City Hospital to Metro Station, 30 seats"},
        headers=auth_header(coordinator["token"]),
    )
    assert res.status_code == 200
    body = res.json()
    assert body["fallback"] is False
    assert body["origin"] == "City Hospital"
    assert body["destination"] == "Metro Station"
    assert body["departure_date"] == "2026-08-14"
    assert body["departure_time"] == "09:00"
    assert body["purpose"] == "medical"
    assert body["total_seats"] == 30


def test_draft_falls_back_to_deterministic_parsing_when_ai_unavailable(monkeypatch):
    monkeypatch.setattr(ai_service, "parse_trip_description", lambda description, today: None)

    coordinator = register("coordinator")
    res = client.post(
        "/trips/draft",
        json={"description": "Shuttle from City Hospital to Metro Station tomorrow morning, 25 seats"},
        headers=auth_header(coordinator["token"]),
    )
    assert res.status_code == 200
    body = res.json()
    assert body["fallback"] is True
    assert body["origin"] == "City Hospital"
    assert body["destination"] == "Metro Station"
    assert body["total_seats"] == 25
    assert body["departure_date"] is not None
    assert body["departure_time"] == "09:00"


def test_draft_fallback_never_invents_a_route_it_cannot_find(monkeypatch):
    """A description with no clear 'from X to Y' shape should leave
    origin/destination null rather than guessing - a wrong prefill is
    worse than an empty field, since the coordinator might not notice
    and publish the wrong route."""
    monkeypatch.setattr(ai_service, "parse_trip_description", lambda description, today: None)

    coordinator = register("coordinator")
    res = client.post(
        "/trips/draft",
        json={"description": "Medical trip this Friday evening"},
        headers=auth_header(coordinator["token"]),
    )
    assert res.status_code == 200
    body = res.json()
    assert body["fallback"] is True
    assert body["origin"] is None
    assert body["destination"] is None
    assert body["purpose"] == "medical"
    assert body["departure_time"] == "18:00"


def test_draft_requires_coordinator_role():
    rider = register("rider")
    res = client.post(
        "/trips/draft",
        json={"description": "City Hospital to Metro Station"},
        headers=auth_header(rider["token"]),
    )
    assert res.status_code == 403
    assert res.json()["error"]["code"] == "FORBIDDEN_ROLE"


def test_draft_rejects_blank_description():
    coordinator = register("coordinator")
    res = client.post("/trips/draft", json={"description": ""}, headers=auth_header(coordinator["token"]))
    assert res.status_code == 422


def test_draft_requires_auth():
    res = client.post("/trips/draft", json={"description": "City Hospital to Metro Station"})
    assert res.status_code == 401
