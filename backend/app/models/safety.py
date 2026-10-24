from datetime import datetime
from sqlalchemy import Column, Integer, String, Float, Boolean, Text, DateTime, ForeignKey
from sqlalchemy.orm import relationship
from app.database import Base

class SosEvent(Base):
    __tablename__ = "sos_events"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    latitude = Column(Float, nullable=False)
    longitude = Column(Float, nullable=False)
    accuracy_meters = Column(Float, nullable=True)
    battery_level = Column(Integer, nullable=True)
    status = Column(String(30), default="ACTIVE", index=True)  # ACTIVE, RESOLVED, TEST
    is_test = Column(Boolean, default=True)
    trigger_type = Column(String(50), default="MANUAL_HOLD")  # MANUAL_HOLD, CRASH_DETECTED, TEST_BEACON
    notes = Column(Text, nullable=True)
    resolved_by_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    resolved_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    user = relationship("User", foreign_keys=[user_id])
    resolver = relationship("User", foreign_keys=[resolved_by_id])

class IncidentReport(Base):
    __tablename__ = "incident_reports"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    category = Column(String(50), nullable=False)  # HARASSMENT, RECKLESS_DRIVING, OVERCROWDING, LOST_ITEM, OTHER
    description = Column(Text, nullable=False)
    location = Column(String(200), nullable=False)
    vehicle_number = Column(String(50), nullable=True)
    status = Column(String(30), default="SUBMITTED", index=True)  # SUBMITTED, UNDER_REVIEW, RESOLVED
    resolution_notes = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    user = relationship("User", foreign_keys=[user_id])
