# ER Diagram

## Entities

```
users
  id              PK
  name
  email           UNIQUE
  password_hash
  role            enum: rider | coordinator | admin
  created_at

trips
  id              PK
  coordinator_id  FK -> users.id
  origin
  destination
  departure_time
  total_seats
  purpose         nullable
  embedding       vector(1536), nullable  -- AI, populated in SAHYOG-26
  ai_summary      nullable                -- AI, populated in SAHYOG-26
  created_at

seats
  id              PK
  trip_id         FK -> trips.id
  seat_number     e.g. "1".."N"
  status          enum: available | held | reserved
  UNIQUE(trip_id, seat_number)

holds
  id              PK
  seat_id         FK -> seats.id, UNIQUE      -- one active hold per seat
  trip_id         FK -> trips.id
  rider_id        FK -> users.id
  expires_at
  created_at
  UNIQUE(trip_id, rider_id)                   -- one active hold per rider per trip

reservations
  id                      PK
  seat_id                 FK -> seats.id
  trip_id                 FK -> trips.id
  rider_id                FK -> users.id
  status                  enum: confirmed | cancelled
  confirmed_at
  cancelled_at            nullable
  ai_urgency_label        nullable  -- AI, populated in SAHYOG-25
  ai_urgency_score        nullable  -- AI, populated in SAHYOG-25
  ai_triage_completed_at  nullable  -- AI, populated in SAHYOG-25
  UNIQUE(seat_id) WHERE status = 'confirmed'   -- partial index, see below
```

Relationships: one coordinator → many trips; one trip → many seats; one seat → at most one active hold row and many reservation rows (only one of which can be `confirmed` at a time).

## Why holds are deleted, not soft-deleted

`holds` carries a plain `UNIQUE(seat_id)`, so at most one row can exist per seat *at all*, active or not. That means releasing a hold - by expiry, manual release, or converting it into a reservation - means **deleting the row**, not flipping a status column. Keeping an expired hold row around would permanently block that seat.

`reservations`, by contrast, keeps history: cancelling sets `status = 'cancelled'` rather than deleting the row, which is exactly why its uniqueness constraint has to be partial (see below) instead of a plain `UNIQUE(seat_id)`.

## The two DB-level concurrency constraints

These are layers 2 and 3 of the three-layer defense in CLAUDE.md (layer 1 is the `SELECT ... FOR UPDATE` row lock in `hold_seat()`, added in SAHYOG-15).

**1. `holds.seat_id` is `UNIQUE`** - two simultaneous holds on the same seat can't both insert successfully, even if the row lock were somehow bypassed.

```sql
ALTER TABLE holds ADD CONSTRAINT holds_seat_id_key UNIQUE (seat_id);
```

**2. Partial unique index on `reservations`** - only rows with `status = 'confirmed'` are constrained, so a cancelled reservation doesn't block a new confirmed one on the same seat.

```sql
CREATE UNIQUE INDEX uq_reservations_seat_confirmed
  ON reservations (seat_id)
  WHERE status = 'confirmed';
```

Verified directly against Postgres while building this migration: inserting two `confirmed` rows for the same `seat_id` raises `duplicate key value violates unique constraint "uq_reservations_seat_confirmed"`; cancelling the first and inserting a new confirmed row for a different rider on the same seat succeeds.

## Enum storage note

`role`, `seats.status`, and `reservations.status` are Postgres native enum types. SQLAlchemy's `Enum` type defaults to storing the Python enum **member name** (e.g. `CONFIRMED`), which would silently break the partial index predicate above (`WHERE status = 'confirmed'`, lowercase). `app/models.py` uses `values_callable` on every enum column so the stored values are the lowercase `.value` strings instead - this must stay in sync with any future enum additions.

## Migrations

Managed by Alembic (`backend/alembic/`). `alembic/env.py` imports `app.models` so `Base.metadata` is fully populated for autogenerate, and reads the DB URL from `app.config.settings` rather than a hardcoded value in `alembic.ini`.

`pgvector`'s `Vector` column type requires `import pgvector.sqlalchemy` in the migration file - autogenerate does not add this import automatically, so check for it by hand after every `alembic revision --autogenerate` that touches `trips.embedding`.
