from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime
from app.schemas.transport import StopResponse

class ErickshawStandResponse(BaseModel):
    id: int
    name: str
    nearby_stop_id: int
    availability_status: str
    estimated_rickshaws_present: int
    last_verified_at: datetime
    nearby_stop: Optional[StopResponse] = None

    class Config:
        from_attributes = True

class ErickshawFareResponse(BaseModel):
    id: int
    from_stand_id: int
    to_stand_id: int
    fare_inr: int

    class Config:
        from_attributes = True

class FareQuoteResponse(BaseModel):
    from_stand: str
    to_stand: str
    fare_inr: int
    estimated_availability: str

class GolfCartResponse(BaseModel):
    id: int
    cart_code: str
    capacity: int
    status: str
    current_stop_id: Optional[int] = None
    assigned_driver_id: Optional[int] = None
    last_location_update_at: datetime
    current_stop: Optional[StopResponse] = None

    class Config:
        from_attributes = True

class BookingCreateRequest(BaseModel):
    pickup_stop_id: int
    drop_stop_id: int
    passenger_count: int = 1
    scheduled_for: Optional[datetime] = None
    is_priority: Optional[bool] = None
    priority_reason: Optional[str] = None

class BookingStatusUpdateRequest(BaseModel):
    action: str  # ACCEPT, REJECT, ARRIVING, PICKED_UP, COMPLETE, CANCEL, NO_SHOW
    reason: Optional[str] = None

class BookingResponse(BaseModel):
    id: int
    student_id: int
    pickup_stop_id: int
    drop_stop_id: int
    passenger_count: int
    is_priority: bool
    priority_reason: Optional[str] = None
    requested_at: datetime
    scheduled_for: Optional[datetime] = None
    status: str
    assigned_cart_id: Optional[int] = None
    queue_position: int
    estimated_wait_mins: int
    no_show_deadline: Optional[datetime] = None
    pickup_stop: Optional[StopResponse] = None
    drop_stop: Optional[StopResponse] = None
    assigned_cart: Optional[GolfCartResponse] = None

    class Config:
        from_attributes = True

class AvailableCartsResponse(BaseModel):
    total_carts: int
    available_carts: List[GolfCartResponse]
    busy_carts_count: int
