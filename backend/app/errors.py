import logging
from typing import Any

from fastapi import FastAPI, Request, status
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException as StarletteHTTPException

logger = logging.getLogger(__name__)

# code -> (http status, default message). See docs/API_CONTRACT.md for the
# full reference; keep the two in sync.
ERROR_CODES: dict[str, tuple[int, str]] = {
    "SEAT_UNAVAILABLE": (status.HTTP_409_CONFLICT, "That seat was just taken - please pick another one."),
    "HOLD_EXPIRED": (status.HTTP_410_GONE, "Your hold on this seat has expired."),
    "ALREADY_HOLDING": (status.HTTP_409_CONFLICT, "You already hold a seat on this trip."),
    "FORBIDDEN_ROLE": (status.HTTP_403_FORBIDDEN, "You don't have permission to do this."),
    "NOT_OWNER": (status.HTTP_403_FORBIDDEN, "You don't have permission to access this resource."),
    "TRIP_FULL": (status.HTTP_409_CONFLICT, "This trip is fully booked."),
    "EMAIL_TAKEN": (status.HTTP_409_CONFLICT, "An account with this email already exists."),
    "INVALID_CREDENTIALS": (status.HTTP_401_UNAUTHORIZED, "Incorrect email or password."),
    "UNAUTHENTICATED": (status.HTTP_401_UNAUTHORIZED, "Authentication required."),
    "NOT_FOUND": (status.HTTP_404_NOT_FOUND, "Resource not found."),
    "VALIDATION_ERROR": (status.HTTP_422_UNPROCESSABLE_ENTITY, "Invalid request."),
    "INTERNAL_ERROR": (status.HTTP_500_INTERNAL_SERVER_ERROR, "Something went wrong. Please try again."),
}


class AppError(Exception):
    """Raise with a code from ERROR_CODES; status and default message come from the table."""

    def __init__(self, code: str, message: str | None = None, field: str | None = None):
        status_code, default_message = ERROR_CODES[code]
        self.code = code
        self.message = message or default_message
        self.status_code = status_code
        self.field = field
        super().__init__(self.message)


def _envelope(code: str, message: str, field: str | None = None) -> dict[str, Any]:
    return {"error": {"code": code, "message": message, "field": field}}


def register_exception_handlers(app: FastAPI) -> None:
    @app.exception_handler(AppError)
    async def handle_app_error(request: Request, exc: AppError) -> JSONResponse:
        return JSONResponse(status_code=exc.status_code, content=_envelope(exc.code, exc.message, exc.field))

    @app.exception_handler(StarletteHTTPException)
    async def handle_http_exception(request: Request, exc: StarletteHTTPException) -> JSONResponse:
        code = "NOT_FOUND" if exc.status_code == 404 else "HTTP_ERROR"
        message = exc.detail if isinstance(exc.detail, str) else "Request failed."
        return JSONResponse(status_code=exc.status_code, content=_envelope(code, message))

    @app.exception_handler(RequestValidationError)
    async def handle_validation_error(request: Request, exc: RequestValidationError) -> JSONResponse:
        errors = exc.errors()
        first = errors[0] if errors else {}
        field = ".".join(str(p) for p in first.get("loc", ()) if p != "body") or None
        message = first.get("msg", "Invalid request.")
        return JSONResponse(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            content=_envelope("VALIDATION_ERROR", message, field),
        )

    @app.exception_handler(Exception)
    async def handle_unexpected_error(request: Request, exc: Exception) -> JSONResponse:
        logger.exception("Unhandled exception on %s %s", request.method, request.url.path)
        status_code, message = ERROR_CODES["INTERNAL_ERROR"]
        return JSONResponse(status_code=status_code, content=_envelope("INTERNAL_ERROR", message))
