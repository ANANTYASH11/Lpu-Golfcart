import asyncio
import inspect
from typing import Callable, Coroutine, Any, Dict, List
from datetime import datetime, timezone
import logging

logger = logging.getLogger(__name__)

class EventBusInterface:
    async def publish(self, event_type: str, payload: Dict[str, Any]) -> None:
        raise NotImplementedError

    def subscribe(self, event_type: str, callback: Callable[[Dict[str, Any]], Coroutine[Any, Any, None]]) -> None:
        raise NotImplementedError

class InMemoryEventBus(EventBusInterface):
    """
    In-memory async pub/sub event bus.
    Can be swapped seamlessly for Redis Pub/Sub in distributed environments.
    """
    def __init__(self):
        self._subscribers: Dict[str, List[Callable[[Dict[str, Any]], Coroutine[Any, Any, None]]]] = {}
        self._history: List[Dict[str, Any]] = []

    def subscribe(self, event_type: str, callback: Callable[[Dict[str, Any]], Coroutine[Any, Any, None]]) -> None:
        if event_type not in self._subscribers:
            self._subscribers[event_type] = []
        self._subscribers[event_type].append(callback)

    async def publish(self, event_type: str, payload: Dict[str, Any]) -> None:
        event = {
            "event_type": event_type,
            "payload": payload,
            "timestamp": datetime.now(timezone.utc).isoformat()
        }
        self._history.append(event)
        if len(self._history) > 500:
            self._history.pop(0)

        # Notify specific event listeners
        callbacks = list(self._subscribers.get(event_type, []))
        # Notify wildcard '*' listeners (e.g. for SSE streaming or auditing)
        callbacks.extend(self._subscribers.get("*", []))

        for callback in callbacks:
            try:
                if inspect.iscoroutinefunction(callback):
                    asyncio.create_task(callback(event))
                else:
                    callback(event)
            except Exception as e:
                logger.error(f"Error executing event subscriber for {event_type}: {e}")

    def get_recent_history(self, limit: int = 50) -> List[Dict[str, Any]]:
        return self._history[-limit:]

# Singleton instance
event_bus = InMemoryEventBus()

# Event Constants
EVENT_TRIP_STARTED = "TripStarted"
EVENT_TRIP_PROGRESS_UPDATED = "TripProgressUpdated"
EVENT_CROWD_UPDATED = "CrowdUpdated"
EVENT_TRIP_CANCELLED = "TripCancelled"
EVENT_TRIP_COMPLETED = "TripCompleted"

EVENT_GOLF_CART_REQUESTED = "GolfCartRequested"
EVENT_GOLF_CART_ASSIGNED = "GolfCartAssigned"
EVENT_GOLF_CART_STATUS_UPDATED = "GolfCartStatusUpdated"
EVENT_GOLF_CART_NO_SHOW = "GolfCartNoShow"
