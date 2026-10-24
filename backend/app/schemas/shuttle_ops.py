from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime

class TripStartRequest(BaseModel):
    start_stop_id: Optional[int] = None

class TripProgressRequest(BaseModel):
    next_stop_id: int
    delay_sec: int = 0
    passenger_count: Optional[int] = None
    notes: Optional[str] = None

class CrowdUpdateRequest(BaseModel):
    passenger_count: int
    notes: Optional[str] = None

class TripCancelRequest(BaseModel):
    reason: str

class TripStatusUpdateResponse(BaseModel):
    id: int
    update_type: str
    stop_id: Optional[int] = None
    passenger_count: int
    delay_sec: int
    notes: Optional[str] = None
    recorded_at: datetime

    class Config:
        from_attributes = True

class ShuttleResponse(BaseModel):
    id: int
    vehicle_number: str
    capacity: int
    status: str

    class Config:
        from_attributes = True

class TripInstanceResponse(BaseModel):
    id: int
    route_id: int
    shuttle_id: int
    driver_id: int
    status: str
    current_stop_id: Optional[int] = None
    next_stop_id: Optional[int] = None
    current_delay_sec: int
    current_passenger_count: int
    current_crowd_level: str
    last_driver_update_at: datetime
    shuttle: Optional[ShuttleResponse] = None

    class Config:
        from_attributes = True
