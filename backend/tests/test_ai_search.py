import uuid

from fastapi.testclient import TestClient

from app.config import settings
from app.database import SessionLocal
from app.main import app
from app.models import Trip
from app.services import ai_service

client = TestClient(app)

VEC_DIM = 1536


def unit_vector(index: int) -> list[float]:
    v = [0.0] * VEC_DIM
    v[index] = 1.0
    return v


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


def create_trip(
    coordinator_token: str,
    origin: str = "City Hospital",
    destination: str = "Railway Station",
    purpose: str = "medical",
    total_seats: int = 2,
) -> dict:
    payload = {
        "origin": origin,
        "destination": destination,
        "departure_time": "2026-07-15T09:30:00Z",
        "total_seats": total_seats,
        "purpose": purpose,
    }
    res = client.post("/trips", json=payload, headers=auth_header(coordinator_token))
    assert res.status_code == 201, res.text
    return res.json()


def test_create_trip_populates_embedding_when_ai_succeeds(monkeypatch):
    monkeypatch.setattr(ai_service, "embed_text", lambda text: unit_vector(0))

    coordinator = register("coordinator")
    trip = create_trip(coordinator["token"])

    db = SessionLocal()
    try:
        row = db.get(Trip, trip["id"])
        assert row.embedding is not None
        assert len(row.embedding) == VEC_DIM
    finally:
        db.close()


def test_create_trip_leaves_embedding_null_when_ai_disabled(monkeypatch):
    monkeypatch.setattr(settings, "ai_enabled", False)

    coordinator = register("coordinator")
    trip = create_trip(coordinator["token"])

    db = SessionLocal()
    try:
        row = db.get(Trip, trip["id"])
        assert row.embedding is None
    finally:
        db.close()


def test_ai_search_falls_back_to_keyword_search_when_ai_disabled(monkeypatch):
    monkeypatch.setattr(settings, "ai_enabled", False)

    coordinator = register("coordinator")
    rider = register("rider")
    trip = create_trip(coordinator["token"], destination=f"UniqueDest-{uuid.uuid4().hex[:8]}")

    res = client.post(
        "/ai/search", json={"query": trip["destination"]}, headers=auth_header(rider["token"])
    )
    assert res.status_code == 200
    body = res.json()
    assert body["fallback"] is True
    assert any(t["id"] == trip["id"] for t in body["trips"])


def test_ai_search_returns_semantic_matches_above_threshold(monkeypatch):
    monkeypatch.setattr(ai_service, "embed_text", lambda text: unit_vector(0))

    coordinator = register("coordinator")
    rider = register("rider")
    trip = create_trip(coordinator["token"])

    res = client.post(
        "/ai/search", json={"query": "a ride to the hospital"}, headers=auth_header(rider["token"])
    )
    assert res.status_code == 200
    body = res.json()
    assert body["fallback"] is False
    assert any(t["id"] == trip["id"] for t in body["trips"])


def test_ai_search_excludes_trips_below_threshold(monkeypatch):
    coordinator = register("coordinator")
    rider = register("rider")

    monkeypatch.setattr(ai_service, "embed_text", lambda text: unit_vector(1))
    trip = create_trip(coordinator["token"])

    # Orthogonal to the trip's embedding -> cosine distance 1.0, well
    # outside the default SEMANTIC_THRESHOLD (0.5).
    monkeypatch.setattr(ai_service, "embed_text", lambda text: unit_vector(2))
    res = client.post(
        "/ai/search", json={"query": "completely unrelated query"}, headers=auth_header(rider["token"])
    )
    assert res.status_code == 200
    body = res.json()
    assert body["fallback"] is False
    assert not any(t["id"] == trip["id"] for t in body["trips"])


def test_ai_search_requires_auth():
    res = client.post("/ai/search", json={"query": "anything"})
    assert res.status_code == 401


def test_ai_search_rejects_empty_query():
    rider = register("rider")
    res = client.post("/ai/search", json={"query": ""}, headers=auth_header(rider["token"]))
    assert res.status_code == 422
