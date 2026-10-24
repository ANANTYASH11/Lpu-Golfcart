from datetime import datetime, timezone
from sqlalchemy.orm import Session
import logging

from app.database import engine, Base, SessionLocal
from app.auth import hash_password
from app.models.user import User
from app.models.transport import Stop, Route, RouteStop, Schedule
from app.models.shuttle_ops import Shuttle, Driver, TripInstance, TripStatusUpdate
from app.models.last_mile import ErickshawStand, ErickshawFare, GolfCart, BookingRequest

logger = logging.getLogger(__name__)

def seed_database(db: Session = None):
    close_at_end = False
    if db is None:
        Base.metadata.create_all(bind=engine)
        db = SessionLocal()
        close_at_end = True

    try:
        # Check if already seeded
        if db.query(User).first():
            logger.info("Database already seeded. Skipping.")
            return

        print("Seeding database with realistic LPU Campus data...")

        # 1. Users
        users_data = [
            # Regular Student
            User(
                username="rohit_student",
                email="rohit.1220456@lpu.in",
                hashed_password=hash_password("student123"),
                role="STUDENT",
                is_priority=False
            ),
            # Priority Student (Medical / Differently-abled)
            User(
                username="priya_medical",
                email="priya.1220999@lpu.in",
                hashed_password=hash_password("student123"),
                role="STUDENT",
                is_priority=True,
                priority_reason="Medical Need - Mobility Impairment"
            ),
            # Shuttle Driver
            User(
                username="harpreet_driver",
                email="harpreet.transport@lpu.in",
                hashed_password=hash_password("driver123"),
                role="DRIVER"
            ),
            # Golf Cart Driver
            User(
                username="gurpreet_cart",
                email="gurpreet.golfcart@lpu.in",
                hashed_password=hash_password("driver123"),
                role="DRIVER"
            ),
            # Admin
            User(
                username="admin_officer",
                email="admin.transport@lpu.in",
                hashed_password=hash_password("admin123"),
                role="ADMIN"
            )
        ]
        db.add_all(users_data)
        db.commit()

        # 2. Driver Profiles
        shuttle_driver_user = db.query(User).filter(User.username == "harpreet_driver").first()
        cart_driver_user = db.query(User).filter(User.username == "gurpreet_cart").first()

        d1 = Driver(
            user_id=shuttle_driver_user.id,
            license_number="PB-08-2018-00987",
            driver_type="SHUTTLE",
            phone_number="+91-98765-11001",
            is_on_duty=True
        )
        d2 = Driver(
            user_id=cart_driver_user.id,
            license_number="PB-08-2021-00452",
            driver_type="GOLF_CART",
            phone_number="+91-98765-22002",
            is_on_duty=True
        )
        db.add_all([d1, d2])
        db.commit()

        # 3. Campus Stops (LPU Landmark coordinates)
        # Note: These names represent typical LPU layout and should be customized with specific block codes as needed.
        stops_data = [
            Stop(id=1, name="Main Gate (Gate 1)", code="MG-01", latitude=31.2550, longitude=75.7020, has_shelter=True, is_transfer_hub=True),
            Stop(id=2, name="Uni-Mall Commercial Centre", code="UM-02", latitude=31.2530, longitude=75.7045, has_shelter=True, is_transfer_hub=False),
            Stop(id=3, name="Block 32 (Computer Science)", code="B32", latitude=31.2510, longitude=75.7065, has_shelter=True, is_transfer_hub=True),
            Stop(id=4, name="Block 34 (Engineering Labs)", code="B34", latitude=31.2490, longitude=75.7075, has_shelter=True, is_transfer_hub=False),
            Stop(id=5, name="Block 38 (Mittal Business School)", code="B38", latitude=31.2475, longitude=75.7090, has_shelter=True, is_transfer_hub=False),
            Stop(id=6, name="Central University Library", code="LIB", latitude=31.2520, longitude=75.7055, has_shelter=True, is_transfer_hub=False),
            Stop(id=7, name="Girls Hostel Complex (GH-1)", code="GH", latitude=31.2560, longitude=75.7085, has_shelter=True, is_transfer_hub=True),
            Stop(id=8, name="Boys Hostel Complex (BH-1)", code="BH", latitude=31.2450, longitude=75.7110, has_shelter=True, is_transfer_hub=True),
            Stop(id=9, name="Shanti Devi Mittal Auditorium", code="AUD", latitude=31.2500, longitude=75.7040, has_shelter=True, is_transfer_hub=False),
            Stop(id=10, name="University Hospital & Health Centre", code="HOSP", latitude=31.2540, longitude=75.7030, has_shelter=True, is_transfer_hub=False)
        ]
        db.add_all(stops_data)
        db.commit()

        # 4. Routes
        r1 = Route(id=1, name="Route 1: Academic Outer Loop", code="R1", color_hex="#3B82F6", is_active=True)
        r2 = Route(id=2, name="Route 2: Hostel-Academic Express", code="R2", color_hex="#10B981", is_active=True)
        db.add_all([r1, r2])
        db.commit()

        # 5. Route Stops with segment times (seconds) and dwell times
        # Route 1: Main Gate -> Uni-Mall -> Block 32 -> Block 34 -> Block 38 -> Boys Hostel -> Girls Hostel -> Main Gate
        r1_stops = [
            RouteStop(route_id=1, stop_id=1, stop_order=1, avg_segment_time_sec=0, default_dwell_time_sec=60),
            RouteStop(route_id=1, stop_id=2, stop_order=2, avg_segment_time_sec=150, default_dwell_time_sec=45),
            RouteStop(route_id=1, stop_id=3, stop_order=3, avg_segment_time_sec=180, default_dwell_time_sec=60),
            RouteStop(route_id=1, stop_id=4, stop_order=4, avg_segment_time_sec=120, default_dwell_time_sec=30),
            RouteStop(route_id=1, stop_id=5, stop_order=5, avg_segment_time_sec=150, default_dwell_time_sec=45),
            RouteStop(route_id=1, stop_id=8, stop_order=6, avg_segment_time_sec=210, default_dwell_time_sec=60),
            RouteStop(route_id=1, stop_id=7, stop_order=7, avg_segment_time_sec=240, default_dwell_time_sec=60),
            RouteStop(route_id=1, stop_id=1, stop_order=8, avg_segment_time_sec=200, default_dwell_time_sec=60)
        ]

        # Route 2: Boys Hostel -> Block 38 -> Block 32 -> Central Library -> Girls Hostel -> Main Gate
        r2_stops = [
            RouteStop(route_id=2, stop_id=8, stop_order=1, avg_segment_time_sec=0, default_dwell_time_sec=60),
            RouteStop(route_id=2, stop_id=5, stop_order=2, avg_segment_time_sec=180, default_dwell_time_sec=45),
            RouteStop(route_id=2, stop_id=3, stop_order=3, avg_segment_time_sec=160, default_dwell_time_sec=60),
            RouteStop(route_id=2, stop_id=6, stop_order=4, avg_segment_time_sec=110, default_dwell_time_sec=45),
            RouteStop(route_id=2, stop_id=7, stop_order=5, avg_segment_time_sec=190, default_dwell_time_sec=60),
            RouteStop(route_id=2, stop_id=1, stop_order=6, avg_segment_time_sec=200, default_dwell_time_sec=60)
        ]
        db.add_all(r1_stops + r2_stops)
        db.commit()

        # 6. Schedules
        schedules = [
            Schedule(route_id=1, departure_time="08:30:00", day_of_week="WEEKDAY", frequency_mins=15),
            Schedule(route_id=1, departure_time="08:45:00", day_of_week="WEEKDAY", frequency_mins=15),
            Schedule(route_id=1, departure_time="09:00:00", day_of_week="WEEKDAY", frequency_mins=15),
            Schedule(route_id=2, departure_time="08:40:00", day_of_week="WEEKDAY", frequency_mins=15),
            Schedule(route_id=2, departure_time="08:55:00", day_of_week="WEEKDAY", frequency_mins=15),
        ]
        db.add_all(schedules)
        db.commit()

        # 7. Shuttles
        shuttles = [
            Shuttle(id=1, vehicle_number="PB-08-LP-101", capacity=35, status="ACTIVE"),
            Shuttle(id=2, vehicle_number="PB-08-LP-102", capacity=35, status="ACTIVE"),
            Shuttle(id=3, vehicle_number="PB-08-LP-103", capacity=35, status="ACTIVE")
        ]
        db.add_all(shuttles)
        db.commit()

        # 8. Active Trip Instances
        now = datetime.now(timezone.utc)
        t1 = TripInstance(
            id=1,
            route_id=1,
            shuttle_id=1,
            driver_id=d1.id,
            status="STARTED",
            current_stop_id=1,  # Main Gate
            next_stop_id=2,     # Uni-Mall
            current_delay_sec=0,
            current_passenger_count=12,  # 12/35 = ~34% -> LOW
            current_crowd_level="LOW",
            actual_start_time=now,
            last_driver_update_at=now
        )
        t2 = TripInstance(
            id=2,
            route_id=2,
            shuttle_id=2,
            driver_id=d1.id,
            status="STARTED",
            current_stop_id=8,  # Boys Hostel
            next_stop_id=5,     # Block 38
            current_delay_sec=120, # 2 min delay
            current_passenger_count=22, # 22/35 = ~63% -> MODERATE
            current_crowd_level="MODERATE",
            actual_start_time=now,
            last_driver_update_at=now
        )
        t3 = TripInstance(
            id=3,
            route_id=1,
            shuttle_id=3,
            driver_id=d1.id,
            status="SCHEDULED",
            current_stop_id=None,
            next_stop_id=None,
            current_delay_sec=0,
            current_passenger_count=0,
            current_crowd_level="LOW",
            last_driver_update_at=now
        )
        db.add_all([t1, t2, t3])
        db.commit()

        # Trip 1 & 2 Initial status updates
        u1 = TripStatusUpdate(trip_instance_id=1, update_type="START", stop_id=1, passenger_count=12, delay_sec=0, recorded_at=now)
        u2 = TripStatusUpdate(trip_instance_id=2, update_type="START", stop_id=8, passenger_count=22, delay_sec=120, recorded_at=now)
        db.add_all([u1, u2])
        db.commit()

        # 9. Golf Carts (2 carts as specified in requirement)
        carts = [
            GolfCart(id=1, cart_code="GC-01", capacity=4, status="IDLE", current_stop_id=1, assigned_driver_id=d2.id, last_location_update_at=now),
            GolfCart(id=2, cart_code="GC-02", capacity=6, status="IDLE", current_stop_id=3, assigned_driver_id=None, last_location_update_at=now)
        ]
        db.add_all(carts)
        db.commit()

        # 10. E-rickshaw Stands
        stands = [
            ErickshawStand(id=1, name="Main Gate E-Rickshaw Stand", nearby_stop_id=1, availability_status="AVAILABLE", estimated_rickshaws_present=7),
            ErickshawStand(id=2, name="Uni-Mall Stand", nearby_stop_id=2, availability_status="AVAILABLE", estimated_rickshaws_present=4),
            ErickshawStand(id=3, name="Boys Hostel Complex Stand", nearby_stop_id=8, availability_status="AVAILABLE", estimated_rickshaws_present=8),
            ErickshawStand(id=4, name="Girls Hostel Complex Stand", nearby_stop_id=7, availability_status="LIMITED", estimated_rickshaws_present=2),
            ErickshawStand(id=5, name="Block 32 / Library Stand", nearby_stop_id=3, availability_status="AVAILABLE", estimated_rickshaws_present=5)
        ]
        db.add_all(stands)
        db.commit()

        # 11. Flat Fares (in INR)
        fares = [
            ErickshawFare(from_stand_id=1, to_stand_id=2, fare_inr=10),
            ErickshawFare(from_stand_id=1, to_stand_id=3, fare_inr=15),
            ErickshawFare(from_stand_id=1, to_stand_id=4, fare_inr=15),
            ErickshawFare(from_stand_id=1, to_stand_id=5, fare_inr=15),
            ErickshawFare(from_stand_id=3, to_stand_id=5, fare_inr=15),
            ErickshawFare(from_stand_id=4, to_stand_id=5, fare_inr=10),
            ErickshawFare(from_stand_id=3, to_stand_id=1, fare_inr=20),
            ErickshawFare(from_stand_id=4, to_stand_id=1, fare_inr=15),
            # Reverse directions
            ErickshawFare(from_stand_id=5, to_stand_id=1, fare_inr=15),
            ErickshawFare(from_stand_id=5, to_stand_id=3, fare_inr=15),
            ErickshawFare(from_stand_id=5, to_stand_id=4, fare_inr=10),
        ]
        db.add_all(fares)
        db.commit()

        print("Database seed complete! Added stops, routes, shuttles, golf carts, e-rickshaws, and test users.")

    finally:
        if close_at_end:
            db.close()

if __name__ == "__main__":
    seed_database()
