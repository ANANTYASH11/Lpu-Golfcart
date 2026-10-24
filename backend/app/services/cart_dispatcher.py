from datetime import datetime, timezone, timedelta
from typing import Optional, List
from sqlalchemy.orm import Session
import math
import logging

from app.config import settings
from app.models.last_mile import GolfCart, BookingRequest
from app.models.transport import Stop
from app.events import (
    event_bus,
    EVENT_GOLF_CART_REQUESTED,
    EVENT_GOLF_CART_ASSIGNED,
    EVENT_GOLF_CART_STATUS_UPDATED,
    EVENT_GOLF_CART_NO_SHOW
)

logger = logging.getLogger(__name__)

def estimate_travel_minutes_between_stops(db: Session, from_stop_id: int, to_stop_id: int) -> int:
    """
    Computes estimated travel time in minutes based on geo distance between campus stops.
    LPU campus is ~3 km end-to-end, golf cart speed ~15 km/h.
    """
    if from_stop_id == to_stop_id:
        return 1
    
    stop1 = db.query(Stop).filter(Stop.id == from_stop_id).first()
    stop2 = db.query(Stop).filter(Stop.id == to_stop_id).first()
    
    if not stop1 or not stop2:
        return 3
        
    # Haversine formula
    lat1, lon1 = math.radians(stop1.latitude), math.radians(stop1.longitude)
    lat2, lon2 = math.radians(stop2.latitude), math.radians(stop2.longitude)
    
    dlat = lat2 - lat1
    dlon = lon2 - lon1
    a = math.sin(dlat / 2)**2 + math.cos(lat1) * math.cos(lat2) * math.sin(dlon / 2)**2
    c = 2 * math.asin(math.sqrt(a))
    dist_km = 6371 * c
    
    # 15 km/h speed -> min = dist_km / 15 * 60
    est_mins = max(1, math.ceil(dist_km / 15.0 * 60))
    return min(est_mins, 15)

def update_queue_positions_and_wait_times(db: Session):
    """
    Recalculates queue positions for all unassigned REQUESTED bookings.
    Priority requests (differently-abled, medical, elderly) are placed first,
    ordered by requested_at.
    """
    pending = db.query(BookingRequest).filter(
        BookingRequest.status == "REQUESTED",
        BookingRequest.assigned_cart_id.is_(None)
    ).all()
    
    # Sort: Priority first (is_priority True), then by requested_at
    sorted_pending = sorted(
        pending,
        key=lambda b: (not b.is_priority, b.requested_at or datetime.now(timezone.utc))
    )
    
    for idx, booking in enumerate(sorted_pending, start=1):
        booking.queue_position = idx
        # Estimated wait time based on queue depth: ~4-5 mins per queue slot
        booking.estimated_wait_mins = max(2, idx * 4)
    
    db.commit()

