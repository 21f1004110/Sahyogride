# Lightweight, deterministic natural-language parsing for trip search
# (SAHYOG-26 follow-up). Extracts a relative date, a time-of-day window,
# and a purpose category (via synonym matching) from a rider's free-text
# query - e.g. "a ride to the hospital tomorrow morning" -> date=tomorrow,
# time_of_day=morning, purpose=medical.
#
# This is plain regex/keyword matching, not a model call - it runs
# identically whether AI_ENABLED is true or false, and both the real
# embedding search path and the keyword fallback in ai_search.py use it
# so the "Understood your request" summary is always available.

from datetime import date, timedelta

_WEEKDAYS = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"]

# word the rider might actually type -> the purpose category a coordinator
# is likely to have used when publishing the trip. Bridges the vocabulary
# gap between "I need to see a doctor" and a trip whose purpose is just
# "medical" - keyword search alone can't make that connection.
PURPOSE_SYNONYMS: dict[str, list[str]] = {
    "medical": [
        "medical", "hospital", "clinic", "doctor", "dialysis", "checkup",
        "check-up", "medicine", "treatment", "surgery", "nurse", "health",
        "emergency", "sick", "appointment",
    ],
    "exam": [
        "exam", "exams", "test", "university", "college", "school",
        "admission", "interview", "entrance",
    ],
    "work": ["work", "office", "job", "shift", "duty", "employment"],
}

# (start_hour, end_hour) in 24h time, end exclusive. "night" wraps past midnight.
TIME_OF_DAY_WINDOWS: dict[str, tuple[int, int]] = {
    "morning": (5, 12),
    "afternoon": (12, 17),
    "evening": (17, 21),
    "night": (21, 5),
}

# Same vocabulary-gap problem as PURPOSE_SYNONYMS, but for *where* a rider
# is going rather than *why*: "catch a flight" shares no literal words
# with a trip whose destination is just "IGI Airport" - a plain keyword
# match (or even a purpose match, since this isn't a purpose category)
# finds nothing. The key IS the literal word actually likely to appear
# in a real origin/destination string, so ai_search.py broadens its
# candidate search to origin/destination ILIKE '%<key>%' whenever a
# rider's wording implies it.
LOCATION_SYNONYMS: dict[str, list[str]] = {
    "airport": ["airport", "flight", "flights", "plane", "fly", "flying", "terminal", "boarding pass"],
    "railway station": ["railway", "train", "station"],
    "bus stand": ["bus stand", "bus terminal", "bus stop"],
}


def _in_time_window(hour: int, window: tuple[int, int]) -> bool:
    lo, hi = window
    if lo < hi:
        return lo <= hour < hi
    return hour >= lo or hour < hi  # wraps past midnight (night)


def parse_query(text: str, today: date | None = None) -> dict:
    """Returns {travel_date, date_label, time_of_day, purpose, location_hint} - every field is
    None if nothing was detected for it. `today` is injectable for tests.
    """
    today = today or date.today()
    lowered = text.lower()

    result_date: date | None = None
    date_label: str | None = None
    if "today" in lowered or "tonight" in lowered:
        result_date = today
        date_label = "today"
    elif "tomorrow" in lowered:
        result_date = today + timedelta(days=1)
        date_label = "tomorrow"
    else:
        for i, weekday in enumerate(_WEEKDAYS):
            if weekday in lowered:
                days_ahead = (i - today.weekday()) % 7
                days_ahead = days_ahead or 7  # the *next* occurrence, not today
                result_date = today + timedelta(days=days_ahead)
                date_label = weekday.capitalize()
                break

    time_of_day = next((tod for tod in TIME_OF_DAY_WINDOWS if tod in lowered), None)

    purpose = None
    for category, synonyms in PURPOSE_SYNONYMS.items():
        if any(word in lowered for word in synonyms):
            purpose = category
            break

    location_hint = None
    for place, synonyms in LOCATION_SYNONYMS.items():
        if any(word in lowered for word in synonyms):
            location_hint = place
            break

    return {
        "travel_date": result_date,
        "date_label": date_label,
        "time_of_day": time_of_day,
        "purpose": purpose,
        "location_hint": location_hint,
    }
