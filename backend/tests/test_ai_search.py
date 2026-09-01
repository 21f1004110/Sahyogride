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


def test_ai_search_get_alias_matches_post(monkeypatch):
    monkeypatch.setattr(settings, "ai_enabled", False)

    coordinator = register("coordinator")
    rider = register("rider")
    trip = create_trip(coordinator["token"], destination=f"UniqueDest-{uuid.uuid4().hex[:8]}")

    res = client.get(
        "/ai/search", params={"q": trip["destination"]}, headers=auth_header(rider["token"])
    )
    assert res.status_code == 200
    body = res.json()
    assert body["fallback"] is True
    assert any(t["id"] == trip["id"] for t in body["trips"])


def test_ai_search_get_requires_auth():
    res = client.get("/ai/search", params={"q": "anything"})
    assert res.status_code == 401


def test_ai_search_get_rejects_empty_query():
    rider = register("rider")
    res = client.get("/ai/search", params={"q": ""}, headers=auth_header(rider["token"]))
    assert res.status_code == 422


# ── Smarter keyword fallback: query understanding + scoring ───────────
# These all run the fallback path (no AI_API_KEY in this environment,
# and explicitly disabled here too for determinism) - this is the path
# that actually serves every request without a paid AI key configured.


def test_ai_search_returns_parsed_query_understanding(monkeypatch):
    monkeypatch.setattr(settings, "ai_enabled", False)
    rider = register("rider")

    res = client.post(
        "/ai/search",
        json={"query": "a ride to the hospital tomorrow morning"},
        headers=auth_header(rider["token"]),
    )
    assert res.status_code == 200
    parsed = res.json()["parsed"]
    assert parsed["date_label"] == "tomorrow"
    assert parsed["time_of_day"] == "morning"
    assert parsed["purpose"] == "medical"


def test_ai_search_bridges_vocabulary_gap_between_query_and_purpose(monkeypatch):
    """'see a doctor' shares no literal words with a trip whose purpose is
    just 'medical' - plain keyword search can't connect them, but the
    purpose-synonym bridge should."""
    monkeypatch.setattr(settings, "ai_enabled", False)
    coordinator = register("coordinator")
    rider = register("rider")
    trip = create_trip(
        coordinator["token"],
        origin=f"Origin-{uuid.uuid4().hex[:8]}",
        destination=f"Dest-{uuid.uuid4().hex[:8]}",
        purpose="medical",
    )

    res = client.post(
        "/ai/search", json={"query": "I need to see a doctor"}, headers=auth_header(rider["token"])
    )
    assert res.status_code == 200
    body = res.json()
    matched = next((t for t in body["trips"] if t["id"] == trip["id"]), None)
    assert matched is not None
    assert matched["match_reason"]
    assert matched["match_score"] > 0


def test_ai_search_ranks_more_specific_match_higher(monkeypatch):
    """A trip matching purpose AND destination should outrank one matching
    only the purpose, for the same query."""
    monkeypatch.setattr(settings, "ai_enabled", False)
    coordinator = register("coordinator")
    rider = register("rider")
    shared_dest = f"AirportDest-{uuid.uuid4().hex[:8]}"
    strong_match = create_trip(coordinator["token"], destination=shared_dest, purpose="medical")
    weak_match = create_trip(
        coordinator["token"], destination=f"Other-{uuid.uuid4().hex[:8]}", purpose="medical"
    )

    res = client.post(
        "/ai/search",
        json={"query": f"medical trip to {shared_dest}"},
        headers=auth_header(rider["token"]),
    )
    assert res.status_code == 200
    trips = res.json()["trips"]
    ids_in_order = [t["id"] for t in trips]
    assert strong_match["id"] in ids_in_order
    assert weak_match["id"] in ids_in_order
    assert ids_in_order.index(strong_match["id"]) < ids_in_order.index(weak_match["id"])

    strong_score = next(t["match_score"] for t in trips if t["id"] == strong_match["id"])
    weak_score = next(t["match_score"] for t in trips if t["id"] == weak_match["id"])
    assert strong_score > weak_score


def test_ai_search_fallback_results_include_seat_and_purpose_details(monkeypatch):
    monkeypatch.setattr(settings, "ai_enabled", False)
    coordinator = register("coordinator")
    rider = register("rider")
    trip = create_trip(coordinator["token"], destination=f"UniqueDest-{uuid.uuid4().hex[:8]}", total_seats=6)

    res = client.post("/ai/search", json={"query": trip["destination"]}, headers=auth_header(rider["token"]))
    assert res.status_code == 200
    matched = next(t for t in res.json()["trips"] if t["id"] == trip["id"])
    assert matched["purpose"] == "medical"
    assert matched["total_seats"] == 6
    assert matched["seats_available"] == 6
    assert 0 < matched["match_score"] <= 1


def test_ai_search_bridges_flight_wording_to_an_airport_destination(monkeypatch):
    """Regression test: 'catch the flight' used to return zero results
    against a trip destined for '<something> Airport', since neither the
    literal word 'flight' nor a purpose match connects them."""
    monkeypatch.setattr(settings, "ai_enabled", False)
    coordinator = register("coordinator")
    rider = register("rider")
    airport_name = f"Terminal-{uuid.uuid4().hex[:8]} Airport"
    trip = create_trip(coordinator["token"], destination=airport_name, purpose=None)

    for query in ["I want to catch my flight", "catch the flight", "flight"]:
        res = client.post("/ai/search", json={"query": query}, headers=auth_header(rider["token"]))
        assert res.status_code == 200
        body = res.json()
        assert body["parsed"]["location_hint"] == "airport"
        matched = next((t for t in body["trips"] if t["id"] == trip["id"]), None)
        assert matched is not None, f"expected an airport trip to match {query!r}"
        assert "airport" in matched["match_reason"].lower()


def test_ai_search_bridges_train_wording_to_a_railway_destination(monkeypatch):
    monkeypatch.setattr(settings, "ai_enabled", False)
    coordinator = register("coordinator")
    rider = register("rider")
    station_name = f"Central-{uuid.uuid4().hex[:8]} Railway Station"
    trip = create_trip(coordinator["token"], destination=station_name, purpose=None)

    res = client.post(
        "/ai/search", json={"query": "need to catch my train"}, headers=auth_header(rider["token"])
    )
    assert res.status_code == 200
    body = res.json()
    assert body["parsed"]["location_hint"] == "railway station"
    assert any(t["id"] == trip["id"] for t in body["trips"])
