import pytest
import hmac
import hashlib
from app.config import settings
from app.services.payment_service import (
    compute_payment_signature,
    verify_razorpay_signature,
    verify_webhook_signature,
    get_or_create_wallet,
    topup_wallet,
    deduct_wallet,
    process_refund,
)
from app.models.payment import Payment, WalletAccount, WalletLedger, Refund
from app.models.last_mile import BookingRequest

def test_signature_computation_and_verification():
    order_id = "order_test_12345"
    payment_id = "pay_test_67890"
    valid_sig = compute_payment_signature(order_id, payment_id)

    assert verify_razorpay_signature(order_id, payment_id, valid_sig) is True
    assert verify_razorpay_signature(order_id, payment_id, "invalid_sig_tampered") is False
    assert verify_razorpay_signature("tampered_order", payment_id, valid_sig) is False

def test_webhook_signature_verification():
    body = b'{"event":"payment.captured","payload":{"payment":{"entity":{"id":"pay_123"}}}}'
    secret = settings.RAZORPAY_WEBHOOK_SECRET.encode("utf-8")
    valid_wh_sig = hmac.new(secret, body, hashlib.sha256).hexdigest()

    assert verify_webhook_signature(body, valid_wh_sig) is True
    assert verify_webhook_signature(body, "invalid_webhook_sig") is False

def test_wallet_initial_balance_and_ledger(db):
    user_id = 1
    wallet = get_or_create_wallet(db, user_id)
    assert wallet.balance_paise == 25000  # ₹250 welcome credit
    assert len(wallet.ledger_entries) == 1
    assert wallet.ledger_entries[0].entry_type == "CREDIT"
    assert wallet.ledger_entries[0].amount_paise == 25000

def test_wallet_topup_and_deduct(db):
    user_id = 1
    wallet = get_or_create_wallet(db, user_id)
    initial_balance = wallet.balance_paise

    # Topup ₹50 (5000 paise)
    wallet = topup_wallet(db, user_id, 5000, "TEST-TOP-1", "Test topup")
    assert wallet.balance_paise == initial_balance + 5000

    # Deduct ₹15 (1500 paise)
    wallet = deduct_wallet(db, user_id, 1500, 999, "Ride debit")
    assert wallet.balance_paise == initial_balance + 5000 - 1500

    # Test insufficient funds
    with pytest.raises(ValueError, match="Insufficient wallet balance"):
        deduct_wallet(db, user_id, wallet.balance_paise + 1000, 999, "Overdraft attempt")

def test_create_order_endpoint(client, db, student_auth_headers):
    # Create booking first
    b_res = client.post(
        "/api/v1/lastmile/bookings",
        json={"pickup_stop_id": 1, "drop_stop_id": 2, "passengers": 1, "vehicle_type": "GOLF_CART"},
        headers=student_auth_headers
    )
    assert b_res.status_code == 200
    booking_id = b_res.json()["id"]

    # Request Razorpay order
    response = client.post(
        "/api/v1/payments/create-order",
        json={"amount_paise": 1500, "booking_id": booking_id},
        headers=student_auth_headers
    )
    assert response.status_code == 200
    data = response.json()
    assert "order_id" in data
    assert data["amount"] > 0
    assert data["currency"] == "INR"
    assert data["mode"] == "test"
    assert "receipt" in data

