from sqlalchemy import Column, Integer, String, Boolean, DateTime, ForeignKey, Text
from sqlalchemy.orm import relationship
from datetime import datetime, timezone
from app.database import Base

class PriorityApplication(Base):
    __tablename__ = "priority_applications"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    full_name = Column(String(100), nullable=False)
    reg_number = Column(String(50), nullable=True)  # LPU Registration Number / Visitor ID
    category = Column(String(50), nullable=False)  # MEDICAL, DIFFERENTLY_ABLED, ELDERLY_VISITOR, TEMPORARY_INJURY
    reason_description = Column(Text, nullable=False)
    document_filename = Column(String(255), nullable=False)
    document_path = Column(String(500), nullable=False)
    document_mime_type = Column(String(50), nullable=False)
    document_size_bytes = Column(Integer, nullable=False)
    status = Column(String(30), default="PENDING", nullable=False, index=True)  # PENDING, APPROVED, REJECTED, EXPIRED
    admin_notes = Column(Text, nullable=True)
    reviewed_by_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    reviewed_at = Column(DateTime, nullable=True)
    expires_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), nullable=False)
    updated_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc), nullable=False)

    user = relationship("User", foreign_keys=[user_id])
    reviewer = relationship("User", foreign_keys=[reviewed_by_id])
