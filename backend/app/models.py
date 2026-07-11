import enum
from datetime import datetime, timezone

from pgvector.sqlalchemy import Vector
from sqlalchemy import DateTime, Enum, ForeignKey, Index, String, UniqueConstraint, text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base

# Hosted embedding model isn't picked yet (SAHYOG-26); 1536 matches OpenAI's
# text-embedding-3-small and can be changed via migration before that lands.
EMBEDDING_DIM = 1536


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


def _pg_enum(enum_cls: type[enum.Enum], name: str) -> Enum:
    # Store the lowercase .value ("confirmed") instead of SQLAlchemy's
    # default of the member name ("CONFIRMED") - keeps DB values consistent
    # with the API's lowercase status strings.
    return Enum(enum_cls, name=name, values_callable=lambda cls: [e.value for e in cls])


class UserRole(str, enum.Enum):
    RIDER = "rider"
    COORDINATOR = "coordinator"
    ADMIN = "admin"


class SeatStatus(str, enum.Enum):
    AVAILABLE = "available"
    HELD = "held"
    RESERVED = "reserved"


class ReservationStatus(str, enum.Enum):
    CONFIRMED = "confirmed"
    CANCELLED = "cancelled"


class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(120))
    email: Mapped[str] = mapped_column(String(255), unique=True, index=True)
    password_hash: Mapped[str] = mapped_column(String(255))
    role: Mapped[UserRole] = mapped_column(_pg_enum(UserRole, "user_role"))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)


class Trip(Base):
    __tablename__ = "trips"

    id: Mapped[int] = mapped_column(primary_key=True)
    coordinator_id: Mapped[int] = mapped_column(ForeignKey("users.id"))
    origin: Mapped[str] = mapped_column(String(255))
    destination: Mapped[str] = mapped_column(String(255))
    departure_time: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    total_seats: Mapped[int]
    purpose: Mapped[str | None] = mapped_column(String(255), nullable=True)

    # AI columns - nullable by design, populated by a post-commit background
    # task in SAHYOG-26. The app must work fully with these always null.
    embedding: Mapped[list[float] | None] = mapped_column(Vector(EMBEDDING_DIM), nullable=True)
    ai_summary: Mapped[str | None] = mapped_column(String(500), nullable=True)

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)

    seats: Mapped[list["Seat"]] = relationship(back_populates="trip")


class Seat(Base):
    __tablename__ = "seats"
    __table_args__ = (UniqueConstraint("trip_id", "seat_number", name="uq_seats_trip_seat_number"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    trip_id: Mapped[int] = mapped_column(ForeignKey("trips.id"))
    seat_number: Mapped[str] = mapped_column(String(10))
    status: Mapped[SeatStatus] = mapped_column(
        _pg_enum(SeatStatus, "seat_status"), default=SeatStatus.AVAILABLE
    )

    trip: Mapped["Trip"] = relationship(back_populates="seats")


class Hold(Base):
    """Row deleted on expiry, confirmation, or manual release - never soft-deleted.

    UNIQUE(seat_id) is the second concurrency-safety layer (after the
    SELECT ... FOR UPDATE lock in hold_seat()); it only holds while the row
    exists, so releasing a hold means deleting it, not flipping a status.
    """

    __tablename__ = "holds"
    __table_args__ = (UniqueConstraint("trip_id", "rider_id", name="uq_holds_trip_rider"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    seat_id: Mapped[int] = mapped_column(ForeignKey("seats.id"), unique=True)
    trip_id: Mapped[int] = mapped_column(ForeignKey("trips.id"))
    rider_id: Mapped[int] = mapped_column(ForeignKey("users.id"))
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)


class Reservation(Base):
    """Cancelled rows are kept for history; status='cancelled' frees the seat.

    The partial unique index below is the third concurrency-safety layer:
    it only constrains confirmed rows, so a cancellation can free a seat for
    a new confirmed reservation without violating uniqueness.
    """

    __tablename__ = "reservations"
    __table_args__ = (
        Index(
            "uq_reservations_seat_confirmed",
            "seat_id",
            unique=True,
            postgresql_where=text("status = 'confirmed'"),
        ),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    seat_id: Mapped[int] = mapped_column(ForeignKey("seats.id"))
    trip_id: Mapped[int] = mapped_column(ForeignKey("trips.id"))
    rider_id: Mapped[int] = mapped_column(ForeignKey("users.id"))
    status: Mapped[ReservationStatus] = mapped_column(
        _pg_enum(ReservationStatus, "reservation_status"), default=ReservationStatus.CONFIRMED
    )
    confirmed_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    cancelled_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    # AI columns - nullable by design, populated by a post-commit background
    # task in SAHYOG-25. The app must work fully with these always null.
    ai_urgency_label: Mapped[str | None] = mapped_column(String(50), nullable=True)
    ai_urgency_score: Mapped[float | None] = mapped_column(nullable=True)
    ai_triage_completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
