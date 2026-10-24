import os
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent

class Settings:
    PROJECT_NAME: str = "CampusRide - LPU Campus Transport Management"
    PROJECT_VERSION: str = "1.0.0"
    API_V1_STR: str = "/api/v1"
    
    # SQLite Database
    DATABASE_URL: str = os.getenv("DATABASE_URL", f"sqlite:///{BASE_DIR}/campusride.db")
    
    # Auth & Security
    SECRET_KEY: str = os.getenv("SECRET_KEY", "campusride-super-secret-lpu-key-2026")
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24  # 24 hours
    
    # Live Tracking & Operational Rules
    LIVE_STALENESS_THRESHOLD_SEC: int = 300  # 5 minutes without driver update -> "Live unavailable"
    CROWD_LOW_THRESHOLD: float = 0.40        # < 40% Low
    CROWD_MODERATE_THRESHOLD: float = 0.80   # 40% - 80% Moderate, > 80% Full
    
    # Golf Cart Rules
    MAX_ACTIVE_BOOKINGS_PER_STUDENT: int = 1
    NO_SHOW_TIMEOUT_SEC: int = 300          # 5 minutes auto-cancel on arrival
    
    # Razorpay Payment Gateway (Test Mode) & Campus Wallet
    RAZORPAY_KEY_ID: str = os.getenv("RAZORPAY_KEY_ID", "rzp_test_5173UniCartLPU")
    RAZORPAY_KEY_SECRET: str = os.getenv("RAZORPAY_KEY_SECRET", "UniCartSecretKey2026Secure")
    RAZORPAY_WEBHOOK_SECRET: str = os.getenv("RAZORPAY_WEBHOOK_SECRET", "UniCartWebhookSecret2026")
    PAYMENTS_MODE: str = os.getenv("PAYMENTS_MODE", "test")

    # Campus Safety & Security
    CAMPUS_HELPLINE_NUMBER: str = os.getenv("CAMPUS_HELPLINE_NUMBER", "+91 1824 517000")

    # CORS
    CORS_ORIGINS: list[str] = ["*"]

settings = Settings()

