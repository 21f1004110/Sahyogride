from fastapi import FastAPI
from fastapi.testclient import TestClient
from pydantic import BaseModel

from app.errors import AppError, register_exception_handlers


def build_app() -> FastAPI:
    app = FastAPI()
    register_exception_handlers(app)

    class Body(BaseModel):
        name: str

    @app.post("/echo")
    def echo(body: Body):
        return {"name": body.name}

    @app.get("/boom/{code}")
    def boom(code: str):
        raise AppError(code)

    @app.get("/crash")
    def crash():
        raise RuntimeError("unexpected")

    return app


client = TestClient(build_app(), raise_server_exceptions=False)


def test_app_error_uses_envelope_and_table_status():
    res = client.get("/boom/SEAT_UNAVAILABLE")
    assert res.status_code == 409
    body = res.json()
    assert body["error"]["code"] == "SEAT_UNAVAILABLE"
    assert body["error"]["field"] is None


def test_validation_error_uses_envelope():
    res = client.post("/echo", json={})
    assert res.status_code == 422
    body = res.json()
    assert body["error"]["code"] == "VALIDATION_ERROR"
    assert body["error"]["field"] == "name"


def test_not_found_uses_envelope():
    res = client.get("/does-not-exist")
    assert res.status_code == 404
    assert res.json()["error"]["code"] == "NOT_FOUND"


def test_unhandled_exception_returns_500_envelope_not_5xx_stacktrace():
    res = client.get("/crash")
    assert res.status_code == 500
    assert res.json() == {
        "error": {"code": "INTERNAL_ERROR", "message": "Something went wrong. Please try again.", "field": None}
    }
