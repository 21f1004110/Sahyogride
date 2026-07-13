import uuid

import pytest
from fastapi.testclient import TestClient

from app.database import SessionLocal
from app.errors import AppError
from app.main import app
from app.models import Hold, Seat, SeatStatus
from app.services.booking import hold_seat

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


def create_trip(coordinator_token: str, total_seats: int = 4) -> dict:
    payload = {
        "origin": "City Hospital",
        "destination": "Railway Station",
        "departure_time": "2026-07-15T09:30:00Z",
        "total_seats": total_seats,
        "purpose": "medical",
    }
    res = client.post(
        "/trips", json=payload, headers={"Authorization": f"Bearer {coordinator_token}"}
    )
    assert res.status_code == 201, res.text
    return res.json()


def seat_ids_for(trip_id: int) -> list[int]:
    db = SessionLocal()
    try:
        seats = db.query(Seat).filter(Seat.trip_id == trip_id).order_by(Seat.seat_number).all()
        return [s.id for s in seats]
    finally:
        db.close()


def test_hold_seat_success_creates_hold_and_marks_seat_held():
    coordinator = register("coordinator")
    rider = register("rider")
    trip = create_trip(coordinator["token"])
    seat_id = seat_ids_for(trip["id"])[0]

    db = SessionLocal()
    try:
        hold = hold_seat(db, seat_id, rider["user"]["id"])
        assert hold.seat_id == seat_id
        assert hold.trip_id == trip["id"]
        assert hold.rider_id == rider["user"]["id"]
        assert hold.expires_at is not None

        seat = db.get(Seat, seat_id)
        assert seat.status == SeatStatus.HELD
    finally:
        db.close()


def test_hold_seat_not_found_raises_not_found():
    rider = register("rider")

    db = SessionLocal()
    try:
        with pytest.raises(AppError) as exc_info:
            hold_seat(db, 999999999, rider["user"]["id"])
        assert exc_info.value.code == "NOT_FOUND"
    finally:
        db.close()


def test_hold_seat_unavailable_raises_seat_unavailable():
    coordinator = register("coordinator")
    rider_a = register("rider")
    rider_b = register("rider")
    trip = create_trip(coordinator["token"])
    seat_id = seat_ids_for(trip["id"])[0]

    db = SessionLocal()
    try:
        hold_seat(db, seat_id, rider_a["user"]["id"])

        with pytest.raises(AppError) as exc_info:
            hold_seat(db, seat_id, rider_b["user"]["id"])
        assert exc_info.value.code == "SEAT_UNAVAILABLE"
    finally:
        db.close()


def test_hold_seat_already_holding_raises_already_holding():
    coordinator = register("coordinator")
    rider = register("rider")
    trip = create_trip(coordinator["token"])
    seats = seat_ids_for(trip["id"])

    db = SessionLocal()
    try:
        hold_seat(db, seats[0], rider["user"]["id"])

        with pytest.raises(AppError) as exc_info:
            hold_seat(db, seats[1], rider["user"]["id"])
        assert exc_info.value.code == "ALREADY_HOLDING"
    finally:
        db.close()


def test_hold_seat_enforces_one_hold_row_per_seat_via_unique_constraint():
    coordinator = register("coordinator")
    rider = register("rider")
    trip = create_trip(coordinator["token"])
    seat_id = seat_ids_for(trip["id"])[0]

    db = SessionLocal()
    try:
        hold_seat(db, seat_id, rider["user"]["id"])
        holds = db.query(Hold).filter(Hold.seat_id == seat_id).all()
        assert len(holds) == 1
    finally:
        db.close()
