import pytest
from datetime import datetime, timezone, timedelta
from app.models.last_mile import BookingRequest, GolfCart
from app.models.shuttle_ops import TripInstance, TripStatusUpdate
from app.services.cart_dispatcher import check_and_expire_no_shows

@pytest.mark.asyncio
async def test_booking_state_machine_happy_path(client, student_auth_headers, cart_driver_auth_headers, db):
    # 1. Student creates booking
    res = client.post("/api/v1/lastmile/bookings", json={
        "pickup_stop_id": 1,
        "drop_stop_id": 3,
        "passenger_count": 2
    }, headers=student_auth_headers)
    assert res.status_code == 200
    booking_id = res.json()["id"]
    # Auto assigned to idle Cart 1 (capacity 4 >= 2)
    assert res.json()["status"] == "ACCEPTED"
    assert res.json()["assigned_cart_id"] is not None

    # 2. Driver accepts
    res = client.patch(f"/api/v1/lastmile/bookings/{booking_id}/status", json={"action": "ACCEPT"}, headers=cart_driver_auth_headers)
    assert res.status_code == 200
    assert res.json()["status"] == "ACCEPTED"

    # 3. Driver marks arriving (starts 5m no-show clock)
    res = client.patch(f"/api/v1/lastmile/bookings/{booking_id}/status", json={"action": "ARRIVING"}, headers=cart_driver_auth_headers)
    assert res.status_code == 200
    assert res.json()["status"] == "ARRIVING"
    assert res.json()["no_show_deadline"] is not None

    # 4. Driver marks passenger picked up
    res = client.patch(f"/api/v1/lastmile/bookings/{booking_id}/status", json={"action": "PICKED_UP"}, headers=cart_driver_auth_headers)
    assert res.status_code == 200
    assert res.json()["status"] == "PICKED_UP"

    # 5. Driver marks trip completed -> Cart becomes IDLE
    res = client.patch(f"/api/v1/lastmile/bookings/{booking_id}/status", json={"action": "COMPLETE"}, headers=cart_driver_auth_headers)
    assert res.status_code == 200
    assert res.json()["status"] == "COMPLETED"

    cart = db.query(GolfCart).filter(GolfCart.id == 1).first()
    assert cart.status == "IDLE"

@pytest.mark.asyncio
async def test_no_show_auto_expiration(db):
    now = datetime.now(timezone.utc)
    # Create booking in ARRIVING with deadline in the past
    booking = BookingRequest(
        id=99,
        student_id=1,
        pickup_stop_id=1,
        drop_stop_id=3,
        passenger_count=1,
        status="ARRIVING",
        assigned_cart_id=1,
        no_show_deadline=now - timedelta(seconds=10) # expired
    )
    db.add(booking)
    cart = db.query(GolfCart).filter(GolfCart.id == 1).first()
    cart.status = "ARRIVED"
    db.commit()

    # Trigger no-show expiration check
    await check_and_expire_no_shows(db)

    db.refresh(booking)
    db.refresh(cart)
    assert booking.status == "NO_SHOW"
    assert cart.status == "IDLE"

def test_driver_mis_tap_undo(client, shuttle_driver_auth_headers, db):
    # Advance trip to Stop 2 with 15 passengers
    res = client.post("/api/v1/operations/trips/1/progress", json={
        "next_stop_id": 2,
        "passenger_count": 15,
        "delay_sec": 60
    }, headers=shuttle_driver_auth_headers)
    assert res.status_code == 200
    assert res.json()["current_stop_id"] == 2
    assert res.json()["current_passenger_count"] == 15

    # Driver mis-tapped! Call /undo
    undo_res = client.post("/api/v1/operations/trips/1/undo", headers=shuttle_driver_auth_headers)
    assert undo_res.status_code == 200
    
    # State reverted to Stop 1 and initial count 10
    assert undo_res.json()["current_stop_id"] == 1
    assert undo_res.json()["current_passenger_count"] == 10
