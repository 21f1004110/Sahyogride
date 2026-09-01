from datetime import date

from app.services.query_understanding import parse_query

TODAY = date(2026, 9, 1)  # a Tuesday


def test_parses_today():
    result = parse_query("I need a ride today", today=TODAY)
    assert result["travel_date"] == TODAY
    assert result["date_label"] == "today"


def test_parses_tomorrow():
    result = parse_query("a ride to the hospital tomorrow morning", today=TODAY)
    assert result["travel_date"] == date(2026, 9, 2)
    assert result["date_label"] == "tomorrow"
    assert result["time_of_day"] == "morning"
    assert result["purpose"] == "medical"


def test_parses_named_weekday_as_next_occurrence():
    # TODAY is a Tuesday - "saturday" should resolve to that same week's
    # Saturday (4 days ahead), not today even if today happened to match.
    result = parse_query("exam shuttle this saturday", today=TODAY)
    assert result["travel_date"] == date(2026, 9, 5)
    assert result["date_label"] == "Saturday"
    assert result["purpose"] == "exam"


def test_weekday_matching_today_resolves_to_next_week():
    # TODAY itself is a Tuesday - asking for "tuesday" should mean *next*
    # Tuesday, not today (a rider wouldn't say "on Tuesday" to mean now).
    result = parse_query("ride on tuesday", today=TODAY)
    assert result["travel_date"] == date(2026, 9, 8)


def test_parses_time_of_day_without_a_date():
    result = parse_query("something in the evening", today=TODAY)
    assert result["travel_date"] is None
    assert result["time_of_day"] == "evening"


def test_purpose_synonyms_map_to_category():
    assert parse_query("I need to see a doctor", today=TODAY)["purpose"] == "medical"
    assert parse_query("dialysis appointment", today=TODAY)["purpose"] == "medical"
    assert parse_query("college admission interview", today=TODAY)["purpose"] == "exam"
    assert parse_query("need to get to the office", today=TODAY)["purpose"] == "work"


def test_no_signals_returns_all_none():
    result = parse_query("completely unrelated gibberish", today=TODAY)
    assert result == {
        "travel_date": None,
        "date_label": None,
        "time_of_day": None,
        "purpose": None,
        "location_hint": None,
    }


def test_location_hint_detects_airport_from_flight_wording():
    # "flight"/"catch a flight" share no literal words with a trip whose
    # destination is just "IGI Airport" - this is what actually lets
    # ai_search.py bridge the two.
    for text in ["I want to catch my flight", "catch the flight", "need to fly to Mumbai", "flight"]:
        assert parse_query(text, today=TODAY)["location_hint"] == "airport"


def test_location_hint_detects_railway_and_bus():
    assert parse_query("need to catch my train", today=TODAY)["location_hint"] == "railway station"
    assert parse_query("go to the bus stand", today=TODAY)["location_hint"] == "bus stand"


def test_location_hint_none_when_not_mentioned():
    assert parse_query("a ride to the hospital tomorrow", today=TODAY)["location_hint"] is None
