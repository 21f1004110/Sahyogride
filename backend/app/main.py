from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.errors import register_exception_handlers
from app.routers import ai, auth, holds, reservations, trips

app = FastAPI(title="SahyogRide API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:5174"],
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
