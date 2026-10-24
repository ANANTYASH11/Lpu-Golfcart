from datetime import datetime
from typing import Optional, List
from pydantic import BaseModel, Field

class SosTriggerRequest(BaseModel):
    latitude: float = Field(..., ge=-90.0, le=90.0)
    longitude: float = Field(..., ge=-180.0, le=180.0)
    accuracy_meters: Optional[float] = None
    battery_level: Optional[int] = Field(None, ge=0, le=100)
    is_test: bool = True
    trigger_type: str = "MANUAL_HOLD"
    notes: Optional[str] = None

class SosLocationUpdateRequest(BaseModel):
    latitude: float = Field(..., ge=-90.0, le=90.0)
    longitude: float = Field(..., ge=-180.0, le=180.0)
    accuracy_meters: Optional[float] = None
    battery_level: Optional[int] = Field(None, ge=0, le=100)

class SosResolveRequest(BaseModel):
    resolution_notes: Optional[str] = None

class SosEventResponse(BaseModel):
    id: int
    user_id: int
    user_name: Optional[str] = None
    user_email: Optional[str] = None
    latitude: float
    longitude: float
    accuracy_meters: Optional[float] = None
    battery_level: Optional[int] = None
    status: str
    is_test: bool
    trigger_type: str
    notes: Optional[str] = None
    created_at: datetime
    updated_at: datetime
    resolved_at: Optional[datetime] = None

    class Config:
        from_attributes = True

class IncidentReportCreate(BaseModel):
    category: str
    description: str
    location: str
    vehicle_number: Optional[str] = None

class IncidentReportResponse(BaseModel):
    id: int
    user_id: int
    user_name: Optional[str] = None
    category: str
    description: str
    location: str
    vehicle_number: Optional[str] = None
    status: str
    resolution_notes: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True

class HelplineInfoResponse(BaseModel):
    helpline: str
    security_desk: str
    ambulance: str
    police: str
    women_safety: str
