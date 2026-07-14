# SahyogRide — Class Diagram

Rendered image: [`diagrams/class_diagram.svg`](diagrams/class_diagram.svg)

Generated directly from `backend/app/models.py` (SQLAlchemy 2.0 ORM, 5 tables + 3 enums).
Mermaid source is included below so it can be re-rendered or edited (paste into
[mermaid.live](https://mermaid.live) or the VS Code Mermaid extension).

```mermaid
classDiagram
    class User {
        +int id PK
        +str name
        +str email UQ
        +str password_hash
        +UserRole role
        +datetime created_at
    }
    class Trip {
        +int id PK
        +int coordinator_id FK
        +str origin
        +str destination
        +datetime departure_time
        +int total_seats
        +str purpose "nullable"
        +vector embedding "nullable, AI"
        +str ai_summary "nullable, AI"
        +datetime created_at
    }
    class Seat {
        +int id PK
        +int trip_id FK
        +str seat_number
        +SeatStatus status
    }
    class Hold {
        +int id PK
        +int seat_id FK "UNIQUE"
        +int trip_id FK
        +int rider_id FK
        +datetime expires_at
        +datetime created_at
    }
    class Reservation {
        +int id PK
        +int seat_id FK
        +int trip_id FK
        +int rider_id FK
        +ReservationStatus status
        +datetime confirmed_at
        +datetime cancelled_at "nullable"
        +str ai_urgency_label "nullable, AI"
        +float ai_urgency_score "nullable, AI"
        +datetime ai_triage_completed_at "nullable, AI"
    }
    class UserRole {
        <<enumeration>>
        rider
        coordinator
        admin
    }
    class SeatStatus {
        <<enumeration>>
        available
        held
        reserved
    }
    class ReservationStatus {
        <<enumeration>>
        confirmed
        cancelled
    }

    User "1" --> "*" Trip : creates (coordinator)
    Trip "1" --> "*" Seat : has
    Seat "1" --> "0..1" Hold : locked by
    User "1" --> "*" Hold : holds
    Trip "1" --> "*" Hold : scoped to
    Seat "1" --> "*" Reservation : booked via
    User "1" --> "*" Reservation : makes
    Trip "1" --> "*" Reservation : scoped to
    Trip ..> UserRole
    Seat ..> SeatStatus
    Reservation ..> ReservationStatus
```

## Design notes

- **`Hold` rows are deleted, not soft-deleted** — `UNIQUE(seat_id)` on `holds` means at most one
  hold row can exist per seat *at all*. This is layer 2 of the three-layer concurrency defense
  (see CLAUDE.md and `services/booking.py::hold_seat`).
- **`Reservation` rows are kept for history** — cancellation sets `status='cancelled'` rather than
  deleting, which is why its uniqueness constraint is a *partial* index
  (`UNIQUE(seat_id) WHERE status='confirmed'`) instead of a plain unique column.
- **AI columns are nullable everywhere** (`Trip.embedding`, `Trip.ai_summary`,
  `Reservation.ai_urgency_*`) — the domain model must be fully valid with every AI column `NULL`,
  per CLAUDE.md rule #3.
