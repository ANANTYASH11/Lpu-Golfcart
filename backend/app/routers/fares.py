from fastapi import APIRouter, Depends, Query, HTTPException
from sqlalchemy.orm import Session
from typing import Optional, List, Dict, Any

from app.database import get_db
from app.auth import get_current_user_optional
from app.models.user import User
from app.models.transport import Stop
from app.services.fare_engine import calculate_fare, is_campus_peak_hour

router = APIRouter(prefix="/fares", tags=["Fare Engine & Calculator"])

@router.get("/calculate")
def get_fare_calculation(
    pickup_stop_id: int = Query(...),
    drop_stop_id: int = Query(...),
    vehicle_type: Optional[str] = Query(None, description="SHUTTLE, GOLF_CART, ERICKSHAW, or None for all"),
    is_priority: Optional[bool] = Query(None),
    current_user: Optional[User] = Depends(get_current_user_optional),
    db: Session = Depends(get_db)
):
    """
    Unified fare calculation endpoint for both the Fare Calculator and the Ride Booking flow.
    If vehicle_type is None, returns quote for all three vehicles (Shuttle, Golf Cart, E-Rickshaw).
    """
    pickup = db.query(Stop).filter(Stop.id == pickup_stop_id).first()
    drop = db.query(Stop).filter(Stop.id == drop_stop_id).first()
    if not pickup or not drop:
        raise HTTPException(status_code=404, detail="One or both campus stops not found")
        
    # Check priority: Explicit query param or user account status
    user_prio = False
    if is_priority is not None:
        user_prio = is_priority
    elif current_user:
        user_prio = bool(current_user.is_priority)
        
    if vehicle_type:
        quote = calculate_fare(
            db=db,
            pickup_stop_id=pickup_stop_id,
            drop_stop_id=drop_stop_id,
            vehicle_type=vehicle_type,
            is_priority=user_prio
        )
        return {
            "pickup_stop": {"id": pickup.id, "name": pickup.name, "code": pickup.code},
            "drop_stop": {"id": drop.id, "name": drop.name, "code": drop.code},
            "quote": quote
        }
    else:
        # Return all options
        shuttle_quote = calculate_fare(db, pickup.id, drop.id, "SHUTTLE", user_prio)
        cart_quote = calculate_fare(db, pickup.id, drop.id, "GOLF_CART", user_prio)
        rickshaw_quote = calculate_fare(db, pickup.id, drop.id, "ERICKSHAW", user_prio)
        
        return {
            "pickup_stop": {"id": pickup.id, "name": pickup.name, "code": pickup.code},
            "drop_stop": {"id": drop.id, "name": drop.name, "code": drop.code},
            "is_priority_applied": user_prio,
            "options": [shuttle_quote, cart_quote, rickshaw_quote]
        }

@router.get("/rules")
def get_fare_rules():
    """Returns admin-configured fare table and peak windows."""
    return {
        "currency": "INR",
        "shuttle": {
            "fare_model": "FREE",
            "base_fare": 0,
            "description": "Subsidized by LPU Department of Student Welfare"
        },
        "golf_cart": {
            "fare_model": "METERED",
            "base_fare": 10,
            "per_km_rate": 5,
            "peak_surcharge_percent": 25,
            "priority_discount_percent": 100,
            "description": "On-demand electric transit across designated campus paths"
        },
        "erickshaw": {
            "fare_model": "ZONE_FLAT",
            "standard_zone_fare": 15,
            "description": "Regulated campus operator fixed zone tariffs"
        },
        "peak_hours": [
            {"name": "Morning Lecture Rush", "start": "08:30", "end": "09:30"},
            {"name": "Midday Lunch Transition", "start": "12:30", "end": "13:30"},
            {"name": "Evening Departure", "start": "16:30", "end": "17:30"}
        ],
        "is_currently_peak": is_campus_peak_hour()
    }
