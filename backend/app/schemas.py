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


class TripOut(BaseModel):
    id: int
    coordinator_id: int
    origin: str
    destination: str
    departure_time: datetime
    total_seats: int
    purpose: str | None
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

    model_config = {"from_attributes": True}


class TripListResponse(BaseModel):
    trips: list[TripListItem]


class SeatOut(BaseModel):
    id: int
    seat_number: str
    status: str
    held_by_me: bool


class TripDetailOut(BaseModel):
    id: int
    coordinator_id: int
    origin: str
    destination: str
    departure_time: datetime
    total_seats: int
    purpose: str | None
    seats: list[SeatOut]


class HoldCreateRequest(BaseModel):
    seat_id: int


class HoldOut(BaseModel):
    id: int
    seat_id: int
    trip_id: int
    rider_id: int
    expires_at: datetime

    model_config = {"from_attributes": True}
