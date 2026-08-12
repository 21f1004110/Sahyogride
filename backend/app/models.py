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

    # Optional map coordinates (SAHYOG-47) - geocoded client-side from the
    # origin/destination text via OpenStreetMap Nominatim, no API key/paid
    # service. Purely additive display data: search/hold/confirm never read
    # these, so the app works identically whether they're set or null.
    origin_lat: Mapped[float | None] = mapped_column(nullable=True)
    origin_lng: Mapped[float | None] = mapped_column(nullable=True)
    destination_lat: Mapped[float | None] = mapped_column(nullable=True)
    destination_lng: Mapped[float | None] = mapped_column(nullable=True)

    # AI columns - nullable by design, populated by a post-commit background
    # task in SAHYOG-26. The app must work fully with these always null.
    embedding: Mapped[list[float] | None] = mapped_column(Vector(EMBEDDING_DIM), nullable=True)
    ai_summary: Mapped[str | None] = mapped_column(String(500), nullable=True)
    # Deterministic (not an LLM call - "is fill ratio over a threshold" is
    # arithmetic, not a semantic judgment), set from the same post-commit
    # background task as the AI columns above (SAHYOG-42). Never reset back
    # to null/false once flagged. Nullable so "not yet evaluated" and
    # "evaluated, not high demand" both read the same in the UI.
    ai_high_demand: Mapped[bool | None] = mapped_column(nullable=True)

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)

    # Coordinator-entered route (SAHYOG-46) - plain names, no GPS/maps
    # (CLAUDE.md scope exclusion), ordered boarding point -> destination.
    # current_stop_sequence is a plain int (not a FK to bus_stops.id) to
    # avoid a circular FK between trips and bus_stops; null means the
    # coordinator hasn't marked a starting position yet.
    current_stop_sequence: Mapped[int | None] = mapped_column(nullable=True)

    seats: Mapped[list["Seat"]] = relationship(back_populates="trip")
    bus_stops: Mapped[list["BusStop"]] = relationship(
        back_populates="trip", order_by="BusStop.sequence", cascade="all, delete-orphan"
    )


class BusStop(Base):
    """A coordinator-entered waypoint on a trip's route, boarding point to
    destination (SAHYOG-46). Plain text names, no coordinates - this is a
    manual status flow, not GPS/maps tracking (CLAUDE.md scope exclusion).
    """

    __tablename__ = "bus_stops"
    __table_args__ = (UniqueConstraint("trip_id", "sequence", name="uq_bus_stops_trip_sequence"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    trip_id: Mapped[int] = mapped_column(ForeignKey("trips.id", ondelete="CASCADE"))
    name: Mapped[str] = mapped_column(String(255))
    sequence: Mapped[int]

    trip: Mapped["Trip"] = relationship(back_populates="bus_stops")


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

    # Rider-supplied, plain text - not AI. Written in the same transaction
    # as the reservation itself (SAHYOG-40), same as Trip.purpose.
    accessibility_note: Mapped[str | None] = mapped_column(String(500), nullable=True)

    # Rider-supplied contact details for this specific booking (the actual
    # traveller may not be the account holder) - lets a coordinator reach
    # the right person to manage the trip. Required by the API for new
    # reservations; nullable here only so pre-existing rows stay valid.
    passenger_name: Mapped[str | None] = mapped_column(String(120), nullable=True)
    passenger_phone: Mapped[str | None] = mapped_column(String(20), nullable=True)

    # AI columns - nullable by design, populated by a post-commit background
    # task in SAHYOG-25. The app must work fully with these always null.
    ai_urgency_label: Mapped[str | None] = mapped_column(String(50), nullable=True)
    ai_urgency_score: Mapped[float | None] = mapped_column(nullable=True)
    ai_triage_completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    # Despite the plural name, this holds exactly one classified tag
    # (SAHYOG-40) - matches the single-label ai_urgency_label precedent,
    # kept as a plain string rather than a Postgres array type.
    ai_accessibility_tags: Mapped[str | None] = mapped_column(String(50), nullable=True)
