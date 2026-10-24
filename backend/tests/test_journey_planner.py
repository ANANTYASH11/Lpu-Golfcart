from app.models.shuttle_ops import TripInstance

def test_journey_planner_normal_recommendation(client, db):
    # Search from Stop 1 (Main Gate) to Stop 3 (Block 32)
    res = client.get("/api/v1/transport/journey?from=1&to=3")
    assert res.status_code == 200
    data = res.json()
    assert data["from_stop"]["id"] == 1
    assert data["to_stop"]["id"] == 3
    assert data["shuttle_leg"] is not None
    assert data["shuttle_leg"]["crowd_level"] == "LOW"
    assert data["last_mile_option"] is not None
    assert "arrives in ~" in data["recommendation_summary"]

def test_journey_planner_full_crowd_fallback(client, db):
    # Set trip passenger count to 28/30 = 93% (FULL)
    trip = db.query(TripInstance).filter(TripInstance.id == 1).first()
    trip.current_passenger_count = 28
    trip.current_crowd_level = "FULL"
    db.commit()

    res = client.get("/api/v1/transport/journey?from=1&to=3")
    assert res.status_code == 200
    data = res.json()
    assert data["shuttle_leg"]["is_full"] is True
    # Recommendation must warn and advise Golf Cart or E-Rickshaw
    assert "FULL" in data["recommendation_summary"]
    assert "Golf Cart" in data["recommendation_summary"]
