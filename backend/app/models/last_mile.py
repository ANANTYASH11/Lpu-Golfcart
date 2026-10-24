from sqlalchemy import Column, Integer, String, Boolean, DateTime, ForeignKey
from sqlalchemy.orm import relationship
from datetime import datetime, timezone
from app.database import Base

class ErickshawStand(Base):
    __tablename__ = "erickshaw_stands"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), nullable=False)
    nearby_stop_id = Column(Integer, ForeignKey("stops.id"), nullable=False)
    # Availability: AVAILABLE, LIMITED, NONE, UNKNOWN
    availability_status = Column(String(20), default="AVAILABLE", nullable=False)
    estimated_rickshaws_present = Column(Integer, default=5)
    last_verified_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    nearby_stop = relationship("Stop", back_populates="erickshaw_stands")
    fares_from = relationship("ErickshawFare", foreign_keys="ErickshawFare.from_stand_id", back_populates="from_stand")
    fares_to = relationship("ErickshawFare", foreign_keys="ErickshawFare.to_stand_id", back_populates="to_stand")

class ErickshawFare(Base):
    __tablename__ = "erickshaw_fares"

    id = Column(Integer, primary_key=True, index=True)
    from_stand_id = Column(Integer, ForeignKey("erickshaw_stands.id"), nullable=False)
    to_stand_id = Column(Integer, ForeignKey("erickshaw_stands.id"), nullable=False)
    fare_inr = Column(Integer, nullable=False)  # Flat campus fares: 10, 15, 20

    from_stand = relationship("ErickshawStand", foreign_keys=[from_stand_id], back_populates="fares_from")
    to_stand = relationship("ErickshawStand", foreign_keys=[to_stand_id], back_populates="fares_to")

class GolfCart(Base):
    __tablename__ = "golf_carts"

    id = Column(Integer, primary_key=True, index=True)
    cart_code = Column(String(20), unique=True, index=True, nullable=False)  # e.g., GC-01, GC-02
    capacity = Column(Integer, default=4, nullable=False)  # 4 or 6 seats
    # Statuses: IDLE, ASSIGNED, EN_ROUTE, IN_SERVICE, MAINTENANCE
    status = Column(String(20), default="IDLE", nullable=False)
    current_stop_id = Column(Integer, ForeignKey("stops.id"), nullable=True)
    assigned_driver_id = Column(Integer, ForeignKey("drivers.id"), nullable=True)
    last_location_update_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    current_stop = relationship("Stop")
    assigned_driver = relationship("Driver", back_populates="assigned_golf_carts")
    bookings = relationship("BookingRequest", back_populates="assigned_cart")

class BookingRequest(Base):
    __tablename__ = "booking_requests"

    id = Column(Integer, primary_key=True, index=True)
    student_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    pickup_stop_id = Column(Integer, ForeignKey("stops.id"), nullable=False)
    drop_stop_id = Column(Integer, ForeignKey("stops.id"), nullable=False)
    passenger_count = Column(Integer, default=1, nullable=False)
    
    # Priority
    is_priority = Column(Boolean, default=False)
    priority_reason = Column(String(100), nullable=True)
    
    # Vehicle and Fare
    vehicle_type = Column(String(20), default="GOLF_CART", nullable=False)  # GOLF_CART, SHUTTLE, ERICKSHAW
    fare_amount_paise = Column(Integer, default=0, nullable=False)
    payment_method = Column(String(30), default="CASH", nullable=False)  # CASH, WALLET, RAZORPAY_UPI, RAZORPAY_CARD, FREE
    payment_status = Column(String(20), default="PENDING", nullable=False)  # PENDING, PAID, REFUNDED
    
    requested_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    scheduled_for = Column(DateTime, nullable=True)
    
    # Status: REQUESTED, ACCEPTED, ARRIVING, PICKED_UP, COMPLETED, CANCELLED, REJECTED, NO_SHOW
    status = Column(String(20), default="REQUESTED", nullable=False)
    
    assigned_cart_id = Column(Integer, ForeignKey("golf_carts.id"), nullable=True)
    queue_position = Column(Integer, default=0)
    estimated_wait_mins = Column(Integer, default=0)
    no_show_deadline = Column(DateTime, nullable=True)  # Set when ARRIVING: 5 min limit

    # Rating and Feedback
    rating = Column(Integer, nullable=True)  # 1 to 5
    feedback = Column(String(255), nullable=True)
    cancellation_reason = Column(String(255), nullable=True)

    student = relationship("User", back_populates="bookings")
    pickup_stop = relationship("Stop", foreign_keys=[pickup_stop_id])
    drop_stop = relationship("Stop", foreign_keys=[drop_stop_id])
    assigned_cart = relationship("GolfCart", back_populates="bookings")

