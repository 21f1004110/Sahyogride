from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.database import get_db
from app.deps import get_current_user
from app.models import User
from app.schemas import AISearchRequest, AISearchResponse, AssistantAnswerResponse, AssistantQuestionRequest
from app.services import rider_assistant
from app.services.ai_search import ai_search

router = APIRouter(prefix="/ai", tags=["ai"])

# Zero write powers - read/search/summarise only, per CLAUDE.md rule #3.


@router.post("/search", response_model=AISearchResponse)
def ai_search_endpoint(
    body: AISearchRequest,
    db: Session = Depends(get_db),
    _user: User = Depends(get_current_user),
) -> AISearchResponse:
    return ai_search(db, body.query)


@router.get("/search", response_model=AISearchResponse)
def ai_search_get_endpoint(
    q: str = Query(min_length=1, max_length=500),
    db: Session = Depends(get_db),
    _user: User = Depends(get_current_user),
) -> AISearchResponse:
    """GET alias for POST /ai/search, same underlying service - some
    clients/specs expect a query-param GET for a read-only search. Kept
    alongside the POST version rather than replacing it, since
    AssistantBox.jsx already depends on POST with a JSON body.
    """
    return ai_search(db, q)


@router.post("/assistant", response_model=AssistantAnswerResponse)
def assistant_endpoint(
    body: AssistantQuestionRequest,
    _user: User = Depends(get_current_user),
) -> AssistantAnswerResponse:
    """General how-does-this-app-work help, available to any authenticated
    user (rider or coordinator) - no DB session needed, this never reads
    or writes trip/reservation data (SAHYOG-45).
    """
    return rider_assistant.answer_question(body.question)
