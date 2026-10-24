from sqlalchemy import Column, Integer, String, Float, Boolean, ForeignKey
from sqlalchemy.orm import relationship
from app.database import Base

class Stop(Base):
    __tablename__ = "stops"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), nullable=False)
    code = Column(String(20), unique=True, index=True, nullable=False)
    latitude = Column(Float, nullable=False)
    longitude = Column(Float, nullable=False)
    has_shelter = Column(Boolean, default=True)
    is_transfer_hub = Column(Boolean, default=False)

    route_stops = relationship("RouteStop", back_populates="stop")
    erickshaw_stands = relationship("ErickshawStand", back_populates="nearby_stop")

class Route(Base):
    __tablename__ = "routes"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), nullable=False)
    code = Column(String(20), unique=True, index=True, nullable=False)
    color_hex = Column(String(10), default="#2563EB")
    is_active = Column(Boolean, default=True)

    route_stops = relationship("RouteStop", back_populates="route", order_by="RouteStop.stop_order")
    schedules = relationship("Schedule", back_populates="route")
    trips = relationship("TripInstance", back_populates="route")

class RouteStop(Base):
    __tablename__ = "route_stops"

    id = Column(Integer, primary_key=True, index=True)
    route_id = Column(Integer, ForeignKey("routes.id"), nullable=False)
    stop_id = Column(Integer, ForeignKey("stops.id"), nullable=False)
    stop_order = Column(Integer, nullable=False)
    avg_segment_time_sec = Column(Integer, default=180)  # driving time from previous stop
    default_dwell_time_sec = Column(Integer, default=45) # loading / waiting time at stop

    route = relationship("Route", back_populates="route_stops")
    stop = relationship("Stop", back_populates="route_stops")

class Schedule(Base):
    __tablename__ = "schedules"

    id = Column(Integer, primary_key=True, index=True)
    route_id = Column(Integer, ForeignKey("routes.id"), nullable=False)
    departure_time = Column(String(8), nullable=False)  # HH:MM:SS
    day_of_week = Column(String(20), default="ALL")    # ALL, WEEKDAY, WEEKEND
    frequency_mins = Column(Integer, default=15)

    route = relationship("Route", back_populates="schedules")
