import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool
from fastapi.testclient import TestClient
from datetime import datetime, timezone

from app.database import Base, get_db
from app.main import app
from app.auth import create_access_token, hash_password
from app.models.user import User
from app.models.transport import Stop, Route, RouteStop, Schedule
from app.models.shuttle_ops import Shuttle, Driver, TripInstance, TripStatusUpdate
from app.models.last_mile import GolfCart, BookingRequest, ErickshawStand, ErickshawFare

# In-memory SQLite database with StaticPool so all sessions share the in-memory DB
TEST_DATABASE_URL = "sqlite:///:memory:"
engine = create_engine(
    TEST_DATABASE_URL,
    connect_args={"check_same_thread": False},
    poolclass=StaticPool
)
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

@pytest.fixture(scope="function")
def db():
    Base.metadata.create_all(bind=engine)
    session = TestingSessionLocal()
    
    # Seed test data
    now = datetime.now(timezone.utc)
    
    # Users
    u1 = User(id=1, username="test_student", email="s@lpu.in", hashed_password=hash_password("pw"), role="STUDENT", is_priority=False)
    u2 = User(id=2, username="test_priority", email="p@lpu.in", hashed_password=hash_password("pw"), role="STUDENT", is_priority=True, priority_reason="Medical")
    u3 = User(id=3, username="test_shuttle_driver", email="sd@lpu.in", hashed_password=hash_password("pw"), role="DRIVER")
    u4 = User(id=4, username="test_cart_driver", email="cd@lpu.in", hashed_password=hash_password("pw"), role="DRIVER")
    session.add_all([u1, u2, u3, u4])
    session.commit()
    
    # Drivers
    d1 = Driver(id=1, user_id=3, license_number="L1", driver_type="SHUTTLE")
    d2 = Driver(id=2, user_id=4, license_number="L2", driver_type="GOLF_CART")
    session.add_all([d1, d2])
    session.commit()
    
    # Stops
    s1 = Stop(id=1, name="Main Gate", code="MG", latitude=31.2550, longitude=75.7020)
    s2 = Stop(id=2, name="Uni-Mall", code="UM", latitude=31.2530, longitude=75.7045)
    s3 = Stop(id=3, name="Block 32", code="B32", latitude=31.2510, longitude=75.7065)
    session.add_all([s1, s2, s3])
    session.commit()
    
    # Route: 1 -> 2 -> 3
    r1 = Route(id=1, name="Loop", code="R1", color_hex="#2563EB", is_active=True)
    session.add(r1)
    session.commit()
    
    rs1 = RouteStop(id=1, route_id=1, stop_id=1, stop_order=1, avg_segment_time_sec=0, default_dwell_time_sec=60)
    rs2 = RouteStop(id=2, route_id=1, stop_id=2, stop_order=2, avg_segment_time_sec=120, default_dwell_time_sec=45)
    rs3 = RouteStop(id=3, route_id=1, stop_id=3, stop_order=3, avg_segment_time_sec=180, default_dwell_time_sec=60)
    session.add_all([rs1, rs2, rs3])
    session.commit()
    
    sched = Schedule(id=1, route_id=1, departure_time="09:00:00", day_of_week="ALL", frequency_mins=15)
    session.add(sched)
    session.commit()
    
    shuttle = Shuttle(id=1, vehicle_number="PB-08-TEST", capacity=30, status="ACTIVE")
    session.add(shuttle)
    session.commit()
    
    trip = TripInstance(
        id=1,
        route_id=1,
        shuttle_id=1,
        driver_id=1,
        status="STARTED",
        current_stop_id=1,
        next_stop_id=2,
        current_delay_sec=0,
        current_passenger_count=10,
        current_crowd_level="LOW",
        actual_start_time=now,
        last_driver_update_at=now
    )
    session.add(trip)
    session.commit()
    
    # Initial status update for Trip 1
    u_init = TripStatusUpdate(
        trip_instance_id=1,
        update_type="START",
        stop_id=1,
        passenger_count=10,
        delay_sec=0,
        notes="Trip started",
        recorded_at=now
    )
    session.add(u_init)
    session.commit()
    
    cart1 = GolfCart(id=1, cart_code="GC-TEST-1", capacity=4, status="IDLE", current_stop_id=1, assigned_driver_id=2, last_location_update_at=now)
    cart2 = GolfCart(id=2, cart_code="GC-TEST-2", capacity=6, status="IDLE", current_stop_id=3, assigned_driver_id=None, last_location_update_at=now)
    session.add_all([cart1, cart2])
    session.commit()
    
    stand1 = ErickshawStand(id=1, name="Stand 1", nearby_stop_id=1, availability_status="AVAILABLE", estimated_rickshaws_present=5)
    stand2 = ErickshawStand(id=2, name="Stand 2", nearby_stop_id=3, availability_status="AVAILABLE", estimated_rickshaws_present=4)
    session.add_all([stand1, stand2])
    session.commit()
    
    fare = ErickshawFare(id=1, from_stand_id=1, to_stand_id=2, fare_inr=15)
    session.add(fare)
    session.commit()
    
    yield session
    
    session.close()
    Base.metadata.drop_all(bind=engine)

@pytest.fixture(scope="function")
def client(db):
    def override_get_db():
        test_session = TestingSessionLocal()
        try:
            yield test_session
        finally:
            test_session.close()
            
    app.dependency_overrides[get_db] = override_get_db
    with TestClient(app) as test_client:
        yield test_client
    app.dependency_overrides.clear()

@pytest.fixture
def student_auth_headers():
    token = create_access_token({"sub": "test_student", "role": "STUDENT"})
    return {"Authorization": f"Bearer {token}"}

@pytest.fixture
def priority_student_auth_headers():
    token = create_access_token({"sub": "test_priority", "role": "STUDENT"})
    return {"Authorization": f"Bearer {token}"}

@pytest.fixture
def shuttle_driver_auth_headers():
    token = create_access_token({"sub": "test_shuttle_driver", "role": "DRIVER"})
    return {"Authorization": f"Bearer {token}"}

@pytest.fixture
def cart_driver_auth_headers():
    token = create_access_token({"sub": "test_cart_driver", "role": "DRIVER"})
    return {"Authorization": f"Bearer {token}"}
