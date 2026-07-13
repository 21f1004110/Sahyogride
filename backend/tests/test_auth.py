import uuid

from fastapi import Depends, FastAPI
from fastapi.testclient import TestClient

from app.deps import get_current_user, require_role
from app.main import app
from app.models import UserRole

client = TestClient(app)


def unique_email(prefix: str) -> str:
    return f"{prefix}.{uuid.uuid4().hex[:12]}@example.com"


def register(role: str = "rider", email: str | None = None) -> dict:
    res = client.post(
        "/auth/register",
        json={
            "name": "Test User",
            "email": email or unique_email(role),
            "password": "password123",
            "role": role,
        },
    )
    assert res.status_code == 201, res.text
    return res.json()


def test_register_returns_token_and_user():
    body = register("rider")
    assert body["user"]["role"] == "rider"
    assert body["token"]


def test_register_duplicate_email_returns_email_taken():
    email = unique_email("dup")
    register("rider", email)
    res = client.post(
        "/auth/register",
        json={"name": "Another", "email": email, "password": "password123", "role": "rider"},
    )
    assert res.status_code == 409
    assert res.json()["error"]["code"] == "EMAIL_TAKEN"


def test_register_rejects_admin_role():
    res = client.post(
        "/auth/register",
        json={"name": "Root", "email": unique_email("admin"), "password": "password123", "role": "admin"},
    )
    assert res.status_code == 422
    assert res.json()["error"]["code"] == "VALIDATION_ERROR"


def test_login_success_returns_same_shape_as_register():
    email = unique_email("login")
    register("rider", email)
    res = client.post("/auth/login", json={"email": email, "password": "password123"})
    assert res.status_code == 200
    assert res.json()["user"]["email"] == email


def test_login_wrong_password_returns_invalid_credentials():
    email = unique_email("badpw")
    register("rider", email)
    res = client.post("/auth/login", json={"email": email, "password": "wrongpassword"})
    assert res.status_code == 401
    assert res.json()["error"]["code"] == "INVALID_CREDENTIALS"


def test_login_unknown_email_returns_invalid_credentials_not_404():
    res = client.post("/auth/login", json={"email": unique_email("nouser"), "password": "password123"})
    assert res.status_code == 401
    assert res.json()["error"]["code"] == "INVALID_CREDENTIALS"


# --- deps.py: get_current_user / require_role, exercised against a throwaway
# protected route since no real protected endpoint exists until SAHYOG-05+.

protected_app = FastAPI()


@protected_app.get("/whoami")
def whoami(user=Depends(get_current_user)):
    return {"id": user.id, "role": user.role.value}


@protected_app.get("/coordinator-only")
def coordinator_only(user=Depends(require_role(UserRole.COORDINATOR))):
    return {"id": user.id}


from app.errors import register_exception_handlers  # noqa: E402

register_exception_handlers(protected_app)
protected_client = TestClient(protected_app)


def test_get_current_user_rejects_missing_token():
    res = protected_client.get("/whoami")
    assert res.status_code == 401
    assert res.json()["error"]["code"] == "UNAUTHENTICATED"


def test_get_current_user_rejects_garbage_token():
    res = protected_client.get("/whoami", headers={"Authorization": "Bearer not-a-real-token"})
    assert res.status_code == 401
    assert res.json()["error"]["code"] == "UNAUTHENTICATED"


def test_get_current_user_accepts_valid_token():
    body = register("rider")
    res = protected_client.get("/whoami", headers={"Authorization": f"Bearer {body['token']}"})
    assert res.status_code == 200
    assert res.json()["role"] == "rider"


def test_require_role_blocks_wrong_role():
    body = register("rider")
    res = protected_client.get("/coordinator-only", headers={"Authorization": f"Bearer {body['token']}"})
    assert res.status_code == 403
    assert res.json()["error"]["code"] == "FORBIDDEN_ROLE"


def test_require_role_allows_matching_role():
    body = register("coordinator")
    res = protected_client.get("/coordinator-only", headers={"Authorization": f"Bearer {body['token']}"})
    assert res.status_code == 200
