import pytest
from app.models.last_mile import GolfCart, BookingRequest

def test_cart_auto_assignment_capacity_matching(client, student_auth_headers, db):
    # Request for 5 passengers (Cart 1 has 4 seats, Cart 2 has 6 seats)
    res = client.post("/api/v1/lastmile/bookings", json={
        "pickup_stop_id": 1,
        "drop_stop_id": 3,
        "passenger_count": 5
    }, headers=student_auth_headers)
    
    assert res.status_code == 200
    # Must assign Cart 2 because Cart 1 capacity is 4
    assert res.json()["assigned_cart_id"] == 2
    assert res.json()["status"] == "ACCEPTED"

def test_single_active_booking_rate_limit(client, student_auth_headers, db):
    # 1. Create first booking
    res1 = client.post("/api/v1/lastmile/bookings", json={
        "pickup_stop_id": 1,
        "drop_stop_id": 2,
        "passenger_count": 1
    }, headers=student_auth_headers)
    assert res1.status_code == 200

    # 2. Try creating second booking before completing first
    res2 = client.post("/api/v1/lastmile/bookings", json={
        "pickup_stop_id": 1,
        "drop_stop_id": 3,
        "passenger_count": 1
    }, headers=student_auth_headers)
    assert res2.status_code == 400
    assert "already have an active booking" in res2.json()["detail"]

def test_priority_queueing_preemption(client, student_auth_headers, priority_student_auth_headers, db):
    # Make all carts busy
    db.query(GolfCart).update({"status": "IN_SERVICE"})
    db.commit()

    # 1. Non-priority student books -> placed in queue position 1
    res1 = client.post("/api/v1/lastmile/bookings", json={
        "pickup_stop_id": 1,
        "drop_stop_id": 3,
        "passenger_count": 2
    }, headers=student_auth_headers)
    assert res1.status_code == 200
    assert res1.json()["status"] == "REQUESTED"
    assert res1.json()["queue_position"] == 1

    # 2. Priority student (Medical/Differently-abled) books later -> jumps ahead in queue!
    res2 = client.post("/api/v1/lastmile/bookings", json={
        "pickup_stop_id": 2,
        "drop_stop_id": 3,
        "passenger_count": 1
    }, headers=priority_student_auth_headers)
    assert res2.status_code == 200
    assert res2.json()["status"] == "REQUESTED"
    assert res2.json()["is_priority"] is True
    # Priority student gets queue_position 1
    assert res2.json()["queue_position"] == 1

    # Verify regular student was shifted to position 2
    b1 = db.query(BookingRequest).filter(BookingRequest.id == res1.json()["id"]).first()
    assert b1.queue_position == 2
