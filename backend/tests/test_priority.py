import io
import pytest
from app.models.priority import PriorityApplication
from app.models.user import User
from app.auth import create_access_token

@pytest.fixture
def admin_auth_headers(db):
    admin_user = User(
        id=99,
        username="test_admin",
        email="admin@lpu.in",
        hashed_password="pw",
        role="ADMIN"
    )
    db.add(admin_user)
    db.commit()
    token = create_access_token({"sub": "test_admin", "role": "ADMIN"})
    return {"Authorization": f"Bearer {token}"}

def test_apply_priority_success(client, db, student_auth_headers):
    # Simulate a medical certificate PDF
    pdf_content = b"%PDF-1.4 Mock Medical Certificate from Civil Hospital Jalandhar"
    file_tuple = ("doctor_cert.pdf", io.BytesIO(pdf_content), "application/pdf")

    response = client.post(
        "/api/v1/priority/apply",
        data={
            "full_name": "Rohit Verma",
            "reg_number": "12009845",
            "category": "MEDICAL",
            "reason_description": "Post-knee surgery rehabilitation requiring mobility support."
        },
        files={"document": file_tuple},
        headers=student_auth_headers
    )
    assert response.status_code == 200
    data = response.json()
    assert data["category"] == "MEDICAL"
    assert data["status"] == "PENDING"
    assert data["document_filename"] == "doctor_cert.pdf"

def test_apply_priority_invalid_mime_rejected(client, db, student_auth_headers):
    txt_content = b"Not a medical document"
    file_tuple = ("notes.txt", io.BytesIO(txt_content), "text/plain")

    response = client.post(
        "/api/v1/priority/apply",
        data={
            "full_name": "Rohit Verma",
            "category": "MEDICAL",
            "reason_description": "Knee injury"
        },
        files={"document": file_tuple},
        headers=student_auth_headers
    )
    assert response.status_code == 400
    assert "Invalid file type" in response.json()["detail"]

def test_apply_priority_oversized_rejected(client, db, student_auth_headers):
    # Create 6 MB mock payload (> 5 MB limit)
    big_content = b"0" * (6 * 1024 * 1024)
    file_tuple = ("big_scan.pdf", io.BytesIO(big_content), "application/pdf")

    response = client.post(
        "/api/v1/priority/apply",
        data={
            "full_name": "Rohit Verma",
            "category": "MEDICAL",
            "reason_description": "Knee injury"
        },
        files={"document": file_tuple},
        headers=student_auth_headers
    )
    assert response.status_code == 400
    assert "exceeds maximum allowed size" in response.json()["detail"]

def test_admin_review_approval_unlocks_cart(client, db, student_auth_headers, admin_auth_headers):
    # 1. Apply
    pdf_content = b"%PDF-1.4 Medical Card"
    file_tuple = ("card.pdf", io.BytesIO(pdf_content), "application/pdf")
    apply_res = client.post(
        "/api/v1/priority/apply",
        data={
            "full_name": "Amanpreet Kaur",
            "category": "DIFFERENTLY_ABLED",
            "reason_description": "Locomotor disability requires priority golf cart access."
        },
        files={"document": file_tuple},
        headers=student_auth_headers
    )
    assert apply_res.status_code == 200
    app_id = apply_res.json()["id"]

    # 2. Check admin queue
    admin_list = client.get("/api/v1/priority/admin/applications", headers=admin_auth_headers)
    assert admin_list.status_code == 200
    assert any(a["id"] == app_id for a in admin_list.json())

    # 3. Admin Approves
    review_res = client.post(
        f"/api/v1/priority/admin/applications/{app_id}/review",
        json={"action": "APPROVE", "notes": "Verified medical certification by LPU Health Centre", "validity_days": 180},
        headers=admin_auth_headers
    )
    assert review_res.status_code == 200
    assert review_res.json()["new_status"] == "APPROVED"
    assert review_res.json()["student_priority_active"] is True

    # 4. Verify student status endpoint reflects approval
    stat_res = client.get("/api/v1/priority/status", headers=student_auth_headers)
    assert stat_res.status_code == 200
    assert stat_res.json()["status"] == "APPROVED"
    assert stat_res.json()["is_active_priority"] is True
