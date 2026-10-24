from datetime import datetime, timezone
from typing import Optional, Tuple
from sqlalchemy.orm import Session

from app.config import settings
from app.models.transport import Route, RouteStop, Schedule
from app.models.shuttle_ops import TripInstance

def calculate_crowd_level(passenger_count: int, capacity: int) -> str:
    """
    Crowd level based on occupancy/capacity:
    < 40% Low, 40-80% Moderate, > 80% Full
    """
    if capacity <= 0:
        return "LOW"
    ratio = passenger_count / capacity
    if ratio < settings.CROWD_LOW_THRESHOLD:
        return "LOW"
    elif ratio <= settings.CROWD_MODERATE_THRESHOLD:
        return "MODERATE"
    else:
        return "FULL"

def is_trip_live_valid(trip: TripInstance, now: Optional[datetime] = None) -> bool:
    """
    Mark data 'Live unavailable' if there has been no driver update for 5 minutes (300 sec).
    """
    if not trip.last_driver_update_at:
        return False
    if now is None:
        now = datetime.now(timezone.utc)
    
    # Handle timezone naive vs aware
    update_time = trip.last_driver_update_at
    if update_time.tzinfo is None:
        update_time = update_time.replace(tzinfo=timezone.utc)
    if now.tzinfo is None:
        now = now.replace(tzinfo=timezone.utc)
        
    delta_seconds = (now - update_time).total_seconds()
    return delta_seconds <= settings.LIVE_STALENESS_THRESHOLD_SEC

def compute_trip_eta_to_stop(
    db: Session,
    trip: TripInstance,
    target_stop_id: int,
    now: Optional[datetime] = None
) -> Tuple[bool, Optional[int], Optional[str], str]:
    """
    Computes:
    (is_live, eta_seconds, status_label, crowd_level)
    
    Live ETA = now + sum(avg segment times for remaining stops) + dwell time,
    adjusted by current delay.
    Falls back to schedule if no live data or if > 5 minutes without driver update.
    """
    if now is None:
        now = datetime.now(timezone.utc)
        
    crowd_level = trip.current_crowd_level or calculate_crowd_level(
        trip.current_passenger_count, trip.shuttle.capacity if trip.shuttle else 35
    )
    
    # Check if trip is cancelled or completed
    if trip.status == "CANCELLED":
        return False, None, "Trip Cancelled", crowd_level
    if trip.status == "COMPLETED":
        return False, None, "Trip Completed", crowd_level
        
    is_live = is_trip_live_valid(trip, now) and trip.status in ["STARTED", "AT_STOP", "IN_TRANSIT", "DELAYED"]
    
    # Ordered stops for the route
    route_stops = db.query(RouteStop).filter(
        RouteStop.route_id == trip.route_id
    ).order_by(RouteStop.stop_order).all()
    
    if not route_stops:
        return False, None, "No route info", crowd_level
        
    stop_map = {rs.stop_id: rs for rs in route_stops}
    target_rs = stop_map.get(target_stop_id)
    if not target_rs:
        return False, None, "Stop not on route", crowd_level
        
    if not is_live:
        # Fallback to schedule
        sched = db.query(Schedule).filter(Schedule.route_id == trip.route_id).first()
        sched_time_str = sched.departure_time if sched else "Scheduled"
        return False, None, f"Live unavailable (Scheduled {sched_time_str})", crowd_level

    current_stop_id = trip.current_stop_id or route_stops[0].stop_id
    current_rs = stop_map.get(current_stop_id, route_stops[0])
    
    # Determine segment from current position to target
    # If circular or linear:
    curr_order = current_rs.stop_order
    target_order = target_rs.stop_order
    
    if curr_order > target_order:
        # Shuttle has already passed target stop on this run
        return False, None, "Passed stop", crowd_level
    elif curr_order == target_order:
        if trip.status == "AT_STOP":
            return True, 0, "Boarding now at stop", crowd_level
        else:
            eta_sec = max(0, 30 + trip.current_delay_sec)
            return True, eta_sec, "Arriving momentarily", crowd_level

    # Sum segment times and dwell times
    total_travel_time_sec = 0
    intermediate_dwell_sec = 0
    
    for rs in route_stops:
        if curr_order < rs.stop_order <= target_order:
            total_travel_time_sec += (rs.avg_segment_time_sec or 180)
        if curr_order < rs.stop_order < target_order:
            intermediate_dwell_sec += (rs.default_dwell_time_sec or 45)
            
    eta_sec = max(0, total_travel_time_sec + intermediate_dwell_sec + (trip.current_delay_sec or 0))
    eta_mins = round(eta_sec / 60)
    
    delay_note = f" (Delayed {round(trip.current_delay_sec / 60)} min)" if trip.current_delay_sec and trip.current_delay_sec > 60 else ""
    if eta_mins <= 0:
        label = f"Arriving momentarily{delay_note}"
    elif eta_mins == 1:
        label = f"Arrives in ~1 min{delay_note}"
    else:
        label = f"Arrives in ~{eta_mins} min{delay_note}"
        
    return True, eta_sec, label, crowd_level