def test_verify_payment_endpoint_success_and_tamper(client, db, student_auth_headers):
    # Create booking
    b_res = client.post(
        "/api/v1/lastmile/bookings",
        json={"pickup_stop_id": 1, "drop_stop_id": 2, "passengers": 1, "vehicle_type": "GOLF_CART"},
        headers=student_auth_headers
    )
    booking_id = b_res.json()["id"]

    order_res = client.post(
        "/api/v1/payments/create-order",
        json={"amount_paise": 1500, "booking_id": booking_id},
        headers=student_auth_headers
    )
    order_id = order_res.json()["order_id"]
    payment_id = "pay_test_succ_123"
    valid_sig = compute_payment_signature(order_id, payment_id)

    # 1. Tampered signature fails
    fail_res = client.post(
        "/api/v1/payments/verify",
        json={
            "razorpay_order_id": order_id,
            "razorpay_payment_id": payment_id,
            "razorpay_signature": "tampered_fake_sig",
            "booking_id": booking_id
        },
        headers=student_auth_headers
    )
    assert fail_res.status_code == 400

    # 2. Valid signature succeeds
    succ_res = client.post(
        "/api/v1/payments/verify",
        json={
            "razorpay_order_id": order_id,
            "razorpay_payment_id": payment_id,
            "razorpay_signature": valid_sig,
            "booking_id": booking_id
        },
        headers=student_auth_headers
    )
    assert succ_res.status_code == 200
    assert succ_res.json()["status"] == "CAPTURED"

    # Verify booking payment status updated to PAID
    bk_check = client.get(f"/api/v1/lastmile/bookings/{booking_id}", headers=student_auth_headers)
    assert bk_check.status_code == 200
    assert bk_check.json()["payment_status"] == "PAID"
    assert bk_check.json()["payment_method"] == "RAZORPAY"

def test_wallet_pay_flow_and_double_spend(client, db, student_auth_headers):
    # Create booking
    b_res = client.post(
        "/api/v1/lastmile/bookings",
        json={"pickup_stop_id": 1, "drop_stop_id": 3, "passengers": 1, "vehicle_type": "GOLF_CART"},
        headers=student_auth_headers
    )
    booking_id = b_res.json()["id"]

    # Check wallet balance
    bal_res = client.get("/api/v1/payments/wallet/balance", headers=student_auth_headers)
    assert bal_res.status_code == 200
    start_bal = bal_res.json()["balance_inr"]

    # Pay via wallet
    pay_res = client.post(
        "/api/v1/payments/wallet/pay",
        json={"booking_id": booking_id},
        headers=student_auth_headers
    )
    assert pay_res.status_code == 200
    assert pay_res.json()["status"] == "success"
    assert pay_res.json()["payment_method"] == "WALLET"

    # Double-spend attempt on same booking fails
    dup_res = client.post(
        "/api/v1/payments/wallet/pay",
        json={"booking_id": booking_id},
        headers=student_auth_headers
    )
    assert dup_res.status_code == 400
    assert "already paid" in dup_res.json()["detail"].lower()

def test_payment_receipt_endpoint(client, db, student_auth_headers):
    b_res = client.post(
        "/api/v1/lastmile/bookings",
        json={"pickup_stop_id": 1, "drop_stop_id": 2, "passengers": 1, "vehicle_type": "GOLF_CART"},
        headers=student_auth_headers
    )
    booking_id = b_res.json()["id"]

    # Pay via wallet
    client.post("/api/v1/payments/wallet/pay", json={"booking_id": booking_id}, headers=student_auth_headers)

    # Fetch receipt
    rec_res = client.get(f"/api/v1/payments/receipt/{booking_id}", headers=student_auth_headers)
    assert rec_res.status_code == 200
    rec_data = rec_res.json()
    assert rec_data["booking_id"] == booking_id
    assert rec_data["payment_method"] == "WALLET"
    assert rec_data["status"] == "CAPTURED"
    assert rec_data["amount_inr"] > 0
    assert "receipt_number" in rec_data

def test_automated_refund_on_cancellation(client, db, student_auth_headers):
    # Book and pay
    b_res = client.post(
        "/api/v1/lastmile/bookings",
        json={"pickup_stop_id": 1, "drop_stop_id": 2, "passengers": 1, "vehicle_type": "GOLF_CART"},
        headers=student_auth_headers
    )
    booking_id = b_res.json()["id"]
    client.post("/api/v1/payments/wallet/pay", json={"booking_id": booking_id}, headers=student_auth_headers)

    # Cancel booking
    cancel_res = client.post(
        f"/api/v1/lastmile/bookings/{booking_id}/cancel",
        json={"reason": "Schedule changed"},
        headers=student_auth_headers
    )
    assert cancel_res.status_code == 200

    # Verify refund was recorded
    refund = db.query(Refund).filter(Refund.booking_id == booking_id).first()
    assert refund is not None
    assert refund.status == "PROCESSED"
    assert refund.amount_paise > 0
