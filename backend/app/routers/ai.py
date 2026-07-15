from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.database import get_db
from app.deps import get_current_user
from app.models import User
from app.schemas import AISearchRequest, AISearchResponse
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
