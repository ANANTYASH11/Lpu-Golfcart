import pytest
from app.services.fare_engine import calculate_fare, is_campus_peak_hour
from app.models.transport import Stop
from app.models.last_mile import BookingRequest

def test_fare_engine_shuttle_is_free(db):
    """Test that Shuttle Bus transit is always 100% free."""
    fare = calculate_fare(db, pickup_stop_id=1, drop_stop_id=3, vehicle_type="SHUTTLE")
    assert fare["vehicle_type"] == "SHUTTLE"
    assert fare["final_fare_inr"] == 0
    assert fare["final_fare_paise"] == 0

def test_fare_engine_erickshaw_flat_tariff(db):
    """Test that E-Rickshaws use flat campus tariffs."""
    fare = calculate_fare(db, pickup_stop_id=1, drop_stop_id=2, vehicle_type="ERICKSHAW")
    assert fare["vehicle_type"] == "ERICKSHAW"
    assert fare["final_fare_inr"] > 0
    assert fare["final_fare_paise"] == fare["final_fare_inr"] * 100

def test_fare_engine_golf_cart_standard_and_priority(db):
    """Test Golf Cart standard calculation vs priority 100% discount."""
    # Standard passenger
    std_fare = calculate_fare(db, pickup_stop_id=1, drop_stop_id=3, vehicle_type="GOLF_CART", is_priority=False)
    assert std_fare["base_fare_inr"] == 10
    assert std_fare["final_fare_inr"] >= 10
    assert std_fare["final_fare_paise"] == std_fare["final_fare_inr"] * 100

    # Priority rider (Medical / Differently-abled)
    prio_fare = calculate_fare(db, pickup_stop_id=1, drop_stop_id=3, vehicle_type="GOLF_CART", is_priority=True)
    assert prio_fare["is_priority"] is True
    assert prio_fare["final_fare_inr"] == 0
    assert prio_fare["final_fare_paise"] == 0
    assert prio_fare["priority_discount_inr"] > 0

def test_fare_engine_api_calculate(client, student_auth_headers):
    """Test /api/v1/fares/calculate returns quotes for all options."""
    res = client.get("/api/v1/fares/calculate?pickup_stop_id=1&drop_stop_id=3", headers=student_auth_headers)
    assert res.status_code == 200
    data = res.json()
    assert "options" in data
    assert len(data["options"]) == 3
    types = [opt["vehicle_type"] for opt in data["options"]]
    assert "SHUTTLE" in types
    assert "GOLF_CART" in types
    assert "ERICKSHAW" in types

def test_booking_cancel_and_rate_flow(client, student_auth_headers, db):
    """Test full booking, cancellation, and rating lifecycle."""
    # Create booking
    req_data = {
        "pickup_stop_id": 1,
        "drop_stop_id": 3,
        "passenger_count": 1,
        "vehicle_type": "GOLF_CART"
    }
    create_res = client.post("/api/v1/lastmile/bookings", json=req_data, headers=student_auth_headers)
    assert create_res.status_code == 200
    b_data = create_res.json()
    b_id = b_data["id"]
    assert b_data["fare_amount_inr"] >= 10

    # Cancel booking
    cancel_res = client.post(f"/api/v1/lastmile/bookings/{b_id}/cancel", json={"reason": "Changed plans"}, headers=student_auth_headers)
    assert cancel_res.status_code == 200
    assert cancel_res.json()["status"] == "CANCELLED"
    assert cancel_res.json()["cancellation_reason"] == "Changed plans"

    # Rate booking directly
    rate_res = client.post(f"/api/v1/lastmile/bookings/{b_id}/rate", json={"rating": 5, "feedback": "Fast dispatch"}, headers=student_auth_headers)
    assert rate_res.status_code == 200
    assert rate_res.json()["rating"] == 5
    assert rate_res.json()["feedback"] == "Fast dispatch"
