import uuid

from fastapi.testclient import TestClient

from app.main import app

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


def create_trip(coordinator_token: str, destination: str | None = None) -> dict:
    payload = {
        "origin": "City Hospital",
        "destination": destination or f"Dest-{uuid.uuid4().hex[:8]}",
        "departure_time": "2026-07-15T09:30:00Z",
        "total_seats": 4,
        "purpose": "medical",
    }
    res = client.post("/trips", json=payload, headers=auth_header(coordinator_token))
    assert res.status_code == 201, res.text
    return res.json()


ROUTE = ["City Hospital (boarding)", "Market Square", "Town Hall", "Railway Station (destination)"]


def test_set_stops_success():
    coordinator = register("coordinator")
    trip = create_trip(coordinator["token"])

    res = client.put(f"/trips/{trip['id']}/stops", json={"stop_names": ROUTE}, headers=auth_header(coordinator["token"]))
    assert res.status_code == 200, res.text
    stops = res.json()
    assert [s["name"] for s in stops] == ROUTE
    assert [s["sequence"] for s in stops] == [0, 1, 2, 3]


def test_set_stops_forbidden_for_rider():
    coordinator = register("coordinator")
    rider = register("rider")
    trip = create_trip(coordinator["token"])

    res = client.put(f"/trips/{trip['id']}/stops", json={"stop_names": ROUTE}, headers=auth_header(rider["token"]))
    assert res.status_code == 403
    assert res.json()["error"]["code"] == "FORBIDDEN_ROLE"


def test_set_stops_not_owner():
    coordinator_a = register("coordinator")
    coordinator_b = register("coordinator")
    trip = create_trip(coordinator_a["token"])

    res = client.put(f"/trips/{trip['id']}/stops", json={"stop_names": ROUTE}, headers=auth_header(coordinator_b["token"]))
    assert res.status_code == 403
    assert res.json()["error"]["code"] == "NOT_OWNER"


def test_set_stops_rejects_blank_name():
    coordinator = register("coordinator")
    trip = create_trip(coordinator["token"])

    res = client.put(
        f"/trips/{trip['id']}/stops",
        json={"stop_names": ["Origin", "  ", "Destination"]},
        headers=auth_header(coordinator["token"]),
    )
    assert res.status_code == 422


def test_set_stops_rejects_empty_list():
    coordinator = register("coordinator")
    trip = create_trip(coordinator["token"])

    res = client.put(f"/trips/{trip['id']}/stops", json={"stop_names": []}, headers=auth_header(coordinator["token"]))
    assert res.status_code == 422


def test_replacing_stops_resets_current_stop():
    coordinator = register("coordinator")
    trip = create_trip(coordinator["token"])
    client.put(f"/trips/{trip['id']}/stops", json={"stop_names": ROUTE}, headers=auth_header(coordinator["token"]))
    client.patch(f"/trips/{trip['id']}/stops/current", json={"sequence": 2}, headers=auth_header(coordinator["token"]))

    res = client.put(
        f"/trips/{trip['id']}/stops", json={"stop_names": ROUTE[:2]}, headers=auth_header(coordinator["token"])
    )
    assert res.status_code == 200

    detail = client.get(f"/trips/{trip['id']}", headers=auth_header(coordinator["token"])).json()
    assert detail["current_stop_sequence"] is None


def test_set_current_stop_success_and_visible_on_trip_detail():
    coordinator = register("coordinator")
    rider = register("rider")
    trip = create_trip(coordinator["token"])
    client.put(f"/trips/{trip['id']}/stops", json={"stop_names": ROUTE}, headers=auth_header(coordinator["token"]))

    res = client.patch(
        f"/trips/{trip['id']}/stops/current", json={"sequence": 1}, headers=auth_header(coordinator["token"])
    )
    assert res.status_code == 200, res.text
    body = res.json()
    assert body["current_stop_sequence"] == 1
    assert len(body["stops"]) == 4

    # Any authenticated user (rider included) sees the live status via
    # the same GET /trips/{id} the seat map already polls (SAHYOG-35).
    detail = client.get(f"/trips/{trip['id']}", headers=auth_header(rider["token"]))
    assert detail.status_code == 200
    detail_body = detail.json()
    assert detail_body["current_stop_sequence"] == 1
    assert [s["name"] for s in detail_body["bus_stops"]] == ROUTE


def test_set_current_stop_without_any_stops_configured():
    coordinator = register("coordinator")
    trip = create_trip(coordinator["token"])

    res = client.patch(
        f"/trips/{trip['id']}/stops/current", json={"sequence": 0}, headers=auth_header(coordinator["token"])
    )
    assert res.status_code == 422
    assert res.json()["error"]["code"] == "VALIDATION_ERROR"


def test_set_current_stop_out_of_range():
    coordinator = register("coordinator")
    trip = create_trip(coordinator["token"])
    client.put(f"/trips/{trip['id']}/stops", json={"stop_names": ROUTE}, headers=auth_header(coordinator["token"]))

    res = client.patch(
        f"/trips/{trip['id']}/stops/current", json={"sequence": 99}, headers=auth_header(coordinator["token"])
    )
    assert res.status_code == 422
    assert res.json()["error"]["code"] == "VALIDATION_ERROR"


def test_set_current_stop_forbidden_for_rider():
    coordinator = register("coordinator")
    rider = register("rider")
    trip = create_trip(coordinator["token"])
    client.put(f"/trips/{trip['id']}/stops", json={"stop_names": ROUTE}, headers=auth_header(coordinator["token"]))

    res = client.patch(
        f"/trips/{trip['id']}/stops/current", json={"sequence": 0}, headers=auth_header(rider["token"])
    )
    assert res.status_code == 403
    assert res.json()["error"]["code"] == "FORBIDDEN_ROLE"


def test_trip_detail_defaults_to_empty_stops():
    coordinator = register("coordinator")
    trip = create_trip(coordinator["token"])

    res = client.get(f"/trips/{trip['id']}", headers=auth_header(coordinator["token"]))
    assert res.status_code == 200
    body = res.json()
    assert body["bus_stops"] == []
    assert body["current_stop_sequence"] is None