async def auto_assign_cart_or_enqueue(db: Session, booking: BookingRequest) -> Optional[GolfCart]:
    """
    Auto-assigns the nearest idle golf cart with sufficient capacity.
    If no cart is available, places request into priority queue.
    """
    # Find idle carts that can hold the requested number of passengers
    idle_carts = db.query(GolfCart).filter(
        GolfCart.status == "IDLE",
        GolfCart.capacity >= booking.passenger_count
    ).all()
    
    if idle_carts:
        # Rank by travel time to pickup stop
        ranked_carts = []
        for cart in idle_carts:
            travel_mins = estimate_travel_minutes_between_stops(
                db, cart.current_stop_id or booking.pickup_stop_id, booking.pickup_stop_id
            )
            ranked_carts.append((travel_mins, cart))
            
        ranked_carts.sort(key=lambda x: x[0])
        best_travel_mins, best_cart = ranked_carts[0]
        
        # Assign cart
        booking.assigned_cart_id = best_cart.id
        booking.status = "ACCEPTED"
        booking.queue_position = 0
        booking.estimated_wait_mins = best_travel_mins
        
        best_cart.status = "ASSIGNED"
        db.commit()
        
        # Publish event
        await event_bus.publish(EVENT_GOLF_CART_ASSIGNED, {
            "booking_id": booking.id,
            "student_id": booking.student_id,
            "cart_id": best_cart.id,
            "cart_code": best_cart.cart_code,
            "pickup_stop_id": booking.pickup_stop_id,
            "estimated_wait_mins": best_travel_mins,
            "status": "ACCEPTED"
        })
        return best_cart
    else:
        # No idle cart, enqueue
        booking.status = "REQUESTED"
        booking.assigned_cart_id = None
        db.commit()
        update_queue_positions_and_wait_times(db)
        
        await event_bus.publish(EVENT_GOLF_CART_REQUESTED, {
            "booking_id": booking.id,
            "student_id": booking.student_id,
            "pickup_stop_id": booking.pickup_stop_id,
            "queue_position": booking.queue_position,
            "estimated_wait_mins": booking.estimated_wait_mins,
            "is_priority": booking.is_priority,
            "status": "REQUESTED"
        })
        return None

async def reassign_cart_if_queue_pending(db: Session, cart: GolfCart):
    """
    Called when a cart becomes free (IDLE). Checks priority queue for any waiting requests.
    """
    pending = db.query(BookingRequest).filter(
        BookingRequest.status == "REQUESTED",
        BookingRequest.assigned_cart_id.is_(None),
        BookingRequest.passenger_count <= cart.capacity
    ).all()
    
    if not pending:
        cart.status = "IDLE"
        db.commit()
        return
        
    # Sort with priority first
    sorted_pending = sorted(
        pending,
        key=lambda b: (not b.is_priority, b.requested_at or datetime.now(timezone.utc))
    )
    
    next_booking = sorted_pending[0]
    travel_mins = estimate_travel_minutes_between_stops(
        db, cart.current_stop_id or next_booking.pickup_stop_id, next_booking.pickup_stop_id
    )
    
    next_booking.assigned_cart_id = cart.id
    next_booking.status = "ACCEPTED"
    next_booking.queue_position = 0
    next_booking.estimated_wait_mins = travel_mins
    
    cart.status = "ASSIGNED"
    db.commit()
    
    update_queue_positions_and_wait_times(db)
    
    await event_bus.publish(EVENT_GOLF_CART_ASSIGNED, {
        "booking_id": next_booking.id,
        "student_id": next_booking.student_id,
        "cart_id": cart.id,
        "cart_code": cart.cart_code,
        "pickup_stop_id": next_booking.pickup_stop_id,
        "estimated_wait_mins": travel_mins,
        "status": "ACCEPTED"
    })

async def check_and_expire_no_shows(db: Session):
    """
    Scans for bookings in 'ARRIVING' state where no_show_deadline has elapsed (> 5 mins).
    Auto-cancels booking as NO_SHOW, frees cart, and triggers queue reassignment.
    """
    now = datetime.now(timezone.utc)
    expired_bookings = db.query(BookingRequest).filter(
        BookingRequest.status == "ARRIVING",
        BookingRequest.no_show_deadline.isnot(None)
    ).all()
    
    for b in expired_bookings:
        deadline = b.no_show_deadline
        if deadline.tzinfo is None:
            deadline = deadline.replace(tzinfo=timezone.utc)
            
        if now >= deadline:
            b.status = "NO_SHOW"
            assigned_cart = b.assigned_cart
            b.assigned_cart_id = None
            db.commit()
            
            await event_bus.publish(EVENT_GOLF_CART_NO_SHOW, {
                "booking_id": b.id,
                "student_id": b.student_id,
                "reason": "Passenger did not board within 5 minutes of cart arrival"
            })
            
            if assigned_cart:
                assigned_cart.status = "IDLE"
                db.commit()
                await reassign_cart_if_queue_pending(db, assigned_cart)
