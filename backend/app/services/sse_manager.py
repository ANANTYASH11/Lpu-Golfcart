import asyncio
import json
from typing import Set
import logging
from app.events import event_bus

logger = logging.getLogger(__name__)

class SSEManager:
    def __init__(self):
        self.clients: Set[asyncio.Queue] = set()
        # Connect to internal event bus
        event_bus.subscribe("*", self.broadcast_event)

    async def broadcast_event(self, event_data: dict):
        dead_clients = set()
        message = f"data: {json.dumps(event_data)}\n\n"
        for queue in list(self.clients):
            try:
                await queue.put(message)
            except Exception as e:
                logger.warning(f"Error queueing SSE to client: {e}")
                dead_clients.add(queue)
        for dead in dead_clients:
            self.clients.discard(dead)

    async def subscribe(self) -> asyncio.Queue:
        queue = asyncio.Queue(maxsize=100)
        self.clients.add(queue)
        # Send initial connection ping
        welcome = {"event_type": "Connected", "payload": {"message": "CampusRide SSE Connected"}}
        await queue.put(f"data: {json.dumps(welcome)}\n\n")
        return queue

    def unsubscribe(self, queue: asyncio.Queue):
        self.clients.discard(queue)

sse_manager = SSEManager()
