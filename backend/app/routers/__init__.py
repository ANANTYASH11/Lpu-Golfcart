from app.routers.auth import router as auth_router
from app.routers.transport import router as transport_router
from app.routers.shuttle_ops import router as shuttle_ops_router
from app.routers.last_mile import router as last_mile_router
from app.routers.stream import router as stream_router

__all__ = [
    "auth_router",
    "transport_router",
    "shuttle_ops_router",
    "last_mile_router",
    "stream_router"
]
