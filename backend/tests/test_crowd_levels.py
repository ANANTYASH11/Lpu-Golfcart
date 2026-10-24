from app.services.eta_calculator import calculate_crowd_level

def test_crowd_level_thresholds():
    capacity = 100
    
    # < 40% is LOW
    assert calculate_crowd_level(0, capacity) == "LOW"
    assert calculate_crowd_level(20, capacity) == "LOW"
    assert calculate_crowd_level(39, capacity) == "LOW"
    
    # 40% - 80% is MODERATE
    assert calculate_crowd_level(40, capacity) == "MODERATE"
    assert calculate_crowd_level(60, capacity) == "MODERATE"
    assert calculate_crowd_level(80, capacity) == "MODERATE"
    
    # > 80% is FULL
    assert calculate_crowd_level(81, capacity) == "FULL"
    assert calculate_crowd_level(95, capacity) == "FULL"
    assert calculate_crowd_level(100, capacity) == "FULL"

def test_crowd_update_api(client, db):
    # Test updating crowd on Trip 1 (capacity 30)
    # 10 passengers = 33% -> LOW
    res = client.post("/api/v1/operations/trips/1/crowd", json={"passenger_count": 10})
    assert res.status_code == 200
    assert res.json()["current_crowd_level"] == "LOW"

    # 18 passengers = 60% -> MODERATE
    res = client.post("/api/v1/operations/trips/1/crowd", json={"passenger_count": 18})
    assert res.status_code == 200
    assert res.json()["current_crowd_level"] == "MODERATE"

    # 26 passengers = 86.6% -> FULL
    res = client.post("/api/v1/operations/trips/1/crowd", json={"passenger_count": 26})
    assert res.status_code == 200
    assert res.json()["current_crowd_level"] == "FULL"
