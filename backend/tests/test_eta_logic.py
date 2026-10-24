from datetime import datetime, timezone, timedelta
from app.services.eta_calculator import compute_trip_eta_to_stop, is_trip_live_valid
from app.models.shuttle_ops import TripInstance

def test_eta_segment_and_dwell_calculation(db):
    trip = db.query(TripInstance).filter(TripInstance.id == 1).first()
    trip.current_stop_id = 1
    trip.current_delay_sec = 0
    trip.status = "STARTED"
    now = datetime.now(timezone.utc)
    trip.last_driver_update_at = now
    db.commit()

    # Target Stop 3 (Stop 1 -> Stop 2 [120s] -> Dwell at 2 [45s] -> Stop 3 [180s] = 345s)
    is_live, eta_sec, label, crowd = compute_trip_eta_to_stop(db, trip, target_stop_id=3, now=now)
    
    assert is_live is True
    assert eta_sec == 345
    assert "Arrives in ~6 min" in label
    assert crowd == "LOW"

def test_eta_with_driver_reported_delay(db):
    trip = db.query(TripInstance).filter(TripInstance.id == 1).first()
    trip.current_stop_id = 1
    trip.current_delay_sec = 120  # 2 minute delay
    now = datetime.now(timezone.utc)
    trip.last_driver_update_at = now
    db.commit()

    is_live, eta_sec, label, crowd = compute_trip_eta_to_stop(db, trip, target_stop_id=3, now=now)
    
    assert is_live is True
    # 345s base + 120s delay = 465s (~8 min)
    assert eta_sec == 465
    assert "Delayed 2 min" in label

def test_five_minute_staleness_fallback_to_schedule(db):
    """
    Requirement: Mark data 'Live unavailable' if there has been no driver update for 5 minutes.
    Falls back to schedule.
    """
    trip = db.query(TripInstance).filter(TripInstance.id == 1).first()
    now = datetime.now(timezone.utc)
    # 350 seconds ago (> 300 seconds threshold)
    trip.last_driver_update_at = now - timedelta(seconds=350)
    db.commit()

    assert is_trip_live_valid(trip, now) is False

    is_live, eta_sec, label, crowd = compute_trip_eta_to_stop(db, trip, target_stop_id=3, now=now)
    assert is_live is False
    assert eta_sec is None
    assert "Live unavailable" in label
    assert "09:00:00" in label  # Scheduled timetable fallback

def test_eta_at_stop_boarding_now(db):
    trip = db.query(TripInstance).filter(TripInstance.id == 1).first()
    trip.current_stop_id = 2
    trip.status = "AT_STOP"
    now = datetime.now(timezone.utc)
    trip.last_driver_update_at = now
    db.commit()

    is_live, eta_sec, label, crowd = compute_trip_eta_to_stop(db, trip, target_stop_id=2, now=now)
    assert is_live is True
    assert eta_sec == 0
    assert "Boarding now" in label
