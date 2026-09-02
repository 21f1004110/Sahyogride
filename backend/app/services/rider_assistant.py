# Orchestrates the help assistant (SAHYOG-45): synchronous, read-only.
# Answers about app mechanics (FAQ topics below) never touch the
# database - only the rider's question and a fixed static FAQ, never any
# trip/reservation/account data, so there is nothing for those to leak
# even under prompt injection. When a question instead looks like a
# trip request ("how can I go to the hospital"), it's handed to the
# same read-only, public trip search /ai/search already uses - real
# clickable trip suggestions, never anything account-specific. Never
# inside hold_seat()/confirm_reservation()'s locked transaction, never
# calls either, never writes anything - CLAUDE.md rule #3, zero write
# power either way.
#
# Every answer also carries a `suggested_link` to a real, already-existing
# page - the assistant can point somewhere, it can never navigate for you
# or perform an action there.

from sqlalchemy.orm import Session

from app.config import settings
from app.schemas import AssistantAnswerResponse, SuggestedLink
from app.services import ai_service
from app.services.ai_search import ai_search
from app.services.query_understanding import parse_query

# Grounds the AI's answer (see ai_service.answer_rider_question's system
# prompt) and doubles as the deterministic fallback when AI is off,
# unconfigured, or times out - keyword-matched below, same "always works
# with AI disabled" guarantee as ai_search's keyword fallback.
#
# `link` is optional per topic and points at a real frontend route; a
# `roles` set restricts it to the roles that can actually open that page
# (e.g. "My trips" is coordinator-only) - the text answer is never
# role-gated, only the navigation shortcut is.
FAQ = [
    {
        "topic": "how to book a ride (overview)",
        "keywords": [
            "book a ride", "book the ride", "book my ride", "booking a ride",
            "make a booking", "reserve a ride", "get a ride", "find a ride",
        ],
        "answer": (
            "Search for a trip on the 'Search trips' page, then tap any available seat "
            "to hold it. Fill in your name and phone number and tap 'Confirm reservation' "
            f"- that's it, your seat is booked. A hold only lasts {{hold_ttl}} minutes, so "
            "confirm before it expires."
        ),
        "link": {"label": "Search trips", "path": "/trips"},
    },
    {
        "topic": "holding a seat",
        "keywords": ["hold", "reserve seat", "pick a seat", "select seat", "book a seat"],
        "answer": (
            "Tap any available seat on a trip's seat map to hold it. A hold lasts "
            f"{{hold_ttl}} minutes - confirm within that window or the seat goes back "
            "to available for someone else."
        ),
        "link": {"label": "Search trips", "path": "/trips"},
    },
    {
        "topic": "hold expiry",
        "keywords": ["expire", "expired", "timer", "countdown", "ran out", "lost my seat"],
        "answer": (
            "Holds last {hold_ttl} minutes. If the countdown runs out before you confirm, "
            "the seat is released automatically - just pick a seat again."
        ),
        "link": {"label": "Search trips", "path": "/trips"},
    },
    {
        "topic": "confirming a reservation",
        "keywords": ["confirm", "finish booking", "complete booking"],
        "answer": (
            "After holding a seat, fill in your name and phone number (so the coordinator "
            "can reach you) and tap 'Confirm reservation'. You can also add an optional note, "
            "e.g. accessibility needs."
        ),
        "link": {"label": "Search trips", "path": "/trips"},
    },
    {
        "topic": "cancelling",
        "keywords": ["cancel", "cancellation", "can't make it", "no longer need"],
        "answer": (
            "Go to 'My reservations' and tap 'Cancel' on the booking - this frees the seat "
            "immediately for another rider."
        ),
        "link": {"label": "My reservations", "path": "/reservations"},
    },
    {
        "topic": "tracking the vehicle",
        "keywords": [
            "track", "tracking", "vehicle", "bus location", "where is the bus",
            "where is my bus", "live location", "current stop", "eta", "position",
        ],
        "answer": (
            "Once your seat is confirmed, check the 'Live vehicle tracker' card on the "
            "confirmation page or on 'My reservations' - it shows the route and updates "
            "automatically every few seconds as the coordinator marks which stop the "
            "vehicle is currently at. If it says tracking hasn't been set up yet, the "
            "coordinator hasn't added a route for that trip."
        ),
        "link": {"label": "My reservations", "path": "/reservations"},
    },
    {
        "topic": "payment",
        "keywords": [
            "pay", "payment", "cost", "price", "fee", "charge", "money", "free",
            "refund", "expensive", "afford",
        ],
        "answer": (
            "SahyogRide is completely free - there is no payment at any step, so there's "
            "nothing to refund either."
        ),
    },
    {
        "topic": "accessibility notes",
        "keywords": ["wheelchair", "accessibility", "disability", "mobility", "assistance"],
        "answer": (
            "When confirming a reservation, use the optional note field to tell the "
            "coordinator about any accessibility needs, e.g. wheelchair access or travelling "
            "with a child."
        ),
        "link": {"label": "Search trips", "path": "/trips"},
    },
    {
        "topic": "seat suggestions",
        "keywords": [
            "seat suggestion", "suggest a seat", "which seat should i", "recommend a seat",
            "help me pick a seat", "best seat for me", "which seat is best",
        ],
        "answer": (
            "Open any trip and use the 'Want a seat suggestion?' box above the seat map - "
            "describe what you need (e.g. wheelchair, travelling with a toddler, motion "
            "sickness) and it highlights one seat with a reason, plus a one-tap button to "
            "hold that exact seat."
        ),
        "link": {"label": "Search trips", "path": "/trips"},
    },
    {
        "topic": "hold vs reservation",
        "keywords": [
            "difference between a hold", "what's a hold", "what is a hold",
            "what does confirmed mean", "hold vs reservation", "hold or a reservation",
        ],
        "answer": (
            "A hold is a temporary claim on one seat - it lasts {hold_ttl} minutes and can "
            "still be taken back if you don't confirm in time. Confirming turns it into a "
            "permanent reservation with your name and phone number, which only a "
            "cancellation can undo."
        ),
    },
    {
        "topic": "creating a trip",
        "keywords": [
            "create a trip", "create trips", "creating a trip", "who can create",
            "publish a trip", "publish trips", "coordinator", "add a trip", "new trip",
        ],
        "answer": (
            "Coordinators can create a trip from 'My trips' - set the origin, destination, "
            "departure time, and number of seats, and seats are generated automatically."
        ),
        "link": {"label": "Create a trip", "path": "/trips/new", "roles": {"coordinator"}},
    },
    {
        "topic": "passenger list",
        "keywords": [
            "passenger list", "who booked my trip", "who is on my trip", "see riders",
            "who's coming", "list of passengers",
        ],
        "answer": (
            "Open 'My trips', pick a trip, and select 'View passengers' to see everyone "
            "who's confirmed a seat, along with an AI-generated urgency and accessibility "
            "summary for the whole trip."
        ),
        "link": {"label": "My trips", "path": "/my-trips", "roles": {"coordinator"}},
    },
    {
        "topic": "managing the route/stops",
        "keywords": [
            "add stops", "set stops", "manage route", "manage the stops",
            "update the tracker", "set the current stop",
        ],
        "answer": (
            "From 'My trips', open a trip to manage its stops - add the route as a simple "
            "ordered list, then advance 'current stop' as the vehicle moves so riders see "
            "live progress on their tracker."
        ),
        "link": {"label": "My trips", "path": "/my-trips", "roles": {"coordinator"}},
    },
    {
        "topic": "running late or missing the vehicle",
        "keywords": [
            "late", "missed", "miss the bus", "left without me", "not there yet",
            "waiting too long",
        ],
        "answer": (
            "Check the 'Live vehicle tracker' for the current stop and route before you "
            "head out. The coordinator has the phone number you gave when confirming, so "
            "they can reach you if needed - if you can no longer make it, cancel your seat "
            "from 'My reservations' so it frees up for someone else."
        ),
        "link": {"label": "My reservations", "path": "/reservations"},
    },
    {
        "topic": "contact/lookup",
        "keywords": ["my booking", "my reservation status", "where is my", "status of my"],
        "answer": "Check 'My reservations' for the status of any booking you've made.",
        "link": {"label": "My reservations", "path": "/reservations"},
    },
]

