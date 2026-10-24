from sqlalchemy import Column, Integer, String, Boolean, DateTime, ForeignKey
from sqlalchemy.orm import relationship
from datetime import datetime, timezone
from app.database import Base

class Shuttle(Base):
    __tablename__ = "shuttles"

    id = Column(Integer, primary_key=True, index=True)
    vehicle_number = Column(String(30), unique=True, index=True, nullable=False)
    capacity = Column(Integer, default=35, nullable=False)
    status = Column(String(20), default="ACTIVE")  # ACTIVE, MAINTENANCE, INACTIVE

    trips = relationship("TripInstance", back_populates="shuttle")

class Driver(Base):
    __tablename__ = "drivers"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), unique=True, nullable=False)
    license_number = Column(String(50), nullable=False)
    driver_type = Column(String(20), default="SHUTTLE")  # SHUTTLE, GOLF_CART
    phone_number = Column(String(20), default="+91-9876543210")
    is_on_duty = Column(Boolean, default=True)

    user = relationship("User", back_populates="driver_profile")
    trips = relationship("TripInstance", back_populates="driver")
    assigned_golf_carts = relationship("GolfCart", back_populates="assigned_driver")

class TripInstance(Base):
    __tablename__ = "trip_instances"

    id = Column(Integer, primary_key=True, index=True)
    route_id = Column(Integer, ForeignKey("routes.id"), nullable=False)
    shuttle_id = Column(Integer, ForeignKey("shuttles.id"), nullable=False)
    driver_id = Column(Integer, ForeignKey("drivers.id"), nullable=False)
    
    # States: SCHEDULED, STARTED, AT_STOP, IN_TRANSIT, COMPLETED, DELAYED, CANCELLED
    status = Column(String(20), default="SCHEDULED", nullable=False)
    
    current_stop_id = Column(Integer, ForeignKey("stops.id"), nullable=True)
    next_stop_id = Column(Integer, ForeignKey("stops.id"), nullable=True)
    current_delay_sec = Column(Integer, default=0)
    current_passenger_count = Column(Integer, default=0)
    current_crowd_level = Column(String(20), default="LOW")  # LOW, MODERATE, FULL
    
    scheduled_start_time = Column(DateTime, nullable=True)
    actual_start_time = Column(DateTime, nullable=True)
    actual_end_time = Column(DateTime, nullable=True)
    last_driver_update_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    route = relationship("Route", back_populates="trips")
    shuttle = relationship("Shuttle", back_populates="trips")
    driver = relationship("Driver", back_populates="trips")
    current_stop = relationship("Stop", foreign_keys=[current_stop_id])
    next_stop = relationship("Stop", foreign_keys=[next_stop_id])
    status_updates = relationship("TripStatusUpdate", back_populates="trip", order_by="TripStatusUpdate.id.desc()")

class TripStatusUpdate(Base):
    __tablename__ = "trip_status_updates"

    id = Column(Integer, primary_key=True, index=True)
    trip_instance_id = Column(Integer, ForeignKey("trip_instances.id"), nullable=False)
    update_type = Column(String(30), nullable=False)  # START, STOP_REACHED, DEPARTED, CROWD_CHANGE, DELAY, CANCEL
    stop_id = Column(Integer, ForeignKey("stops.id"), nullable=True)
    passenger_count = Column(Integer, default=0)
    delay_sec = Column(Integer, default=0)
    notes = Column(String(200), nullable=True)
    recorded_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    trip = relationship("TripInstance", back_populates="status_updates")
    stop = relationship("Stop", foreign_keys=[stop_id])
