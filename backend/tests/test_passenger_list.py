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


def hold_and_confirm(
    rider_token: str,
    seat_id: int,
    passenger_name: str = "Test Passenger",
    passenger_phone: str = "9876543210",
) -> dict:
    hold_res = client.post("/holds", json={"seat_id": seat_id}, headers=auth_header(rider_token))
    assert hold_res.status_code == 201, hold_res.text
    confirm_res = client.post(
        "/reservations",
        json={
            "hold_id": hold_res.json()["id"],
            "passenger_name": passenger_name,
            "passenger_phone": passenger_phone,
        },
        headers=auth_header(rider_token),
    )
    assert confirm_res.status_code == 201, confirm_res.text
    return confirm_res.json()


# --- GET /trips/{id}/passengers ---------------------------------------


def test_passenger_list_empty_for_new_trip():
    coordinator = register("coordinator")
    trip = create_trip(coordinator["token"])
    res = client.get(f"/trips/{trip['id']}/passengers", headers=auth_header(coordinator["token"]))
    assert res.status_code == 200
    assert res.json() == {"passengers": [], "digest": None}


def test_passenger_list_includes_only_confirmed_reservations():
    coordinator = register("coordinator")
    rider_a = register("rider")
    rider_b = register("rider")
    trip = create_trip(coordinator["token"], total_seats=3)
    seats = seat_ids_for(trip["id"])

    confirmed = hold_and_confirm(
        rider_a["token"], seats[0], passenger_name="Jamie Rider", passenger_phone="555-123-4567"
    )
    cancelled = hold_and_confirm(rider_b["token"], seats[1])
    client.post(f"/reservations/{cancelled['id']}/cancel", headers=auth_header(rider_b["token"]))
    # third seat is merely held, never confirmed
    client.post("/holds", json={"seat_id": seats[2]}, headers=auth_header(rider_a["token"]))

    res = client.get(f"/trips/{trip['id']}/passengers", headers=auth_header(coordinator["token"]))
    assert res.status_code == 200
    passengers = res.json()["passengers"]
    assert len(passengers) == 1
    assert passengers[0]["reservation_id"] == confirmed["id"]
    assert passengers[0]["rider_name"] == "Test User"
    assert passengers[0]["seat_number"] == "1"
    assert passengers[0]["confirmed_at"]
    assert passengers[0]["passenger_name"] == "Jamie Rider"
    assert passengers[0]["passenger_phone"] == "555-123-4567"


def test_confirm_reservation_requires_passenger_name_and_phone():
    coordinator = register("coordinator")
    rider = register("rider")
    trip = create_trip(coordinator["token"])
    seat_id = seat_ids_for(trip["id"])[0]

    hold_res = client.post("/holds", json={"seat_id": seat_id}, headers=auth_header(rider["token"]))
    res = client.post(
        "/reservations", json={"hold_id": hold_res.json()["id"]}, headers=auth_header(rider["token"])
    )
    assert res.status_code == 422


def test_confirm_reservation_rejects_bad_phone():
    coordinator = register("coordinator")
    rider = register("rider")
    trip = create_trip(coordinator["token"])
    seat_id = seat_ids_for(trip["id"])[0]

    hold_res = client.post("/holds", json={"seat_id": seat_id}, headers=auth_header(rider["token"]))
    res = client.post(
        "/reservations",
        json={"hold_id": hold_res.json()["id"], "passenger_name": "Jamie", "passenger_phone": "abc"},
        headers=auth_header(rider["token"]),
    )
    assert res.status_code == 422


def test_passenger_list_response_includes_urgency_and_digest_fields():
    # No AI_API_KEY configured in this test environment, so ai_service's
    # client is None and both fields stay null - this proves the response
    # shape (SAHYOG-30/32) works correctly with AI effectively off, same
    # guarantee as SAHYOG-24's fallback test.
    coordinator = register("coordinator")
    rider = register("rider")
    trip = create_trip(coordinator["token"])
    seat_id = seat_ids_for(trip["id"])[0]
    hold_and_confirm(rider["token"], seat_id)

    res = client.get(f"/trips/{trip['id']}/passengers", headers=auth_header(coordinator["token"]))
    assert res.status_code == 200
    body = res.json()
    assert "digest" in body
    assert body["digest"] is None
    assert body["passengers"][0]["ai_urgency_label"] is None


def test_passenger_list_forbidden_for_rider():
    coordinator = register("coordinator")
    rider = register("rider")
    trip = create_trip(coordinator["token"])
    res = client.get(f"/trips/{trip['id']}/passengers", headers=auth_header(rider["token"]))
    assert res.status_code == 403
    assert res.json()["error"]["code"] == "FORBIDDEN_ROLE"


def test_passenger_list_not_owner_for_other_coordinator():
    coordinator_a = register("coordinator")
    coordinator_b = register("coordinator")
    trip = create_trip(coordinator_a["token"])
    res = client.get(f"/trips/{trip['id']}/passengers", headers=auth_header(coordinator_b["token"]))
    assert res.status_code == 403
    assert res.json()["error"]["code"] == "NOT_OWNER"


def test_passenger_list_not_found_for_missing_trip():
    coordinator = register("coordinator")
    res = client.get("/trips/999999/passengers", headers=auth_header(coordinator["token"]))
    assert res.status_code == 404
    assert res.json()["error"]["code"] == "NOT_FOUND"


def test_passenger_list_requires_auth():
    res = client.get("/trips/1/passengers")
    assert res.status_code == 401
    assert res.json()["error"]["code"] == "UNAUTHENTICATED"


# --- GET /trips/mine -----------------------------------------------------


def test_my_trips_empty_for_new_coordinator():
    coordinator = register("coordinator")
    res = client.get("/trips/mine", headers=auth_header(coordinator["token"]))
    assert res.status_code == 200
    assert res.json() == {"trips": []}


def test_my_trips_only_shows_own_trips():
    coordinator_a = register("coordinator")
    coordinator_b = register("coordinator")
    trip_a = create_trip(coordinator_a["token"], total_seats=5)
    create_trip(coordinator_b["token"], total_seats=3)

    res = client.get("/trips/mine", headers=auth_header(coordinator_a["token"]))
    assert res.status_code == 200
    trips = res.json()["trips"]
    assert len(trips) == 1
    assert trips[0]["id"] == trip_a["id"]
    assert trips[0]["seats_available"] == 5
    assert trips[0]["total_seats"] == 5


def test_my_trips_forbidden_for_rider():
    rider = register("rider")
    res = client.get("/trips/mine", headers=auth_header(rider["token"]))
    assert res.status_code == 403
    assert res.json()["error"]["code"] == "FORBIDDEN_ROLE"


def test_my_trips_requires_auth():
    res = client.get("/trips/mine")
    assert res.status_code == 401
    assert res.json()["error"]["code"] == "UNAUTHENTICATED"
