import csv
import io
from fastapi import APIRouter, Depends, HTTPException, Header, Request, status, Response, Query
from sqlalchemy.orm import Session
from typing import List, Optional
from datetime import datetime, timezone

from app.database import get_db
from app.auth import get_current_user, require_roles
from app.models.user import User
from app.models.last_mile import BookingRequest
from app.models.payment import Payment, WalletAccount, WalletLedger, Refund
from app.schemas.payment import (
    CreateOrderRequest,
    CreateOrderResponse,
    VerifyPaymentRequest,
    VerifyPaymentResponse,
    WalletBalanceResponse,
    WalletTopupRequest,
    WalletPayRequest,
    WalletLedgerResponse,
    WalletLedgerEntry,
    PaymentReceiptResponse,
)
from app.services.payment_service import (
    create_razorpay_order,
    verify_razorpay_signature,
    verify_webhook_signature,
    get_or_create_wallet,
    topup_wallet,
    deduct_wallet,
    generate_receipt_number,
)
from app.services.fare_engine import calculate_fare
from app.config import settings

router = APIRouter(prefix="/payments", tags=["Payments & Campus Wallet"])

@router.post("/create-order", response_model=CreateOrderResponse)
def create_payment_order(
    payload: CreateOrderRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Creates a Razorpay order in test mode.
    Server calculates the accurate fare if booking_id is provided.
    """
    amount_paise = payload.amount_paise

    if payload.booking_id:
        booking = db.query(BookingRequest).filter(BookingRequest.id == payload.booking_id).first()
        if not booking:
            raise HTTPException(status_code=404, detail="Booking request not found")
        # Ensure server calculated fare is used
        if booking.fare_amount_paise and booking.fare_amount_paise > 0:
            amount_paise = booking.fare_amount_paise
        else:
            # Recompute server-side
            fare_calc = calculate_fare(
                db,
                pickup_stop_id=booking.pickup_stop_id,
                drop_stop_id=booking.drop_stop_id,
                vehicle_type=booking.vehicle_type or "GOLF_CART",
                is_priority=current_user.is_priority
            )
            amount_paise = fare_calc["final_fare_paise"]
            booking.fare_amount_paise = amount_paise
            db.commit()

    if amount_paise <= 0:
        raise HTTPException(status_code=400, detail="Cannot create payment order for free ride")

    receipt = generate_receipt_number("RZP")
    order = create_razorpay_order(amount_paise, receipt=receipt)

    # Save payment record in CREATED state
    payment = Payment(
        booking_id=payload.booking_id,
        user_id=current_user.id,
        order_id=order["order_id"],
        amount_paise=amount_paise,
        currency="INR",
        status="CREATED",
        payment_method="RAZORPAY",
        receipt_number=receipt
    )
    db.add(payment)
    db.commit()

    return CreateOrderResponse(
        order_id=order["order_id"],
        amount=order["amount"],
        currency=order["currency"],
        key_id=settings.RAZORPAY_KEY_ID,
        receipt=receipt,
        mode=settings.PAYMENTS_MODE
    )

@router.post("/verify", response_model=VerifyPaymentResponse)
def verify_payment(
    payload: VerifyPaymentRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Cryptographic HMAC-SHA256 signature verification for Razorpay payments.
    """
    is_valid = verify_razorpay_signature(
        payload.razorpay_order_id,
        payload.razorpay_payment_id,
        payload.razorpay_signature
    )

    if not is_valid:
        raise HTTPException(status_code=400, detail="Payment signature verification failed. Possible tampering detected.")

    payment = db.query(Payment).filter(Payment.order_id == payload.razorpay_order_id).first()
    if not payment:
        payment = Payment(
            booking_id=payload.booking_id,
            user_id=current_user.id,
            order_id=payload.razorpay_order_id,
            amount_paise=1500,
            currency="INR",
            receipt_number=generate_receipt_number("RZP")
        )
        db.add(payment)

    payment.payment_id = payload.razorpay_payment_id
    payment.signature = payload.razorpay_signature
    payment.status = "CAPTURED"
    payment.updated_at = datetime.now(timezone.utc)

    # Mark booking as paid if associated
    if payload.booking_id or payment.booking_id:
        b_id = payload.booking_id or payment.booking_id
        booking = db.query(BookingRequest).filter(BookingRequest.id == b_id).first()
        if booking:
            booking.payment_status = "PAID"
            booking.payment_method = "RAZORPAY"

    db.commit()
    db.refresh(payment)

    return VerifyPaymentResponse(
        status="CAPTURED",
        payment_id=payment.payment_id,
        order_id=payment.order_id,
        receipt_number=payment.receipt_number,
        message="Payment verified and captured successfully."
    )

@router.post("/webhook")
async def razorpay_webhook(
    request: Request,
    x_razorpay_signature: Optional[str] = Header(None),
    db: Session = Depends(get_db)
):
    """
    Idempotent webhook endpoint for Razorpay payment events.
    """
    if not x_razorpay_signature:
        raise HTTPException(status_code=400, detail="Missing X-Razorpay-Signature header")

    raw_body = await request.body()
    if not verify_webhook_signature(raw_body, x_razorpay_signature):
        raise HTTPException(status_code=400, detail="Invalid webhook signature")

    event_data = await request.json()
    event_type = event_data.get("event")
    payload = event_data.get("payload", {}).get("payment", {}).get("entity", {})

    order_id = payload.get("order_id")
    payment_id = payload.get("id")

    if order_id:
        payment = db.query(Payment).filter(Payment.order_id == order_id).first()
        if payment:
            if event_type == "payment.captured" and payment.status != "CAPTURED":
                payment.status = "CAPTURED"
                payment.payment_id = payment_id
                payment.updated_at = datetime.now(timezone.utc)
                if payment.booking_id:
                    booking = db.query(BookingRequest).filter(BookingRequest.id == payment.booking_id).first()
                    if booking:
                        booking.payment_status = "PAID"
                db.commit()
            elif event_type == "payment.failed":
                payment.status = "FAILED"
                payment.error_code = payload.get("error_code")
                payment.error_description = payload.get("error_description")
                db.commit()

    return {"status": "ok", "event": event_type}

@router.get("/wallet/balance", response_model=WalletBalanceResponse)
def get_wallet_balance(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Returns student Campus Wallet balance."""
    wallet = get_or_create_wallet(db, current_user.id)
    return WalletBalanceResponse(
        user_id=current_user.id,
        balance_inr=wallet.balance_paise / 100.0,
        balance_paise=wallet.balance_paise,
        currency="INR",
        last_updated_at=wallet.updated_at.strftime("%d %b %Y, %H:%M")
    )

@router.get("/wallet/ledger", response_model=WalletLedgerResponse)
def get_wallet_ledger(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Returns historical ledger entries for student's Campus Wallet."""
    wallet = get_or_create_wallet(db, current_user.id)
    entries = db.query(WalletLedger).filter(WalletLedger.wallet_id == wallet.id).order_by(WalletLedger.id.desc()).all()

    formatted_entries = [
        WalletLedgerEntry(
            id=e.id,
            entry_type=e.entry_type,
            amount_inr=e.amount_paise / 100.0,
            balance_after_inr=e.balance_after_paise / 100.0,
            reference_type=e.reference_type,
            description=e.description,
            created_at=e.created_at.strftime("%d %b %Y, %H:%M")
        )
        for e in entries
    ]

    return WalletLedgerResponse(
        balance_inr=wallet.balance_paise / 100.0,
        entries=formatted_entries
    )

@router.post("/wallet/topup", response_model=WalletBalanceResponse)
def topup_user_wallet(
    payload: WalletTopupRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Adds funds to student's Campus Wallet."""
    if payload.amount_inr <= 0:
        raise HTTPException(status_code=400, detail="Topup amount must be greater than zero")

    amount_paise = int(round(payload.amount_inr * 100))
    ref = generate_receipt_number("TOP")
    wallet = topup_wallet(db, current_user.id, amount_paise, ref, f"Online Top-up: ₹{payload.amount_inr:.2f}")

    return WalletBalanceResponse(
        user_id=current_user.id,
        balance_inr=wallet.balance_paise / 100.0,
        balance_paise=wallet.balance_paise,
        currency="INR",
        last_updated_at=wallet.updated_at.strftime("%d %b %Y, %H:%M")
    )

@router.post("/wallet/pay")
def pay_with_wallet(
    payload: WalletPayRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Pays for a booking using Campus Wallet with atomic double-spend prevention.
    """
    booking = db.query(BookingRequest).filter(
        BookingRequest.id == payload.booking_id,
        BookingRequest.student_id == current_user.id
    ).first()

    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found")

    if booking.payment_status == "PAID":
        raise HTTPException(status_code=400, detail="Booking is already paid")

    fare_amount_paise = booking.fare_amount_paise or 1500
    try:
        wallet = deduct_wallet(
            db,
            user_id=current_user.id,
            amount_paise=fare_amount_paise,
            booking_id=booking.id,
            description=f"Ride payment: {booking.pickup_stop.name if booking.pickup_stop else 'Origin'} to {booking.drop_stop.name if booking.drop_stop else 'Dest'}"
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    receipt = generate_receipt_number("WAL")
    payment = Payment(
        booking_id=booking.id,
        user_id=current_user.id,
        order_id=f"wal_{receipt}",
        payment_id=f"pay_{receipt}",
        amount_paise=fare_amount_paise,
        currency="INR",
        status="CAPTURED",
        payment_method="WALLET",
        receipt_number=receipt
    )
    db.add(payment)

    booking.payment_status = "PAID"
    booking.payment_method = "WALLET"
    db.commit()

    return {
        "status": "success",
        "payment_method": "WALLET",
        "receipt_number": receipt,
        "amount_inr": fare_amount_paise / 100.0,
        "remaining_wallet_balance_inr": wallet.balance_paise / 100.0,
        "message": "Payment completed successfully from Campus Wallet."
    }

@router.get("/receipt/{booking_id}", response_model=PaymentReceiptResponse)
def get_payment_receipt(
    booking_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Generates official downloadable ride payment receipt."""
    booking = db.query(BookingRequest).filter(BookingRequest.id == booking_id).first()
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found")

    payment = db.query(Payment).filter(Payment.booking_id == booking_id).order_by(Payment.id.desc()).first()
    receipt_no = payment.receipt_number if payment else f"CASH-{booking.id:06d}"
    amount_inr = (payment.amount_paise / 100.0) if payment else ((booking.fare_amount_paise or 1500) / 100.0)
    pay_method = payment.payment_method if payment else (booking.payment_method or "CASH")
    pay_status = payment.status if payment else (booking.payment_status or "PENDING")

    return PaymentReceiptResponse(
        receipt_number=receipt_no,
        booking_id=booking.id,
        user_name=booking.student.username if booking.student else "Student Rider",
        amount_inr=amount_inr,
        payment_method=pay_method,
        status=pay_status,
        paid_at=(payment.created_at if payment else booking.requested_at).strftime("%d %b %Y, %H:%M UTC"),
        pickup_stop=booking.pickup_stop.name if booking.pickup_stop else "Campus Pickup",
        drop_stop=booking.drop_stop.name if booking.drop_stop else "Campus Drop",
        vehicle_type=booking.vehicle_type or "GOLF_CART"
    )

@router.get("/admin/collections")
def get_admin_collections(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(["ADMIN"]))
):
    """
    Admin financial dashboard: total revenue, breakdown by Razorpay vs Wallet vs Cash,
    and driver cash reconciliation.
    """
    payments = db.query(Payment).filter(Payment.status == "CAPTURED").all()
    bookings_cash = db.query(BookingRequest).filter(
        BookingRequest.payment_method == "CASH",
        BookingRequest.payment_status == "PAID"
    ).all()

    total_razorpay_paise = sum(p.amount_paise for p in payments if p.payment_method == "RAZORPAY")
    total_wallet_paise = sum(p.amount_paise for p in payments if p.payment_method == "WALLET")
    total_cash_paise = sum(b.fare_amount_paise or 1500 for b in bookings_cash)

    total_revenue_inr = (total_razorpay_paise + total_wallet_paise + total_cash_paise) / 100.0

    return {
        "total_revenue_inr": total_revenue_inr,
        "razorpay_collected_inr": total_razorpay_paise / 100.0,
        "wallet_debited_inr": total_wallet_paise / 100.0,
        "cash_collected_inr": total_cash_paise / 100.0,
        "total_transactions": len(payments) + len(bookings_cash),
        "payments_mode": settings.PAYMENTS_MODE
    }
