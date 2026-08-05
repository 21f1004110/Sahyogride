# Orchestrates the help assistant (SAHYOG-45): synchronous, read-only,
# no DB access at all - it only ever sees the rider's question and a
# fixed static FAQ, never any trip/reservation/account data, so there is
# nothing for it to leak even under prompt injection. Never inside
# hold_seat()/confirm_reservation()'s locked transaction, never calls
# either - CLAUDE.md rule #3, zero write power.

from app.config import settings
from app.schemas import AssistantAnswerResponse
from app.services import ai_service

# Grounds the AI's answer (see ai_service.answer_rider_question's system
# prompt) and doubles as the deterministic fallback when AI is off,
# unconfigured, or times out - keyword-matched below, same "always works
# with AI disabled" guarantee as ai_search's keyword fallback.
FAQ = [
    {
        "topic": "holding a seat",
        "keywords": ["hold", "reserve seat", "pick a seat", "select seat", "book a seat"],
        "answer": (
            "Tap any available seat on a trip's seat map to hold it. A hold lasts "
            f"{{hold_ttl}} minutes - confirm within that window or the seat goes back "
            "to available for someone else."
        ),
    },
    {
        "topic": "hold expiry",
        "keywords": ["expire", "expired", "timer", "countdown", "ran out", "lost my seat"],
        "answer": (
            "Holds last {hold_ttl} minutes. If the countdown runs out before you confirm, "
            "the seat is released automatically - just pick a seat again."
        ),
    },
    {
        "topic": "confirming a reservation",
        "keywords": ["confirm", "finish booking", "complete booking"],
        "answer": (
            "After holding a seat, fill in your name and phone number (so the coordinator "
            "can reach you) and tap 'Confirm reservation'. You can also add an optional note, "
            "e.g. accessibility needs."
        ),
    },
    {
        "topic": "cancelling",
        "keywords": ["cancel", "cancellation", "can't make it", "no longer need"],
        "answer": (
            "Go to 'My reservations' and tap 'Cancel' on the booking - this frees the seat "
            "immediately for another rider."
        ),
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
    },
    {
        "topic": "payment",
        "keywords": ["pay", "payment", "cost", "price", "fee", "charge", "money"],
        "answer": "SahyogRide is completely free - there is no payment at any step.",
    },
    {
        "topic": "accessibility notes",
        "keywords": ["wheelchair", "accessibility", "disability", "mobility", "assistance"],
        "answer": (
            "When confirming a reservation, use the optional note field to tell the "
            "coordinator about any accessibility needs, e.g. wheelchair access or travelling "
            "with a child."
        ),
    },
    {
        "topic": "creating a trip",
        "keywords": ["create a trip", "publish a trip", "coordinator", "add a trip", "new trip"],
        "answer": (
            "Coordinators can create a trip from 'My trips' - set the origin, destination, "
            "departure time, and number of seats, and seats are generated automatically."
        ),
    },
    {
        "topic": "contact/lookup",
        "keywords": ["my booking", "my reservation status", "where is my"],
        "answer": "Check 'My reservations' for the status of any booking you've made.",
    },
]

DEFAULT_ANSWER = (
    "I can help with holding/confirming a seat, cancellations, accessibility notes, "
    "tracking the vehicle, and creating trips (for coordinators). Try asking about one "
    "of those, or check 'My reservations' / 'My trips' for anything booking-specific."
)


def _render(answer: str) -> str:
    return answer.format(hold_ttl=settings.hold_ttl_minutes)


def _keyword_fallback(question: str) -> str:
    lowered = question.lower()
    for entry in FAQ:
        if any(keyword in lowered for keyword in entry["keywords"]):
            return _render(entry["answer"])
    return DEFAULT_ANSWER


def _faq_context() -> str:
    return "\n".join(f"- {entry['topic']}: {_render(entry['answer'])}" for entry in FAQ)


def answer_question(question: str) -> AssistantAnswerResponse:
    result = ai_service.answer_rider_question(question, _faq_context())
    if result is not None:
        return AssistantAnswerResponse(answer=result.answer, fallback=False)

    # AI off, unconfigured, or the call failed/timed out - fall back to a
    # deterministic keyword match over the same FAQ, never an error.
    return AssistantAnswerResponse(answer=_keyword_fallback(question), fallback=True)
