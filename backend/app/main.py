from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
import asyncio
import logging

from app.config import settings
from app.database import Base, engine, SessionLocal
from app.seed_data import seed_database
from app.services.cart_dispatcher import check_and_expire_no_shows
from app.routers import (
    auth_router,
    transport_router,
    shuttle_ops_router,
    last_mile_router,
    stream_router,
    fares_router,
    payments_router,
    priority_router,
    safety_router
)

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("campusride")

# Background task for checking 5-minute no-shows
async def no_show_sentinel():
    while True:
        try:
            await asyncio.sleep(30)  # Check every 30 seconds
            db = SessionLocal()
            try:
                await check_and_expire_no_shows(db)
            finally:
                db.close()
        except asyncio.CancelledError:
            break
        except Exception as e:
            logger.error(f"Error in no-show sentinel: {e}")

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: Create tables and seed data
    logger.info("Initializing database schemas...")
    Base.metadata.create_all(bind=engine)
    seed_database()
    
    # Launch background no-show checker
    sentinel_task = asyncio.create_task(no_show_sentinel())
    logger.info("CampusRide API initialized successfully.")
    
    yield
    
    # Shutdown
    sentinel_task.cancel()
    try:
        await sentinel_task
    except asyncio.CancelledError:
        pass
    logger.info("CampusRide API shutdown cleanly.")

app = FastAPI(
    title="CampusRide - LPU Campus Transport Management",
    description="Full-stack modular monolith prototype resolving P05 (Waiting for the Shuttle) at Lovely Professional University",
    version=settings.PROJECT_VERSION,
    lifespan=lifespan
)

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount Routers under API V1
api_v1 = settings.API_V1_STR
app.include_router(auth_router, prefix=api_v1)
app.include_router(transport_router, prefix=api_v1)
app.include_router(shuttle_ops_router, prefix=api_v1)
app.include_router(last_mile_router, prefix=api_v1)
app.include_router(stream_router, prefix=api_v1)
app.include_router(fares_router, prefix=api_v1)
app.include_router(payments_router, prefix=api_v1)
app.include_router(priority_router, prefix=api_v1)
app.include_router(safety_router, prefix=api_v1)

@app.get("/")
def root():
    return {
        "service": "CampusRide API",
        "campus": "Lovely Professional University (LPU)",
        "status": "online",
        "docs": "/docs",
        "modules": [
            "Module 1: Student Transport Service",
            "Module 2: Shuttle Operations Service",
            "Module 3: Last-Mile & Golf Cart Booking Service"
        ]
    }

@app.get("/health")
def health_check():
    return {"status": "healthy"}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("app.main:app", host="0.0.0.0", port=8000, reload=True)
