import uuid

from fastapi.testclient import TestClient

from app.database import SessionLocal
from app.main import app
from app.models import Seat, SeatStatus

client = TestClient(app)


def unique(prefix: str) -> str:
    return f"{prefix}-{uuid.uuid4().hex[:8]}"


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


def create_trip(coordinator_token: str, **overrides) -> dict:
    payload = {
        "origin": unique("City Hospital"),
        "destination": unique("Railway Station"),
        "departure_time": "2026-07-15T09:30:00Z",
        "total_seats": 4,
        "purpose": unique("medical"),
    }
    payload.update(overrides)
    res = client.post("/trips", json=payload, headers=auth_header(coordinator_token))
    assert res.status_code == 201, res.text
    return res.json()


def test_search_requires_auth():
    res = client.get("/trips")
    assert res.status_code == 401
    assert res.json()["error"]["code"] == "UNAUTHENTICATED"


def test_search_no_matches_returns_empty_200():
    rider = register("rider")
    res = client.get("/trips", params={"origin": unique("nowhere")}, headers=auth_header(rider["token"]))
    assert res.status_code == 200
    assert res.json() == {"trips": []}


def test_search_returns_trip_with_full_seats_available():
    coordinator = register("coordinator")
    rider = register("rider")
    trip = create_trip(coordinator["token"])

    res = client.get("/trips", params={"origin": trip["origin"]}, headers=auth_header(rider["token"]))
    assert res.status_code == 200
    trips = res.json()["trips"]
    assert len(trips) == 1
    assert trips[0]["id"] == trip["id"]
    assert trips[0]["seats_available"] == 4
    assert trips[0]["total_seats"] == 4


def test_search_filters_by_destination():
    coordinator = register("coordinator")
    rider = register("rider")
    trip = create_trip(coordinator["token"])

    res = client.get(
        "/trips", params={"destination": trip["destination"]}, headers=auth_header(rider["token"])
    )
    assert res.status_code == 200
    ids = [t["id"] for t in res.json()["trips"]]
    assert trip["id"] in ids


def test_search_filters_by_date():
    coordinator = register("coordinator")
    rider = register("rider")
    trip = create_trip(coordinator["token"], departure_time="2026-08-01T09:30:00Z")

    matching = client.get("/trips", params={"date": "2026-08-01"}, headers=auth_header(rider["token"]))
    non_matching = client.get("/trips", params={"date": "2026-08-02"}, headers=auth_header(rider["token"]))

    assert trip["id"] in [t["id"] for t in matching.json()["trips"]]
    assert trip["id"] not in [t["id"] for t in non_matching.json()["trips"]]


def test_search_filters_by_free_text_q_matching_purpose():
    coordinator = register("coordinator")
    rider = register("rider")
    trip = create_trip(coordinator["token"])

    res = client.get("/trips", params={"q": trip["purpose"]}, headers=auth_header(rider["token"]))
    assert trip["id"] in [t["id"] for t in res.json()["trips"]]


def test_seats_available_excludes_non_available_seats():
    coordinator = register("coordinator")
    rider = register("rider")
    trip = create_trip(coordinator["token"])

    db = SessionLocal()
    try:
        seat = db.query(Seat).filter(Seat.trip_id == trip["id"]).first()
        seat.status = SeatStatus.RESERVED
        db.commit()
    finally:
        db.close()

    res = client.get("/trips", params={"origin": trip["origin"]}, headers=auth_header(rider["token"]))
    assert res.json()["trips"][0]["seats_available"] == 3
