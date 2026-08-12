from datetime import datetime

from pydantic import BaseModel, Field, field_validator

from app.models import UserRole

SELF_REGISTER_ROLES = {UserRole.RIDER, UserRole.COORDINATOR}


class RegisterRequest(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    email: str = Field(min_length=3, max_length=255)
    password: str = Field(min_length=8, max_length=255)
    role: UserRole

    @field_validator("role")
    @classmethod
    def role_must_be_self_registerable(cls, value: UserRole) -> UserRole:
        if value not in SELF_REGISTER_ROLES:
            raise ValueError("role must be 'rider' or 'coordinator'")
        return value

    @field_validator("email")
    @classmethod
    def email_must_look_like_email(cls, value: str) -> str:
        if "@" not in value or "." not in value.split("@")[-1]:
            raise ValueError("must be a valid email address")
        return value.lower()


class LoginRequest(BaseModel):
    email: str
    password: str


class UserOut(BaseModel):
    id: int
    name: str
    email: str
    role: UserRole

    model_config = {"from_attributes": True}


class AuthResponse(BaseModel):
    token: str
    user: UserOut


class TripCreateRequest(BaseModel):
    origin: str = Field(min_length=1, max_length=255)
    destination: str = Field(min_length=1, max_length=255)
    departure_time: datetime
    total_seats: int = Field(gt=0, le=100)
    purpose: str | None = Field(default=None, max_length=255)
    origin_lat: float | None = Field(default=None, ge=-90, le=90)
    origin_lng: float | None = Field(default=None, ge=-180, le=180)
    destination_lat: float | None = Field(default=None, ge=-90, le=90)
    destination_lng: float | None = Field(default=None, ge=-180, le=180)


class TripOut(BaseModel):
    id: int
    coordinator_id: int
    origin: str
    destination: str
    departure_time: datetime
    total_seats: int
    purpose: str | None
    origin_lat: float | None = None
    origin_lng: float | None = None
    destination_lat: float | None = None
    destination_lng: float | None = None
    created_at: datetime

    model_config = {"from_attributes": True}


class TripListItem(BaseModel):
    id: int
    origin: str
    destination: str
    departure_time: datetime
    total_seats: int
    seats_available: int
    purpose: str | None
    ai_summary: str | None = None
    ai_high_demand: bool | None = None

    model_config = {"from_attributes": True}


class TripListResponse(BaseModel):
    trips: list[TripListItem]


class SeatOut(BaseModel):
    id: int
    seat_number: str
    status: str
    held_by_me: bool


class BusStopOut(BaseModel):
    id: int
    name: str
    sequence: int

    model_config = {"from_attributes": True}


class TripDetailOut(BaseModel):
    id: int
    coordinator_id: int
    origin: str
    destination: str
    departure_time: datetime
    total_seats: int
    purpose: str | None
    ai_summary: str | None = None
    origin_lat: float | None = None
    origin_lng: float | None = None
    destination_lat: float | None = None
    destination_lng: float | None = None
    seats: list[SeatOut]
    bus_stops: list[BusStopOut] = []
    current_stop_sequence: int | None = None


class SetBusStopsRequest(BaseModel):
    stop_names: list[str] = Field(min_length=1, max_length=20)

    @field_validator("stop_names")
    @classmethod
    def names_must_not_be_blank(cls, value: list[str]) -> list[str]:
        cleaned = [name.strip() for name in value]
        if any(not name or len(name) > 255 for name in cleaned):
            raise ValueError("stop names must be 1-255 characters")
        return cleaned


class SetCurrentStopRequest(BaseModel):
    sequence: int = Field(ge=0)


class BusStopStatusResponse(BaseModel):
    stops: list[BusStopOut]
    current_stop_sequence: int | None


class HoldCreateRequest(BaseModel):
    seat_id: int


class HoldOut(BaseModel):
    id: int
    seat_id: int
    trip_id: int
    rider_id: int
    expires_at: datetime

    model_config = {"from_attributes": True}


class ReservationCreateRequest(BaseModel):
    hold_id: int
    notes: str | None = Field(default=None, max_length=500)
    passenger_name: str = Field(min_length=1, max_length=120)
    passenger_phone: str = Field(min_length=7, max_length=20)

    @field_validator("passenger_name")
    @classmethod
    def name_must_not_be_blank(cls, value: str) -> str:
        stripped = value.strip()
        if not stripped:
            raise ValueError("passenger_name must not be blank")
        return stripped

    @field_validator("passenger_phone")
    @classmethod
    def phone_must_look_like_a_phone_number(cls, value: str) -> str:
        stripped = value.strip()
        digits = [c for c in stripped if c.isdigit()]
        if len(digits) < 7 or not all(c.isdigit() or c in "+-() " for c in stripped):
            raise ValueError("passenger_phone must be a valid phone number")
        return stripped


class ReservationOut(BaseModel):
    id: int
    seat_id: int
    trip_id: int
    rider_id: int
    status: str
    confirmed_at: datetime
    accessibility_note: str | None = None
    passenger_name: str | None = None
    passenger_phone: str | None = None

    model_config = {"from_attributes": True}


class ReservationCancelOut(BaseModel):
    id: int
    status: str
    cancelled_at: datetime

    model_config = {"from_attributes": True}


class ReservationHistoryItem(BaseModel):
    id: int
    trip_id: int
    seat_number: str
    status: str
    confirmed_at: datetime
    cancelled_at: datetime | None
    trip_origin: str
    trip_destination: str
    departure_time: datetime


class ReservationHistoryResponse(BaseModel):
    reservations: list[ReservationHistoryItem]


class PassengerItem(BaseModel):
    reservation_id: int
    rider_name: str
    seat_number: str
    confirmed_at: datetime
    ai_urgency_label: str | None = None
    ai_accessibility_tags: str | None = None
    passenger_name: str | None = None
    passenger_phone: str | None = None


class PassengerListResponse(BaseModel):
    passengers: list[PassengerItem]
    digest: str | None = None


class AISearchRequest(BaseModel):
    query: str = Field(min_length=1, max_length=500)


class AISearchTripItem(BaseModel):
    id: int
    origin: str
    destination: str
    departure_time: datetime

    model_config = {"from_attributes": True}


class AISearchResponse(BaseModel):
    trips: list[AISearchTripItem]
    fallback: bool


class SeatRecommendationRequest(BaseModel):
    note: str = Field(min_length=1, max_length=500)


class SeatRecommendationResponse(BaseModel):
    seat_number: str | None
    reason: str | None
    fallback: bool


class SimilarTripsResponse(BaseModel):
    trips: list[TripListItem]
    fallback: bool


class AssistantQuestionRequest(BaseModel):
    question: str = Field(min_length=1, max_length=300)


class AssistantAnswerResponse(BaseModel):
    answer: str
    fallback: bool
