from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime

class PriorityStatusResponse(BaseModel):
    id: int
    user_id: int
    full_name: str
    category: str
    reason_description: str
    document_filename: str
    status: str  # PENDING, APPROVED, REJECTED, EXPIRED
    admin_notes: Optional[str] = None
    applied_at: str
    reviewed_at: Optional[str] = None
    expires_at: Optional[str] = None
    is_active_priority: bool

class AdminReviewRequest(BaseModel):
    action: str  # APPROVE or REJECT
    notes: Optional[str] = None
    validity_days: int = 180  # Default 6 months approval

class AdminApplicationItem(BaseModel):
    id: int
    user_id: int
    username: str
    email: str
    full_name: str
    reg_number: Optional[str] = None
    category: str
    reason_description: str
    document_filename: str
    document_size_kb: int
    status: str
    applied_at: str
