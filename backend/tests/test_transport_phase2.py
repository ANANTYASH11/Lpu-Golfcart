import pytest
import io

def test_stops_near_me(client, db):
    # Test nearby stops endpoint around Uni-Mall coordinates (31.2530, 75.7045)
    response = client.get("/api/v1/transport/stops/near-me?lat=31.2530&lng=75.7045&limit=3")
    assert response.status_code == 200
    data = response.json()
    assert isinstance(data, list)
    assert len(data) >= 1
    # First stop should be Uni-Mall with minimal distance
    assert data[0]["name"] == "Uni-Mall"
    assert "distance_meters" in data[0]
    assert "walk_time_mins" in data[0]

def test_shuttle_progress(client, db):
    # Test shuttle 1 which has active Trip 1 in test db
    response = client.get("/api/v1/transport/shuttle/1/progress")
    assert response.status_code == 200
    data = response.json()
    assert data["shuttle_id"] == 1
    assert data["vehicle_number"] == "PB-08-TEST"
    assert data["route_name"] == "Loop"
    assert len(data["stops"]) == 3
    # Check stop 1 (current stop)
    assert data["stops"][0]["is_current"] is True
    assert data["stops"][0]["stop_order"] == 1

def test_shuttle_progress_not_found(client, db):
    response = client.get("/api/v1/transport/shuttle/999/progress")
    assert response.status_code == 404

def test_timetable_endpoint(client, db):
    response = client.get("/api/v1/transport/timetable?schedule_type=REGULAR")
    assert response.status_code == 200
    data = response.json()
    assert data["schedule_type"] == "REGULAR"
    assert "active_routes" in data
    assert len(data["active_routes"]) >= 1
    assert "peak_hours_windows" in data
    assert len(data["peak_hours_windows"]) == 3
    assert "is_currently_peak" in data

def test_timetable_next_departures(client, db):
    # Stop 1 (Main Gate) is part of Route 1
    response = client.get("/api/v1/transport/timetable/next-departures/1")
    assert response.status_code == 200
    data = response.json()
    assert data["stop_id"] == 1
    assert data["stop_name"] == "Main Gate"
    assert "departures" in data
    assert len(data["departures"]) >= 1
    assert data["departures"][0]["route_code"] == "R1"

def test_timetable_csv_export(client, db):
    response = client.get("/api/v1/transport/timetable/export-csv")
    assert response.status_code == 200
    assert response.headers["content-type"].startswith("text/csv")
    content = response.text
    assert "route_id,route_code,route_name,departure_time" in content
    assert "09:00:00" in content

def test_timetable_csv_import(client, db):
    csv_data = "route_id,route_code,route_name,departure_time,day_of_week,schedule_type,frequency_mins\n1,R1,Loop,10:30:00,WEEKDAY,REGULAR,10\n"
    file_bytes = io.BytesIO(csv_data.encode("utf-8"))
    response = client.post(
        "/api/v1/transport/timetable/import-csv",
        files={"file": ("test_timetable.csv", file_bytes, "text/csv")}
    )
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "success"
    assert data["imported_rows"] == 1

    # Verify updated timetable now includes 10:30:00
    res_tt = client.get("/api/v1/transport/timetable?schedule_type=REGULAR")
    assert res_tt.status_code == 200
    all_deps = [s["departure_time"] for r in res_tt.json()["active_routes"] for s in r["schedules"]]
    assert "10:30:00" in all_deps
