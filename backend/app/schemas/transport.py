from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime

class StopResponse(BaseModel):
    id: int
    name: str
    code: str
    latitude: float
    longitude: float
    has_shelter: bool
    is_transfer_hub: bool

    class Config:
        from_attributes = True

class RouteStopResponse(BaseModel):
    id: int
    stop_id: int
    stop_order: int
    avg_segment_time_sec: int
    default_dwell_time_sec: int
    stop: StopResponse

    class Config:
        from_attributes = True

class RouteResponse(BaseModel):
    id: int
    name: str
    code: str
    color_hex: str
    is_active: bool
    route_stops: List[RouteStopResponse] = []

    class Config:
        from_attributes = True

class ScheduleResponse(BaseModel):
    id: int
    route_id: int
    departure_time: str
    day_of_week: str
    frequency_mins: int

    class Config:
        from_attributes = True

class TripArrivalResponse(BaseModel):
    trip_id: int
    route_id: int
    route_name: str
    route_code: str
    route_color: str
    vehicle_number: str
    current_stop_name: Optional[str] = None
    next_stop_name: Optional[str] = None
    target_stop_name: str
    scheduled_departure_time: Optional[str] = None
    live_eta_iso: Optional[str] = None
    eta_seconds: Optional[int] = None
    eta_minutes: Optional[int] = None
    current_delay_sec: int = 0
    current_passenger_count: int = 0
    crowd_level: str = "LOW"  # LOW, MODERATE, FULL
    is_live: bool = True
    status_label: str  # "Arriving in 3 min", "Delayed 2 min", "Live unavailable (Scheduled 09:15)"
    trip_status: str

class JourneyLegShuttle(BaseModel):
    route_name: str
    route_code: str
    route_color: str
    vehicle_number: str
    from_stop_name: str
    to_stop_name: str
    live_eta_minutes: Optional[int] = None
    crowd_level: str
    is_full: bool
    status_label: str

class JourneyLegLastMile(BaseModel):
    mode: str  # GOLF_CART or E_RICKSHAW
    description: str
    origin_point: str
    destination_point: str
    estimated_wait_minutes: Optional[int] = None
    estimated_fare_inr: Optional[int] = None
    availability_status: str
    bookable: bool = False
    details: Optional[dict] = None

class JourneyResponse(BaseModel):
    from_stop: StopResponse
    to_stop: StopResponse
    recommendation_summary: str
    shuttle_leg: Optional[JourneyLegShuttle] = None
    alternative_shuttle_leg: Optional[JourneyLegShuttle] = None
    last_mile_option: Optional[JourneyLegLastMile] = None
    alternative_options: List[JourneyLegLastMile] = []
