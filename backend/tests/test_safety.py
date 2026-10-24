import pytest
from app.models.user import User
from app.auth import create_access_token

@pytest.fixture
def admin_auth_headers(db):
    admin_user = User(
        id=88,
        username="safety_admin",
        email="security@lpu.in",
        hashed_password="pw",
        role="ADMIN"
    )
    db.add(admin_user)
    db.commit()
    token = create_access_token({"sub": "safety_admin", "role": "ADMIN"})
    return {"Authorization": f"Bearer {token}"}

def test_get_helpline_info(client):
    response = client.get("/api/v1/safety/helpline")
    assert response.status_code == 200
    data = response.json()
    assert data["helpline"] == "+91 1824 517000"
    assert "security_desk" in data
    assert data["police"] == "112"
    assert data["ambulance"] == "108"

def test_sos_lifecycle(client, student_auth_headers):
    # 1. Trigger SOS
    payload = {
        "latitude": 31.2530,
        "longitude": 75.7050,
        "accuracy_meters": 4.5,
        "battery_level": 82,
        "is_test": True,
        "trigger_type": "MANUAL_HOLD",
        "notes": "Emergency test drill near Block 34"
    }
    res = client.post("/api/v1/safety/sos/trigger", json=payload, headers=student_auth_headers)
    assert res.status_code == 201
    sos_data = res.json()
    sos_id = sos_data["id"]
    assert sos_data["status"] == "ACTIVE"
    assert sos_data["is_test"] is True
    assert sos_data["battery_level"] == 82

    # 2. Check active beacons
    active_res = client.get("/api/v1/safety/sos/active", headers=student_auth_headers)
    assert active_res.status_code == 200
    active_list = active_res.json()
    assert any(ev["id"] == sos_id for ev in active_list)

    # 3. Stream updated location
    loc_res = client.post(
        f"/api/v1/safety/sos/{sos_id}/location",
        json={
            "latitude": 31.2535,
            "longitude": 75.7055,
            "accuracy_meters": 3.2,
            "battery_level": 80
        },
        headers=student_auth_headers
    )
    assert loc_res.status_code == 200
    assert loc_res.json()["latitude"] == 31.2535
    assert loc_res.json()["battery_level"] == 80

    # 4. Resolve SOS
    resolve_res = client.post(
        f"/api/v1/safety/sos/{sos_id}/resolve",
        json={"resolution_notes": "Student verified safe by patrol officer"},
        headers=student_auth_headers
    )
    assert resolve_res.status_code == 200
    assert resolve_res.json()["status"] == "RESOLVED"

    # 5. Check no longer active for student
    active_after = client.get("/api/v1/safety/sos/active", headers=student_auth_headers)
    assert active_after.status_code == 200
    assert not any(ev["id"] == sos_id for ev in active_after.json())

def test_incident_reporting_workflow(client, student_auth_headers, admin_auth_headers):
    # 1. Submit report
    report_payload = {
        "category": "RECKLESS_DRIVING",
        "description": "Electric shuttle PB-08-LP-1002 was over-speeding near UniMall crossing.",
        "location": "UniMall Central Crossing",
        "vehicle_number": "PB-08-LP-1002"
    }
    submit_res = client.post("/api/v1/safety/incident/report", json=report_payload, headers=student_auth_headers)
    assert submit_res.status_code == 201
    report_data = submit_res.json()
    report_id = report_data["id"]
    assert report_data["status"] == "SUBMITTED"
    assert report_data["category"] == "RECKLESS_DRIVING"

    # 2. Check user's own reports
    my_reports = client.get("/api/v1/safety/incident/my-reports", headers=student_auth_headers)
    assert my_reports.status_code == 200
    assert any(r["id"] == report_id for r in my_reports.json())

    # 3. Check admin can view all reports
    admin_reports = client.get("/api/v1/safety/admin/incidents", headers=admin_auth_headers)
    assert admin_reports.status_code == 200
    assert any(r["id"] == report_id for r in admin_reports.json())
