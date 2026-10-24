from sqlalchemy import Column, Integer, String, Boolean, DateTime, ForeignKey, Text
from sqlalchemy.orm import relationship
from datetime import datetime, timezone
import uuid
from app.database import Base

class Payment(Base):
    __tablename__ = "payments"

    id = Column(Integer, primary_key=True, index=True)
    booking_id = Column(Integer, ForeignKey("booking_requests.id"), nullable=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    order_id = Column(String(100), unique=True, index=True, nullable=False)
    payment_id = Column(String(100), unique=True, index=True, nullable=True)
    signature = Column(String(255), nullable=True)
    amount_paise = Column(Integer, nullable=False)  # 1 INR = 100 paise
    currency = Column(String(10), default="INR", nullable=False)
    status = Column(String(30), default="CREATED", nullable=False)  # CREATED, CAPTURED, FAILED, REFUNDED
    payment_method = Column(String(30), default="RAZORPAY", nullable=False)  # RAZORPAY, WALLET, CASH
    receipt_number = Column(String(50), unique=True, index=True, nullable=False)
    error_code = Column(String(50), nullable=True)
    error_description = Column(String(255), nullable=True)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), nullable=False)
    updated_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc), nullable=False)

    booking = relationship("BookingRequest", foreign_keys=[booking_id])
    user = relationship("User", foreign_keys=[user_id])
    refunds = relationship("Refund", back_populates="payment")

class WalletAccount(Base):
    __tablename__ = "wallet_accounts"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), unique=True, index=True, nullable=False)
    balance_paise = Column(Integer, default=0, nullable=False)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), nullable=False)
    updated_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc), nullable=False)

    user = relationship("User", foreign_keys=[user_id])
    ledger_entries = relationship("WalletLedger", back_populates="wallet", order_by="desc(WalletLedger.id)")

class WalletLedger(Base):
    __tablename__ = "wallet_ledgers"

    id = Column(Integer, primary_key=True, index=True)
    wallet_id = Column(Integer, ForeignKey("wallet_accounts.id"), index=True, nullable=False)
    user_id = Column(Integer, ForeignKey("users.id"), index=True, nullable=False)
    entry_type = Column(String(10), nullable=False)  # CREDIT, DEBIT
    amount_paise = Column(Integer, nullable=False)
    balance_after_paise = Column(Integer, nullable=False)
    reference_type = Column(String(30), nullable=False)  # TOPUP, RIDE_PAYMENT, REFUND, ADMIN_ADJUSTMENT
    reference_id = Column(String(100), nullable=False)
    description = Column(String(255), nullable=False)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), nullable=False)

    wallet = relationship("WalletAccount", back_populates="ledger_entries")
    user = relationship("User", foreign_keys=[user_id])

class Refund(Base):
    __tablename__ = "refunds"

    id = Column(Integer, primary_key=True, index=True)
    payment_id = Column(Integer, ForeignKey("payments.id"), index=True, nullable=False)
    booking_id = Column(Integer, ForeignKey("booking_requests.id"), index=True, nullable=True)
    amount_paise = Column(Integer, nullable=False)
    reason = Column(String(255), nullable=False)
    status = Column(String(20), default="PROCESSED", nullable=False)  # PROCESSED, PENDING, FAILED
    refund_gateway_id = Column(String(100), nullable=True)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), nullable=False)

    payment = relationship("Payment", back_populates="refunds")
    booking = relationship("BookingRequest", foreign_keys=[booking_id])
