import uuid

from fastapi.testclient import TestClient

from app.database import SessionLocal
from app.main import app
from app.models import Reservation, ReservationStatus, Seat, SeatStatus

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


def hold_and_confirm(rider_token: str, seat_id: int) -> dict:
    hold_res = client.post("/holds", json={"seat_id": seat_id}, headers=auth_header(rider_token))
    assert hold_res.status_code == 201, hold_res.text
    confirm_res = client.post(
        "/reservations", json={"hold_id": hold_res.json()["id"]}, headers=auth_header(rider_token)
    )
    assert confirm_res.status_code == 201, confirm_res.text
    return confirm_res.json()


def test_cancel_reservation_frees_the_seat():
    coordinator = register("coordinator")
    rider = register("rider")
    trip = create_trip(coordinator["token"])
    seat_id = seat_ids_for(trip["id"])[0]
    reservation = hold_and_confirm(rider["token"], seat_id)

    res = client.post(f"/reservations/{reservation['id']}/cancel", headers=auth_header(rider["token"]))
    assert res.status_code == 200, res.text
    body = res.json()
    assert body["id"] == reservation["id"]
    assert body["status"] == "cancelled"
    assert body["cancelled_at"]

    db = SessionLocal()
    try:
        seat = db.get(Seat, seat_id)
        assert seat.status == SeatStatus.AVAILABLE
        db_reservation = db.get(Reservation, reservation["id"])
        assert db_reservation.status == ReservationStatus.CANCELLED
        assert db_reservation.cancelled_at is not None
    finally:
        db.close()


def test_cancelled_seat_can_be_held_by_another_rider():
    coordinator = register("coordinator")
    rider_a = register("rider")
    rider_b = register("rider")
    trip = create_trip(coordinator["token"])
    seat_id = seat_ids_for(trip["id"])[0]
    reservation = hold_and_confirm(rider_a["token"], seat_id)

    client.post(f"/reservations/{reservation['id']}/cancel", headers=auth_header(rider_a["token"]))

    res = client.post("/holds", json={"seat_id": seat_id}, headers=auth_header(rider_b["token"]))
    assert res.status_code == 201, res.text


def test_cancel_reservation_not_owner():
    coordinator = register("coordinator")
    rider_a = register("rider")
    rider_b = register("rider")
    trip = create_trip(coordinator["token"])
    seat_id = seat_ids_for(trip["id"])[0]
    reservation = hold_and_confirm(rider_a["token"], seat_id)

    res = client.post(f"/reservations/{reservation['id']}/cancel", headers=auth_header(rider_b["token"]))
    assert res.status_code == 403
    assert res.json()["error"]["code"] == "NOT_OWNER"

    db = SessionLocal()
    try:
        seat = db.get(Seat, seat_id)
        assert seat.status == SeatStatus.RESERVED
    finally:
        db.close()


def test_cancel_reservation_not_found():
    rider = register("rider")
    res = client.post("/reservations/999999999/cancel", headers=auth_header(rider["token"]))
    assert res.status_code == 404
    assert res.json()["error"]["code"] == "NOT_FOUND"


def test_cancel_already_cancelled_is_a_no_op_returning_200():
    coordinator = register("coordinator")
    rider = register("rider")
    trip = create_trip(coordinator["token"])
    seat_id = seat_ids_for(trip["id"])[0]
    reservation = hold_and_confirm(rider["token"], seat_id)

    first = client.post(f"/reservations/{reservation['id']}/cancel", headers=auth_header(rider["token"]))
    assert first.status_code == 200
    first_cancelled_at = first.json()["cancelled_at"]

    second = client.post(f"/reservations/{reservation['id']}/cancel", headers=auth_header(rider["token"]))
    assert second.status_code == 200
    assert second.json()["status"] == "cancelled"
    assert second.json()["cancelled_at"] == first_cancelled_at


def test_cancel_reservation_forbidden_for_coordinator():
    coordinator = register("coordinator")
    rider = register("rider")
    trip = create_trip(coordinator["token"])
    seat_id = seat_ids_for(trip["id"])[0]
    reservation = hold_and_confirm(rider["token"], seat_id)

    res = client.post(f"/reservations/{reservation['id']}/cancel", headers=auth_header(coordinator["token"]))
    assert res.status_code == 403
    assert res.json()["error"]["code"] == "FORBIDDEN_ROLE"
