"""Points the whole test suite at a dedicated `sahyogride_test` database,
never the real dev/demo `sahyogride` one, and wipes it clean before every
test session.

Before this existed, every test file used `TestClient(app)` against
whatever `DATABASE_URL` `.env` pointed at - the real dev database - and
nothing ever cleaned up after itself. Hundreds of pytest runs left
hundreds of throwaway trips/users behind, which eventually broke a search-
ranking test outright (a genuinely-matching trip got silently dropped once
the "top 50 candidates" limit was exceeded by test junk). This file must
be imported (by pytest, automatically, since it's `conftest.py`) before
any test module does `from app.main import app` - it overrides
`DATABASE_URL` first, so `app.config.settings` (a module-level singleton)
never sees the real one.
"""

import os

from sqlalchemy import create_engine, text
from sqlalchemy.engine import make_url
from sqlalchemy.exc import OperationalError, ProgrammingError

TEST_DATABASE_URL = os.environ.get(
    "TEST_DATABASE_URL", "postgresql+psycopg://sahyog:sahyog@localhost:5432/sahyogride_test"
)
os.environ["DATABASE_URL"] = TEST_DATABASE_URL


def _ensure_test_database_exists(url_str: str) -> None:
    """Creates the test database (and its pgvector extension) on first
    run, so a fresh clone doesn't need a manual setup step - only
    `sahyog`'s CREATEDB privilege, granted once per machine."""
    url = make_url(url_str)
    maintenance_engine = create_engine(url.set(database="postgres"))
    try:
        with maintenance_engine.connect().execution_options(isolation_level="AUTOCOMMIT") as conn:
            conn.execute(text(f'CREATE DATABASE "{url.database}"'))
    except ProgrammingError:
        pass  # already exists
    finally:
        maintenance_engine.dispose()

    # CREATE EXTENSION needs superuser, which the app's own `sahyog` role
    # deliberately isn't - reuse the `postgres` superuser role for just
    # this one statement (same one used to create the database above).
    superuser_engine = create_engine(url.set(database=url.database, username="postgres", password=None))
    try:
        with superuser_engine.connect() as conn:
            conn.execute(text("CREATE EXTENSION IF NOT EXISTS vector"))
            conn.commit()
    except OperationalError:
        pass  # no local superuser access - assume the extension is already enabled
    finally:
        superuser_engine.dispose()


try:
    _ensure_test_database_exists(TEST_DATABASE_URL)
except OperationalError:
    pass  # e.g. no CREATEDB privilege - assume the DB was provisioned some other way

import pytest  # noqa: E402

from app.database import Base, engine  # noqa: E402


@pytest.fixture(scope="session", autouse=True)
def _create_test_schema():
    assert "sahyogride_test" in str(engine.url) or os.environ.get("TEST_DATABASE_URL"), (
        "Refusing to run: engine is not pointed at the test database. "
        "Check DATABASE_URL / TEST_DATABASE_URL before running tests."
    )
    Base.metadata.create_all(engine)


_TABLES = None


@pytest.fixture(autouse=True)
def _clean_test_database(_create_test_schema):
    # Function-scoped, not session-scoped: several search-ranking tests
    # assert a specific trip appears in a top-N result, which is only
    # reliable when each test starts from a genuinely empty table, not
    # just "empty at the start of the whole run."
    global _TABLES
    if _TABLES is None:
        _TABLES = ", ".join(t.name for t in reversed(Base.metadata.sorted_tables))
    with engine.begin() as conn:
        conn.exec_driver_sql(f"TRUNCATE TABLE {_TABLES} RESTART IDENTITY CASCADE")
    yield
