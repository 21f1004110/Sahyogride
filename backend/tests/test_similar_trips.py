import uuid

from fastapi.testclient import TestClient

from app.database import SessionLocal
from app.main import app
from app.models import Trip

client = TestClient(app)

VEC_DIM = 1536


def unit_vector(index: int) -> list[float]:
    v = [0.0] * VEC_DIM
    v[index] = 1.0
    return v


def random_index() -> int:
    # Fresh index per call so tests don't collide with embeddings left by
    # other tests/runs on this shared, non-reset local test DB.
    return uuid.uuid4().int % VEC_DIM


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


def create_trip(coordinator_token: str, destination: str = "Railway Station", total_seats: int = 4) -> dict:
    payload = {
        "origin": "City Hospital",
        "destination": destination,
        "departure_time": "2026-07-15T09:30:00Z",
        "total_seats": total_seats,
        "purpose": "medical",
    }
    res = client.post("/trips", json=payload, headers=auth_header(coordinator_token))
    assert res.status_code == 201, res.text
    return res.json()


def set_embedding(trip_id: int, vector: list[float] | None) -> None:
    db = SessionLocal()
    try:
        trip = db.get(Trip, trip_id)
        trip.embedding = vector
        db.commit()
    finally:
        db.close()


def test_similar_trips_ranks_by_embedding_distance():
    coordinator = register("coordinator")
    rider = register("rider")

    target = create_trip(coordinator["token"], destination=f"Dest-{uuid.uuid4().hex[:8]}")
    close = create_trip(coordinator["token"], destination=f"Dest-{uuid.uuid4().hex[:8]}")
    far = create_trip(coordinator["token"], destination=f"Dest-{uuid.uuid4().hex[:8]}")

    idx = random_index()
    set_embedding(target["id"], unit_vector(idx))
    set_embedding(close["id"], unit_vector(idx))  # identical -> distance 0
    set_embedding(far["id"], unit_vector((idx + 1) % VEC_DIM))  # orthogonal -> distance 1.0, outside threshold

    res = client.get(f"/trips/{target['id']}/similar", headers=auth_header(rider["token"]))
    assert res.status_code == 200
    body = res.json()
    assert body["fallback"] is False
    ids = [t["id"] for t in body["trips"]]
    assert close["id"] in ids
    assert far["id"] not in ids
    assert target["id"] not in ids  # never suggests itself


def test_similar_trips_falls_back_to_same_destination_when_embedding_null():
    coordinator = register("coordinator")
    rider = register("rider")
    shared_destination = f"Dest-{uuid.uuid4().hex[:8]}"

    target = create_trip(coordinator["token"], destination=shared_destination)
    alt = create_trip(coordinator["token"], destination=shared_destination)
    # both left with embedding=None (no monkeypatched embed_text call happens
    # here at all - trip creation's background task has no AI key configured
    # in this test environment)

    res = client.get(f"/trips/{target['id']}/similar", headers=auth_header(rider["token"]))
    assert res.status_code == 200
    body = res.json()
    assert body["fallback"] is True
    assert any(t["id"] == alt["id"] for t in body["trips"])


def test_similar_trips_empty_when_no_match_and_no_fallback():
    coordinator = register("coordinator")
    rider = register("rider")
    target = create_trip(coordinator["token"], destination=f"Lonely-{uuid.uuid4().hex[:8]}")
    set_embedding(target["id"], unit_vector(random_index()))

    res = client.get(f"/trips/{target['id']}/similar", headers=auth_header(rider["token"]))
    assert res.status_code == 200
    body = res.json()
    assert body["trips"] == []


def test_similar_trips_respects_limit():
    coordinator = register("coordinator")
    rider = register("rider")
    idx = random_index()
    target = create_trip(coordinator["token"], destination=f"Dest-{uuid.uuid4().hex[:8]}")
    set_embedding(target["id"], unit_vector(idx))
    for _ in range(4):
        t = create_trip(coordinator["token"], destination=f"Dest-{uuid.uuid4().hex[:8]}")
        set_embedding(t["id"], unit_vector(idx))

    res = client.get(
        f"/trips/{target['id']}/similar", params={"limit": 2}, headers=auth_header(rider["token"])
    )
    assert res.status_code == 200
    assert len(res.json()["trips"]) == 2


def test_similar_trips_not_found_for_missing_trip():
    rider = register("rider")
    res = client.get("/trips/999999/similar", headers=auth_header(rider["token"]))
    assert res.status_code == 404


def test_similar_trips_requires_auth():
    res = client.get("/trips/1/similar")
    assert res.status_code == 401
