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

class StopNearMeResponse(BaseModel):
    id: int
    name: str
    code: str
    latitude: float
    longitude: float
    has_shelter: bool
    is_transfer_hub: bool
    distance_meters: int
    walk_time_mins: int

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
    schedule_type: str = "REGULAR"
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
    status_label: str
    trip_status: str

class NextDepartureItem(BaseModel):
    route_name: str
    route_code: str
    route_color: str
    departure_time: str
    day_of_week: str
    schedule_type: str
    frequency_mins: int
    mins_until_departure: int
    is_peak: bool

class NextDeparturesResponse(BaseModel):
    stop_id: int
    stop_name: str
    current_time: str
    departures: List[NextDepartureItem]

class ShuttleProgressStop(BaseModel):
    stop_id: int
    stop_name: str
    stop_order: int
    is_passed: bool
    is_current: bool
    is_next: bool
    eta_minutes: Optional[int] = None

class ShuttleProgressResponse(BaseModel):
    shuttle_id: int
    vehicle_number: str
    route_id: int
    route_name: str
    route_color: str
    status: str
    current_stop_name: Optional[str] = None
    next_stop_name: Optional[str] = None
    current_delay_sec: int
    crowd_level: str
    passenger_count: int
    capacity: int
    stops: List[ShuttleProgressStop]

class TimetableRouteGroup(BaseModel):
    route_id: int
    route_name: str
    route_code: str
    color_hex: str
    schedules: List[ScheduleResponse]

class TimetableResponse(BaseModel):
    schedule_type: str
    active_routes: List[TimetableRouteGroup]
    peak_hours_windows: List[dict]
    is_currently_peak: bool
    last_updated_at: str

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
    mode: str
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
