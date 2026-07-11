from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.routers import ai, auth, holds, reservations, trips

app = FastAPI(title="SahyogRide API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)
app.include_router(trips.router)
app.include_router(holds.router)
app.include_router(reservations.router)
app.include_router(ai.router)


@app.get("/health")
def health():
    return {"status": "ok"}
