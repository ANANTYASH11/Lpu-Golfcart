from pydantic import BaseModel, ConfigDict
from typing import Optional, List
from datetime import datetime

class CreateOrderRequest(BaseModel):
    amount_paise: int
    booking_id: Optional[int] = None

class CreateOrderResponse(BaseModel):
    order_id: str
    amount: int
    currency: str
    key_id: str
    receipt: str
    mode: str

class VerifyPaymentRequest(BaseModel):
    razorpay_order_id: str
    razorpay_payment_id: str
    razorpay_signature: str
    booking_id: Optional[int] = None

class VerifyPaymentResponse(BaseModel):
    status: str
    payment_id: str
    order_id: str
    receipt_number: str
    message: str

class WalletBalanceResponse(BaseModel):
    user_id: int
    balance_inr: float
    balance_paise: int
    currency: str
    last_updated_at: str

class WalletTopupRequest(BaseModel):
    amount_inr: float

class WalletPayRequest(BaseModel):
    booking_id: int

class WalletLedgerEntry(BaseModel):
    id: int
    entry_type: str
    amount_inr: float
    balance_after_inr: float
    reference_type: str
    description: str
    created_at: str

class WalletLedgerResponse(BaseModel):
    balance_inr: float
    entries: List[WalletLedgerEntry]

class PaymentReceiptResponse(BaseModel):
    receipt_number: str
    booking_id: Optional[int] = None
    user_name: str
    amount_inr: float
    payment_method: str
    status: str
    paid_at: str
    pickup_stop: Optional[str] = None
    drop_stop: Optional[str] = None
    vehicle_type: Optional[str] = None