DEFAULT_ANSWER = (
    "I can help with holding/confirming a seat, cancellations, seat suggestions, "
    "accessibility notes, tracking the vehicle, and creating trips (for coordinators). "
    "Try asking about one of those, or check 'My reservations' / 'My trips' for anything "
    "booking-specific."
)

# Every answer gets somewhere to go, even one the FAQ has no topic for -
# a chatbot that only ever talks is a dead end; this keeps it actionable.
DEFAULT_LINK = {"label": "Search trips", "path": "/trips"}


def _render(answer: str) -> str:
    return answer.format(hold_ttl=settings.hold_ttl_minutes)


def _find_faq_match(question: str) -> dict | None:
    lowered = question.lower()
    for entry in FAQ:
        if any(keyword in lowered for keyword in entry["keywords"]):
            return entry
    return None


def _resolve_link(entry: dict | None, role: str) -> SuggestedLink:
    link = entry.get("link") if entry else None
    if link:
        roles = link.get("roles")
        if not roles or role in roles:
            return SuggestedLink(label=link["label"], path=link["path"])
    return SuggestedLink(**DEFAULT_LINK)


def _faq_context() -> str:
    return "\n".join(f"- {entry['topic']}: {_render(entry['answer'])}" for entry in FAQ)


def _looks_like_a_trip_request(question: str) -> bool:
    """True when the rider seems to be describing where they need to go
    ("how can I go to the hospital") rather than asking how a feature
    works. Reuses the same deterministic parsing ai_search.py already
    does - no model call - so this works identically with AI on or off.
    """
    parsed = parse_query(question)
    return bool(parsed["purpose"] or parsed["location_hint"])


