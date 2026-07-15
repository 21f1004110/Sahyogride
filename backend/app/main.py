import asyncio
import contextlib
import logging

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.database import SessionLocal
from app.errors import register_exception_handlers
from app.routers import ai, auth, holds, reservations, trips
from app.services.booking import release_expired_holds

logger = logging.getLogger(__name__)

# Lightweight in-process sweep for SAHYOG-18 - no new infra (no Redis/queues,
# per CLAUDE.md scope rules). hold_seat() also reclaims a stale hold inline
# for whoever tries to re-hold it; this loop is what keeps the seat map
# accurate for everyone else who's just looking, not clicking.
HOLD_EXPIRY_SWEEP_INTERVAL_SECONDS = 30


async def _expire_holds_loop() -> None:
    while True:
        db = SessionLocal()
        try:
            release_expired_holds(db)
        except Exception:
            logger.exception("Hold expiry sweep failed")
        finally:
            db.close()
        await asyncio.sleep(HOLD_EXPIRY_SWEEP_INTERVAL_SECONDS)


@contextlib.asynccontextmanager
async def lifespan(app: FastAPI):
    task = asyncio.create_task(_expire_holds_loop())
    yield
    task.cancel()
    with contextlib.suppress(asyncio.CancelledError):
        await task


app = FastAPI(title="SahyogRide API", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:5174", "http://localhost:5175"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

register_exception_handlers(app)

app.include_router(auth.router)
app.include_router(trips.router)
app.include_router(holds.router)
app.include_router(reservations.router)
app.include_router(ai.router)


@app.get("/health")
def health():
    return {"status": "ok"}
