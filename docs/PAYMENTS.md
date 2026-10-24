# UniCart Payment Gateway & Campus Wallet Documentation

## Overview
UniCart incorporates a dual payment architecture tailored for university campus transport:
1. **Razorpay Payment Gateway (Test Mode)**: Supports credit/debit cards, UPI, and Netbanking via Razorpay Sandbox with server-side HMAC-SHA256 signature verification and idempotent webhooks.
2. **Campus Transit Wallet**: An atomic double-spend prevention ledger system that allows instant contactless payments and zero-wait boarding for university students and faculty.

---

## 1. Environment & Credentials Configuration
All credentials are loaded securely from environment variables (`.env`). No production secrets are hardcoded.

```ini
# Razorpay Test Mode Credentials
RAZORPAY_KEY_ID="rzp_test_5173UniCartLPU"
RAZORPAY_KEY_SECRET="UniCartSecretKey2026Secure"
RAZORPAY_WEBHOOK_SECRET="UniCartWebhookSecret2026"
PAYMENTS_MODE="test"
```

> [!NOTE]
> When `PAYMENTS_MODE=test`, the UI displays a prominent **"TEST PAYMENTS"** indicator. No real bank accounts or actual money are charged.

---

## 2. Server-Side Fare Calculation
To prevent client-side price tampering, all amounts are strictly computed by the server-side fare engine:
- **Campus Shuttle**: Always ₹0 (Free for all university students and faculty).
- **Smart E-Rickshaw**: Flat ₹15 student tariff.
- **Electric Golf Cart**: Base fare ₹10 + ₹5/km + 25% peak surcharge during class rush windows (08:30-09:30, 12:30-13:30, 16:30-17:30).
- **Priority Access**: 100% discount waiver for differently-abled, medical, and elderly riders.

---

## 3. Cryptographic Signature Verification
Razorpay signatures are verified using constant-time comparison (`hmac.compare_digest`) against the HMAC-SHA256 digest of `order_id|payment_id`:

$$\text{Signature} = \text{HMAC-SHA256}(\text{order\_id} \parallel "|" \parallel \text{payment\_id}, \text{RAZORPAY\_KEY\_SECRET})$$

Endpoints:
- `POST /api/v1/payments/create-order`: Generates a cryptographically tracked order in paise (1 INR = 100 paise).
- `POST /api/v1/payments/verify`: Validates client signature and captures payment. Rejects tampered payloads with `HTTP 400 Bad Request`.
- `POST /api/v1/payments/webhook`: Idempotently handles asynchronous webhook events (`payment.captured`, `payment.failed`) using `X-Razorpay-Signature`.

---

## 4. Campus Wallet & Double-Spend Protection
The Campus Wallet implements a double-entry ledger (`wallet_ledgers` table) with balance constraints:
- **Welcome Credit**: Every student account starts with ₹250 (25,000 paise) test transit balance.
- **Atomic Balance Check**: When paying for a ride, the system verifies `balance_paise >= fare_paise`. If insufficient, the transaction fails before any booking state transition.
- **Double-Spend Prevention**: If a ride is already marked `PAID`, subsequent payment calls are rejected with `HTTP 400 ("Booking is already paid")`.
- **Top-up**: Students can top up their wallet (+₹50, +₹100, +₹200, +₹500, or custom amounts) via Razorpay in test mode.

---

## 5. Automated Cancellation & Refunds
When a student or driver cancels an accepted ride, the system automatically checks if a payment was captured:
- If paid via **Campus Wallet**, the full fare is automatically credited back to the student's wallet balance, and an auditable `REFUND` ledger entry is recorded.
- If paid via **Razorpay**, a `Refund` record is generated with `status="PROCESSED"`.

---

## 6. Official Digital Receipts
Every completed transaction issues a printable digital receipt accessible via:
`GET /api/v1/payments/receipt/{booking_id}`

Fields:
- `receipt_number`: Unique alphanumeric format (e.g. `WAL-20261025-A1B2C3`).
- `user_name`: Student rider username.
- `amount_inr`: Exact transaction amount.
- `payment_method`: `RAZORPAY`, `WALLET`, or `CASH`.
- `paid_at`: ISO timestamp.
- `pickup_stop` and `drop_stop`: Named campus locations.

---

## 7. Admin Collections & Cash Reconciliation
Campus transit administrators can monitor all financial flows via:
`GET /api/v1/payments/admin/collections`

Provides:
- Total gross university transit revenue in INR.
- Razorpay gateway collections.
- Campus Wallet debits.
- Driver on-vehicle cash reconciliation.
