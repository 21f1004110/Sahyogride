import time

from app.config import settings
from app.services import ai_service


def test_triage_returns_none_immediately_when_ai_disabled(monkeypatch):
    monkeypatch.setattr(settings, "ai_enabled", False)
    monkeypatch.setattr(settings, "ai_api_key", "sk-fake-key-not-real")

    started = time.monotonic()
    result = ai_service.triage_reservation_urgency("dialysis appointment")
    elapsed = time.monotonic() - started

    assert result is None
    # Proves this short-circuited in _get_client() rather than attempting
    # a network call and hitting AI_TIMEOUT_SECONDS.
    assert elapsed < 1


def test_triage_returns_none_when_no_api_key_configured(monkeypatch):
    monkeypatch.setattr(settings, "ai_enabled", True)
    monkeypatch.setattr(settings, "ai_api_key", "")

    started = time.monotonic()
    result = ai_service.triage_reservation_urgency("dialysis appointment")
    elapsed = time.monotonic() - started

    assert result is None
    assert elapsed < 1


def test_triage_returns_none_for_empty_purpose(monkeypatch):
    monkeypatch.setattr(settings, "ai_enabled", True)
    monkeypatch.setattr(settings, "ai_api_key", "sk-fake-key-not-real")

    assert ai_service.triage_reservation_urgency(None) is None
    assert ai_service.triage_reservation_urgency("") is None


def test_run_with_timeout_returns_none_on_exception():
    def _boom():
        raise ValueError("simulated AI failure")

    assert ai_service._run_with_timeout(_boom) is None


def test_run_with_timeout_returns_none_on_timeout(monkeypatch):
    monkeypatch.setattr(settings, "ai_timeout_seconds", 0.05)

    def _slow():
        time.sleep(1)
        return "too late"

    assert ai_service._run_with_timeout(_slow) is None
