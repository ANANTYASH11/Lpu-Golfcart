from fastapi import APIRouter, Request
from fastapi.responses import StreamingResponse
import asyncio
from app.services.sse_manager import sse_manager

router = APIRouter(prefix="/stream", tags=["Real-time Updates"])

@router.get("/events")
async def stream_events(request: Request):
    """
    Server-Sent Events (SSE) endpoint:
    Streams live shuttle tracking, crowd updates, and golf cart dispatches to connected clients.
    """
    queue = await sse_manager.subscribe()

    async def event_generator():
        try:
            while True:
                # Check for client disconnect
                if await request.is_disconnected():
                    break
                try:
                    message = await asyncio.wait_for(queue.get(), timeout=15.0)
                    yield message
                except asyncio.TimeoutError:
                    # Keep-alive heartbeat comment
                    yield ": ping\n\n"
        finally:
            sse_manager.unsubscribe(queue)

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no"
        }
    )
