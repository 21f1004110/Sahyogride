import uuid

from fastapi.testclient import TestClient

from app.database import SessionLocal
from app.main import app
from app.models import Seat

client = TestClient(app)


def unique_email(prefix: str) -> str:
    return f"{prefix}.{uuid.uuid4().hex[:12]}@example.com"


def register(role: str) -> dict:
    res = client.post(
        "/auth/register",
        json={
            "name": "Test User",
            "email": unique_email(role),
            "password": "password123",
            "role": role,
        },
    )
    assert res.status_code == 201, res.text
    return res.json()


def auth_header(token: str) -> dict:
    return {"Authorization": f"Bearer {token}"}


def trip_payload(**overrides) -> dict:
    payload = {
        "origin": "City Hospital",
        "destination": "Railway Station",
        "departure_time": "2026-07-15T09:30:00Z",
        "total_seats": 4,
        "purpose": "medical",
    }
    payload.update(overrides)
    return payload


def test_coordinator_can_create_trip_with_seats():
    coordinator = register("coordinator")
    res = client.post("/trips", json=trip_payload(), headers=auth_header(coordinator["token"]))
    assert res.status_code == 201, res.text
    body = res.json()
    assert body["origin"] == "City Hospital"
    assert body["total_seats"] == 4
    assert body["coordinator_id"] == coordinator["user"]["id"]

    db = SessionLocal()
    try:
        seats = db.query(Seat).filter(Seat.trip_id == body["id"]).order_by(Seat.seat_number).all()
        assert [s.seat_number for s in seats] == ["1", "2", "3", "4"]
        assert all(s.status.value == "available" for s in seats)
    finally:
        db.close()


def test_coordinator_can_create_trip_with_map_coordinates():
    coordinator = register("coordinator")
    payload = trip_payload(origin_lat=28.6315, origin_lng=77.2167, destination_lat=28.5562, destination_lng=77.1000)
    res = client.post("/trips", json=payload, headers=auth_header(coordinator["token"]))
    assert res.status_code == 201, res.text
    body = res.json()
    assert body["origin_lat"] == 28.6315
    assert body["origin_lng"] == 77.2167
    assert body["destination_lat"] == 28.5562
    assert body["destination_lng"] == 77.1

    detail = client.get(f"/trips/{body['id']}", headers=auth_header(coordinator["token"]))
    assert detail.status_code == 200
    detail_body = detail.json()
    assert detail_body["origin_lat"] == 28.6315
    assert detail_body["destination_lng"] == 77.1


def test_create_trip_without_map_coordinates_defaults_to_null():
    coordinator = register("coordinator")
    res = client.post("/trips", json=trip_payload(), headers=auth_header(coordinator["token"]))
    assert res.status_code == 201, res.text
    body = res.json()
    assert body["origin_lat"] is None
    assert body["origin_lng"] is None
    assert body["destination_lat"] is None
    assert body["destination_lng"] is None


def test_create_trip_rejects_out_of_range_latitude():
    coordinator = register("coordinator")
    res = client.post(
        "/trips", json=trip_payload(origin_lat=999.0), headers=auth_header(coordinator["token"])
    )
    assert res.status_code == 422


def test_rider_cannot_create_trip():
    rider = register("rider")
    res = client.post("/trips", json=trip_payload(), headers=auth_header(rider["token"]))
    assert res.status_code == 403
    assert res.json()["error"]["code"] == "FORBIDDEN_ROLE"


def test_create_trip_requires_auth():
    res = client.post("/trips", json=trip_payload())
    assert res.status_code == 401
    assert res.json()["error"]["code"] == "UNAUTHENTICATED"


def test_create_trip_validation_error_on_missing_fields():
    coordinator = register("coordinator")
    res = client.post(
        "/trips",
        json={"origin": "City Hospital"},
        headers=auth_header(coordinator["token"]),
    )
    assert res.status_code == 422
    assert res.json()["error"]["code"] == "VALIDATION_ERROR"


def test_create_trip_validation_error_on_non_positive_seats():
    coordinator = register("coordinator")
    res = client.post(
        "/trips",
        json=trip_payload(total_seats=0),
        headers=auth_header(coordinator["token"]),
    )
    assert res.status_code == 422
    assert res.json()["error"]["code"] == "VALIDATION_ERROR"
