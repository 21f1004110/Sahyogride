# SahyogRide

A community shuttle booking platform. NGOs/hospitals publish **free** shuttle trips for essential travel (medical, exams, work); people in need reserve limited seats. Non-commercial — there is no payment. The product's value is fair, error-free allocation of scarce free seats.

University software-engineering project, 5-person team, built over 11 days.

## Stack

| | |
|---|---|
| Backend | FastAPI (Python 3.11+), SQLAlchemy 2.0, Alembic, Pydantic v2 |
| DB | PostgreSQL 15+ with pgvector |
| Frontend | React 18 + Vite, Tailwind, TanStack Query, axios, react-router-dom |
| Auth | JWT (`python-jose`) + bcrypt |
| Tests | pytest + httpx (backend) |

## Repo layout

```
/backend    FastAPI app, services, routers, tests
/frontend   React + Vite app
/docs       API_CONTRACT.md (source of truth), ER_DIAGRAM.md, BACKEND.md, FRONTEND.md, AI_PROMPT_SPEC.md, TICKETS.md
```

See `CLAUDE.md` for project conventions and `docs/TICKETS.md` for the full ticket backlog.

## Prerequisites

- Python 3.11+
- Node.js 18+ and npm
- PostgreSQL 15+ with the `pgvector` extension available

## Backend setup

```bash
cd backend
python3 -m venv venv
source venv/bin/activate        # Windows: venv\Scripts\activate
pip install -r requirements.txt

cp .env.example .env            # then fill in DATABASE_URL, JWT_SECRET, etc.

alembic upgrade head
python seed.py                  # demo coordinator + rider + one 4-seat trip
python backfill_embeddings.py   # AI semantic search demo data (SAHYOG-26)

uvicorn app.main:app --reload   # -> http://localhost:8000/docs
```

### Local Postgres (dev machine)

This machine has a local Postgres 18 + pgvector cluster installed via conda (no system/root install needed):

```bash
# start
pg_ctl -D ~/pgdata -l ~/pgdata/logfile -o "-p 5432" start
# stop
pg_ctl -D ~/pgdata stop -m fast
# check
pg_isready -p 5432
```

Role `sahyog` / password `sahyog` owns the `sahyogride` database, with the `vector` extension already enabled. `backend/.env` (gitignored) already points at it:

```env
DATABASE_URL=postgresql+psycopg://sahyog:sahyog@localhost:5432/sahyogride
```

If this cluster isn't running (fresh clone, different machine), start it as above, or point `DATABASE_URL` at your own Postgres 15+ with `CREATE EXTENSION vector;` run once.

Run tests:

```bash
pytest
pytest tests/test_concurrency.py -v   # the star test
```

## Frontend setup

```bash
cd frontend
npm install

cp .env.example .env            # sets VITE_API_BASE_URL

npm run dev                     # -> http://localhost:5173
npm run build
```

## Environment variables

**backend/.env**

```env
DATABASE_URL=postgresql+psycopg://user:pass@localhost:5432/sahyogride
JWT_SECRET=...
HOLD_TTL_MINUTES=5

# AI - the app MUST work with these unset/false
AI_ENABLED=true
AI_API_KEY=
AI_TIMEOUT_SECONDS=5
SEMANTIC_THRESHOLD=0.5
```

**frontend/.env**

```env
VITE_API_BASE_URL=http://localhost:8000
```

To verify the app works with AI fully disabled, set `AI_ENABLED=false` in `backend/.env` and confirm register → search → hold → confirm → cancel all still succeed.

## Running both together

Start Postgres, then run backend and frontend in two terminals as shown above. The frontend expects the API at `http://localhost:8000` by default (see `VITE_API_BASE_URL`).

## Project rules

Before touching any endpoint or API call, read `/docs/API_CONTRACT.md` — it's the agreed contract between backend and frontend. Full conventions, the concurrency-safety rules, and the AI-isolation rules are documented in `CLAUDE.md` at the repo root.