MAX_SUGGESTED_TRIPS = 3


def _search_and_suggest(db: Session, question: str) -> AssistantAnswerResponse:
    search_result = ai_search(db, question)
    matches = search_result.trips[:MAX_SUGGESTED_TRIPS]

    if matches:
        count = "a trip" if len(matches) == 1 else f"{len(matches)} trips"
        answer = f"I found {count} that might work - tap one below to see seats and book."
        return AssistantAnswerResponse(answer=answer, fallback=True, suggested_trips=matches)

    # suggested_query already gives a more specific "/trips?q=..." link on
    # the frontend than the generic DEFAULT_LINK would - no need for both.
    return AssistantAnswerResponse(
        answer="I couldn't find a matching trip right now - try searching directly, or adjust the date.",
        fallback=True,
        suggested_query=question,
    )


def answer_question(db: Session, question: str, role: str) -> AssistantAnswerResponse:
    matched = _find_faq_match(question)

    # A question explicitly about how a feature works (holding, cancelling,
    # tracking, ...) always gets that answer, even if it also happens to
    # mention a place - "how do I cancel my hospital trip" is about
    # cancelling, not a new search.
    if not matched and _looks_like_a_trip_request(question):
        return _search_and_suggest(db, question)

    link = _resolve_link(matched, role)

    result = ai_service.answer_rider_question(question, _faq_context())
    if result is not None:
        return AssistantAnswerResponse(answer=result.answer, fallback=False, suggested_link=link)

    # AI off, unconfigured, or the call failed/timed out - fall back to a
    # deterministic keyword match over the same FAQ, never an error.
    answer = _render(matched["answer"]) if matched else DEFAULT_ANSWER
    return AssistantAnswerResponse(answer=answer, fallback=True, suggested_link=link)
