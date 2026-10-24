from sqlalchemy import Column, Integer, String, Boolean, DateTime
from sqlalchemy.orm import relationship
from datetime import datetime, timezone
from app.database import Base

class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    username = Column(String(50), unique=True, index=True, nullable=False)
    email = Column(String(100), unique=True, index=True, nullable=False)
    hashed_password = Column(String(255), nullable=False)
    role = Column(String(20), default="STUDENT", nullable=False)  # STUDENT, DRIVER, ADMIN
    
    # Priority status for Last-Mile & Golf Cart booking
    is_priority = Column(Boolean, default=False)  # differently-abled, medical, elderly visitors
    priority_reason = Column(String(100), nullable=True)  # e.g., "Differently-Abled", "Medical Need"
    
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    driver_profile = relationship("Driver", back_populates="user", uselist=False)
    bookings = relationship("BookingRequest", back_populates="student")
