from datetime import datetime, timezone
import math
from typing import Optional, Dict, Any, List
from sqlalchemy.orm import Session

from app.models.transport import Stop
from app.models.last_mile import ErickshawStand, ErickshawFare

def calculate_haversine_distance_km(stop1: Stop, stop2: Stop) -> float:
    """Calculates great-circle distance between two campus stops in km."""
    if not stop1 or not stop2 or stop1.id == stop2.id:
        return 0.0
    
    lat1, lon1 = math.radians(stop1.latitude), math.radians(stop1.longitude)
    lat2, lon2 = math.radians(stop2.latitude), math.radians(stop2.longitude)
    
    dlat = lat2 - lat1
    dlon = lon2 - lon1
    a = math.sin(dlat / 2)**2 + math.cos(lat1) * math.cos(lat2) * math.sin(dlon / 2)**2
    c = 2 * math.asin(math.sqrt(max(0.0, min(1.0, a))))
    return round(6371.0 * c, 2)

def is_campus_peak_hour(dt: Optional[datetime] = None) -> bool:
    """
    Checks if a given datetime (or current UTC/IST) falls in LPU lecture rush windows:
    - Morning Lecture Rush: 08:30 - 09:30
    - Midday Lunch Rush:   12:30 - 13:30
    - Evening Transit Rush: 16:30 - 17:30
    """
    if dt is None:
        dt = datetime.now(timezone.utc)
    
    # Simple check based on time of day (HH:MM)
    time_str = dt.strftime("%H:%M")
    peak_windows = [
        ("08:30", "09:30"),
        ("12:30", "13:30"),
        ("16:30", "17:30"),
    ]
    for start, end in peak_windows:
        if start <= time_str <= end:
            return True
    return False

def calculate_fare(
    db: Session,
    pickup_stop_id: int,
    drop_stop_id: int,
    vehicle_type: str = "GOLF_CART",
    is_priority: bool = False,
    scheduled_time: Optional[datetime] = None
) -> Dict[str, Any]:
    """
    Unified Server-Side Fare Engine for UniCart.
    Used by BOTH the Fare Calculator and the Ride Booking flow.
    """
    pickup = db.query(Stop).filter(Stop.id == pickup_stop_id).first()
    drop = db.query(Stop).filter(Stop.id == drop_stop_id).first()
    
    distance_km = 0.5  # default minimal campus hop
    if pickup and drop:
        distance_km = max(0.2, calculate_haversine_distance_km(pickup, drop))
    
    v_type = vehicle_type.upper()
    is_peak = is_campus_peak_hour(scheduled_time)
    
    breakdown: List[str] = []
    
    if v_type == "SHUTTLE":
        breakdown.append("LPU Student Shuttle: 100% University Subsidized (Free)")
        return {
            "vehicle_type": "SHUTTLE",
            "base_fare_inr": 0,
            "distance_km": distance_km,
            "distance_fare_inr": 0,
            "is_peak": is_peak,
            "peak_surcharge_inr": 0,
            "is_priority": is_priority,
            "priority_discount_inr": 0,
            "final_fare_inr": 0,
            "final_fare_paise": 0,
            "currency": "INR",
            "breakdown": breakdown,
            "label": "Free Campus Transit"
        }
        
    elif v_type == "ERICKSHAW":
        # Check if designated stands match nearby stops
        fare_inr = 15  # standard authorized flat rate across LPU zones
        stand1 = db.query(ErickshawStand).filter(ErickshawStand.nearby_stop_id == pickup_stop_id).first()
        stand2 = db.query(ErickshawStand).filter(ErickshawStand.nearby_stop_id == drop_stop_id).first()
        if stand1 and stand2:
            db_fare = db.query(ErickshawFare).filter(
                ErickshawFare.from_stand_id == stand1.id,
                ErickshawFare.to_stand_id == stand2.id
            ).first()
            if db_fare:
                fare_inr = db_fare.fare_inr
                
        breakdown.append(f"Authorized LPU E-Rickshaw Stand Flat Tariff: ₹{fare_inr}")
        return {
            "vehicle_type": "ERICKSHAW",
            "base_fare_inr": fare_inr,
            "distance_km": distance_km,
            "distance_fare_inr": 0,
            "is_peak": False,  # E-rickshaws have fixed campus union tariff
            "peak_surcharge_inr": 0,
            "is_priority": False,
            "priority_discount_inr": 0,
            "final_fare_inr": fare_inr,
            "final_fare_paise": fare_inr * 100,
            "currency": "INR",
            "breakdown": breakdown,
            "label": "Fixed Zone Tariff"
        }
        
    else:
        # GOLF_CART: Point-to-point on-demand express
        base_fare = 10
        dist_rate_per_km = 5
        distance_fare = max(2, int(round(distance_km * dist_rate_per_km)))
        subtotal = base_fare + distance_fare
        
        breakdown.append(f"Base Campus Pickup: ₹{base_fare}")
        breakdown.append(f"Campus Transit ({distance_km} km @ ₹{dist_rate_per_km}/km): ₹{distance_fare}")
        
        peak_surcharge = 0
        if is_peak:
            peak_surcharge = int(math.ceil(subtotal * 0.25))  # +25% peak surge
            subtotal += peak_surcharge
            breakdown.append(f"Lecture Rush Peak Surcharge (+25%): +₹{peak_surcharge}")
            
        priority_discount = 0
        if is_priority:
            priority_discount = subtotal
            breakdown.append(f"Medical & Accessibility Priority Pass: -₹{priority_discount} (100% Off)")
            subtotal = 0
        else:
            breakdown.append("Standard Student Tariff")
            
        final_fare_inr = max(0, subtotal)
        return {
            "vehicle_type": "GOLF_CART",
            "base_fare_inr": base_fare,
            "distance_km": distance_km,
            "distance_fare_inr": distance_fare,
            "is_peak": is_peak,
            "peak_surcharge_inr": peak_surcharge,
            "is_priority": is_priority,
            "priority_discount_inr": priority_discount,
            "final_fare_inr": final_fare_inr,
            "final_fare_paise": final_fare_inr * 100,
            "currency": "INR",
            "breakdown": breakdown,
            "label": "Point-to-Point Express"
        }
