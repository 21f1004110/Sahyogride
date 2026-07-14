# The star test. A regression here is a blocker for every later ticket,
# not a nit - see CLAUDE.md and docs/TICKETS.md (SAHYOG-19).

import threading
import uuid
from concurrent.futures import ThreadPoolExecutor

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


def create_trip(coordinator_token: str, total_seats: int) -> dict:
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


def hold_seat_racing(token: str, seat_id: int, barrier: threading.Barrier):
    """Blocks on the barrier so every racer in a round issues its request
    at (as close as Python threads allow to) the same instant - the row
    lock in hold_seat(), not request timing, is what's actually being
    tested here.
    """
    barrier.wait()
    return client.post("/holds", json={"seat_id": seat_id}, headers=auth_header(token))


def confirm_racing(token: str, hold_id: int, barrier: threading.Barrier):
    barrier.wait()
    return client.post("/reservations", json={"hold_id": hold_id}, headers=auth_header(token))


def test_two_riders_one_seat_only_one_wins():
    """Two riders hit the same seat at the same instant, 50 times over,
    with a fresh trip each round. Exactly one 201 and one 409 - SEAT_UNAVAILABLE
    - every single time, or the concurrency core is broken.
    """
    coordinator = register("coordinator")
    rider_a = register("rider")
    rider_b = register("rider")

    iterations = 50
    for i in range(iterations):
        trip = create_trip(coordinator["token"], total_seats=1)
        seat_id = seat_ids_for(trip["id"])[0]

        barrier = threading.Barrier(2)
        with ThreadPoolExecutor(max_workers=2) as executor:
            future_a = executor.submit(hold_seat_racing, rider_a["token"], seat_id, barrier)
            future_b = executor.submit(hold_seat_racing, rider_b["token"], seat_id, barrier)
            res_a = future_a.result()
            res_b = future_b.result()

        statuses = sorted([res_a.status_code, res_b.status_code])
        assert statuses == [201, 409], (
            f"iteration {i}: expected exactly one 201 and one 409, got "
            f"a={res_a.status_code} ({res_a.text}), b={res_b.status_code} ({res_b.text})"
        )

        loser = res_a if res_a.status_code == 409 else res_b
        assert loser.json()["error"]["code"] == "SEAT_UNAVAILABLE", f"iteration {i}: {loser.text}"

        db = SessionLocal()
        try:
            seat = db.get(Seat, seat_id)
            assert seat.status == SeatStatus.HELD, f"iteration {i}: seat ended up {seat.status}"
        finally:
            db.close()


def test_capacity_never_exceeded_under_concurrent_holds_and_confirms():
    """5 seats, 8 riders, everyone races for a seat at once (some riders
    targeting the same seat as each other), then every winner races to
    confirm at once too. Confirmed reservations must land at exactly 5 -
    never more than total_seats - regardless of the scramble.
    """
    total_seats = 5
    rider_count = 8

    coordinator = register("coordinator")
    riders = [register("rider") for _ in range(rider_count)]

    for _ in range(10):
        trip = create_trip(coordinator["token"], total_seats=total_seats)
        seats = seat_ids_for(trip["id"])
        target_seat_for = [seats[i % total_seats] for i in range(rider_count)]

        hold_barrier = threading.Barrier(rider_count)
        with ThreadPoolExecutor(max_workers=rider_count) as executor:
            futures = [
                executor.submit(hold_seat_racing, riders[i]["token"], target_seat_for[i], hold_barrier)
                for i in range(rider_count)
            ]
            hold_results = [f.result() for f in futures]

        winners = [
            (riders[i]["token"], hold_results[i].json()["id"])
            for i in range(rider_count)
            if hold_results[i].status_code == 201
        ]
        assert len(winners) == total_seats, f"expected exactly {total_seats} holds to win, got {len(winners)}"

        confirm_barrier = threading.Barrier(len(winners))
        with ThreadPoolExecutor(max_workers=len(winners)) as executor:
            futures = [
                executor.submit(confirm_racing, token, hold_id, confirm_barrier)
                for token, hold_id in winners
            ]
            confirm_results = [f.result() for f in futures]

        assert all(r.status_code == 201 for r in confirm_results), [
            (r.status_code, r.text) for r in confirm_results
        ]

        db = SessionLocal()
        try:
            confirmed_count = (
                db.query(Reservation)
                .filter(Reservation.trip_id == trip["id"], Reservation.status == ReservationStatus.CONFIRMED)
                .count()
            )
            assert confirmed_count == total_seats, (
                f"confirmed reservations ({confirmed_count}) must never exceed total_seats ({total_seats})"
            )
        finally:
            db.close()
