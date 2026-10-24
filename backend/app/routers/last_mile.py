from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session
from datetime import datetime, timezone, timedelta
from typing import List, Optional
import logging

logger = logging.getLogger("campusride.lastmile")

from app.database import get_db
from app.config import settings
from app.models.last_mile import ErickshawStand, ErickshawFare, GolfCart, BookingRequest
from app.models.user import User
from app.models.transport import Stop
from app.models.shuttle_ops import Driver
from app.schemas.last_mile import (
    ErickshawStandResponse, ErickshawFareResponse, FareQuoteResponse,
    GolfCartResponse, BookingCreateRequest, BookingStatusUpdateRequest,
    BookingResponse, AvailableCartsResponse, DriverInfo, BookingRateRequest,
    BookingCancelRequest
)
from app.auth import get_current_user, get_current_user_optional
from app.services.cart_dispatcher import (
    auto_assign_cart_or_enqueue,
    reassign_cart_if_queue_pending,
    check_and_expire_no_shows,
    update_queue_positions_and_wait_times
)
from app.services.fare_engine import calculate_fare
from app.services.payment_service import process_refund
from app.events import event_bus, EVENT_GOLF_CART_STATUS_UPDATED

router = APIRouter(prefix="/lastmile", tags=["Module 3: Last-Mile & Golf Cart Booking"])

def enrich_booking_response(booking: BookingRequest) -> BookingResponse:
    """Helper to convert a BookingRequest ORM model to BookingResponse with driver info and INR fare."""
    resp = BookingResponse.model_validate(booking)
    resp.fare_amount_inr = (booking.fare_amount_paise or 0) / 100.0
    
    if booking.assigned_cart and booking.assigned_cart.assigned_driver:
        drv = booking.assigned_cart.assigned_driver
        driver_name = "Gurpreet Singh (Campus Transit)"
        if drv.user and drv.user.username:
            driver_name = drv.user.username.replace("_", " ").title()
        resp.assigned_driver = DriverInfo(
            id=drv.id,
            name=driver_name,
            phone_number=drv.phone_number or "+91-98765-22002",
            license_number=drv.license_number or "PB-08-2021-00452"
        )
    return resp

@router.get("/availability")
def get_stand_availability(
    stop_id: Optional[int] = None,
    db: Session = Depends(get_db)
):
    """
    Returns E-rickshaw and Auto stand availability.
    Optionally filters by proximity to a given stop ID.
    """
    query = db.query(ErickshawStand)
    if stop_id:
        query = query.filter(ErickshawStand.nearby_stop_id == stop_id)
    stands = query.all()
    return stands

@router.get("/fare", response_model=FareQuoteResponse)
def get_fare_quote(
    from_stand_id: int = Query(...),
    to_stand_id: int = Query(...),
    db: Session = Depends(get_db)
):
    """Returns flat campus fare in INR between designated stands."""
    from_s = db.query(ErickshawStand).filter(ErickshawStand.id == from_stand_id).first()
    to_s = db.query(ErickshawStand).filter(ErickshawStand.id == to_stand_id).first()
    if not from_s or not to_s:
        raise HTTPException(status_code=404, detail="One or both stands not found")

    fare = db.query(ErickshawFare).filter(
        ErickshawFare.from_stand_id == from_stand_id,
        ErickshawFare.to_stand_id == to_stand_id
    ).first()

    fare_amount = fare.fare_inr if fare else 15
    return FareQuoteResponse(
        from_stand=from_s.name,
        to_stand=to_s.name,
        fare_inr=fare_amount,
        estimated_availability=from_s.availability_status
    )

@router.get("/carts/available", response_model=AvailableCartsResponse)
def get_available_carts(db: Session = Depends(get_db)):
    """Lists currently available and busy golf carts."""
    carts = db.query(GolfCart).all()
    idle_carts = [c for c in carts if c.status == "IDLE"]
    
    # Enrich carts with driver info
    enriched_carts: List[GolfCartResponse] = []
    for c in carts:
        cart_resp = GolfCartResponse.model_validate(c)
        if c.assigned_driver:
            drv = c.assigned_driver
            driver_name = "Gurpreet Singh (Campus Transit)"
            if drv.user and drv.user.username:
                driver_name = drv.user.username.replace("_", " ").title()
            cart_resp.driver = DriverInfo(
                id=drv.id,
                name=driver_name,
                phone_number=drv.phone_number or "+91-98765-22002",
                license_number=drv.license_number or "PB-08-2021-00452"
            )
        enriched_carts.append(cart_resp)
        
    return AvailableCartsResponse(
        total_carts=len(carts),
        available_carts=[c for c in enriched_carts if c.status == "IDLE"],
        busy_carts_count=len(carts) - len(idle_carts)
    )

@router.post("/bookings", response_model=BookingResponse)
async def create_booking(
    req: BookingCreateRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Student books a campus ride (instant or scheduled).
    - Checks active booking limits (max 1 active booking per student).
    - Calculates server-side fare using FareEngine.
    - Evaluates priority (medical / differently-abled get priority queue & 100% off).
    - Auto-assigns nearest free cart or queues request.
    """
    # 1. Check for active booking to prevent abuse
    active_booking = db.query(BookingRequest).filter(
        BookingRequest.student_id == current_user.id,
        BookingRequest.status.in_(["REQUESTED", "ACCEPTED", "ARRIVING", "PICKED_UP"])
    ).first()
    if active_booking:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"You already have an active booking (#{active_booking.id} in state '{active_booking.status}'). Please complete or cancel it first."
        )

    # Validate stops
    pickup = db.query(Stop).filter(Stop.id == req.pickup_stop_id).first()
    drop = db.query(Stop).filter(Stop.id == req.drop_stop_id).first()
    if not pickup or not drop:
        raise HTTPException(status_code=400, detail="Invalid pickup or drop stop")
    if pickup.id == drop.id:
        raise HTTPException(status_code=400, detail="Pickup and drop stop cannot be identical")

    # Priority determination: Profile flag or request override
    is_prio = bool(current_user.is_priority or req.is_priority)
    prio_reason = req.priority_reason or current_user.priority_reason or ("Medical/Accessibility Priority" if is_prio else None)

    # 2. Server-side fare calculation
    vehicle_type = (req.vehicle_type or "GOLF_CART").upper()
    fare_quote = calculate_fare(
        db=db,
        pickup_stop_id=pickup.id,
        drop_stop_id=drop.id,
        vehicle_type=vehicle_type,
        is_priority=is_prio,
        scheduled_time=req.scheduled_for
    )
    fare_amount_paise = fare_quote["final_fare_paise"]
    payment_method = req.payment_method or ("FREE" if fare_amount_paise == 0 else "CASH")
    payment_status = "PAID" if fare_amount_paise == 0 else "PENDING"

    booking = BookingRequest(
        student_id=current_user.id,
        pickup_stop_id=req.pickup_stop_id,
        drop_stop_id=req.drop_stop_id,
        passenger_count=max(1, min(req.passenger_count, 6)),
        vehicle_type=vehicle_type,
        fare_amount_paise=fare_amount_paise,
        payment_method=payment_method,
        payment_status=payment_status,
        is_priority=is_prio,
        priority_reason=prio_reason,
        scheduled_for=req.scheduled_for,
        status="REQUESTED"
    )
    db.add(booking)
    db.commit()
    db.refresh(booking)

    # Run auto-assignment or enqueue
    await auto_assign_cart_or_enqueue(db, booking)
    db.refresh(booking)
    return enrich_booking_response(booking)

@router.get("/bookings/{id}", response_model=BookingResponse)
def get_booking_status(id: int, db: Session = Depends(get_db)):
    """Fetch booking details, current queue position, assigned cart, and estimated wait."""
    booking = db.query(BookingRequest).filter(BookingRequest.id == id).first()
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found")
    return enrich_booking_response(booking)

@router.get("/bookings/student/active", response_model=Optional[BookingResponse])
def get_student_active_booking(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Returns the logged-in student's active booking if any."""
    booking = db.query(BookingRequest).filter(
        BookingRequest.student_id == current_user.id,
        BookingRequest.status.in_(["REQUESTED", "ACCEPTED", "ARRIVING", "PICKED_UP"])
    ).order_by(BookingRequest.id.desc()).first()
    if not booking:
        return None
    return enrich_booking_response(booking)

@router.get("/bookings/driver/assigned", response_model=Optional[BookingResponse])
def get_driver_assigned_booking(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Returns the current assigned booking for the logged-in golf cart driver."""
    # Find driver's cart
    cart = db.query(GolfCart).join(GolfCart.assigned_driver).filter(
        GolfCart.assigned_driver.has(user_id=current_user.id)
    ).first()
    
    if not cart:
        driver = current_user.driver_profile
        if driver:
            cart = db.query(GolfCart).filter(GolfCart.assigned_driver_id == driver.id).first()

    if not cart:
        return None

    booking = db.query(BookingRequest).filter(
        BookingRequest.assigned_cart_id == cart.id,
        BookingRequest.status.in_(["ACCEPTED", "ARRIVING", "PICKED_UP"])
    ).first()
    if not booking:
        return None
    return enrich_booking_response(booking)

@router.post("/bookings/{id}/cancel", response_model=BookingResponse)
async def cancel_booking(
    id: int,
    req: Optional[BookingCancelRequest] = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Rider or driver cancels booking. Frees cart and re-enqueues waiting riders."""
    booking = db.query(BookingRequest).filter(BookingRequest.id == id).first()
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found")
        
    booking.status = "CANCELLED"
    booking.cancellation_reason = req.reason if req else "Cancelled by user"

    # Automated refund if booking was paid
    try:
        process_refund(db, booking.id, booking.cancellation_reason)
    except Exception as e:
        logger.warning(f"Refund processing error on cancel: {e}")
    
    cart = booking.assigned_cart
    if cart:
        cart.status = "IDLE"
        db.commit()
        await reassign_cart_if_queue_pending(db, cart)
    update_queue_positions_and_wait_times(db)
    db.commit()
    db.refresh(booking)

    await event_bus.publish(EVENT_GOLF_CART_STATUS_UPDATED, {
        "booking_id": booking.id,
        "action": "CANCEL",
        "status": "CANCELLED",
        "assigned_cart_id": booking.assigned_cart_id
    })
    return enrich_booking_response(booking)

@router.post("/bookings/{id}/rate", response_model=BookingResponse)
def rate_booking(
    id: int,
    req: BookingRateRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Submits 1-5 star rating and feedback for completed booking."""
    booking = db.query(BookingRequest).filter(BookingRequest.id == id).first()
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found")
        
    if req.rating < 1 or req.rating > 5:
        raise HTTPException(status_code=400, detail="Rating must be between 1 and 5")
        
    booking.rating = req.rating
    booking.feedback = req.feedback
    db.commit()
    db.refresh(booking)
    return enrich_booking_response(booking)

@router.patch("/bookings/{id}/status", response_model=BookingResponse)
@router.post("/bookings/{id}/driver-status", response_model=BookingResponse)
async def update_booking_status(
    id: int,
    req: BookingStatusUpdateRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Cart driver or student updates booking status:
    Actions:
    - ACCEPT: Driver accepts assigned dispatch.
    - REJECT: Driver declines -> cart made IDLE, request re-queued for another cart.
    - ARRIVING: Driver reached pickup point -> sets 5 min no-show countdown timer.
    - PICKED_UP: Passenger boarded -> cart state becomes IN_SERVICE.
    - COMPLETE: Reached drop location -> marks COMPLETED, cart becomes IDLE.
    - CANCEL: Ride cancelled.
    - NO_SHOW: Auto or driver marks passenger absent -> cart freed.
    """
    booking = db.query(BookingRequest).filter(BookingRequest.id == id).first()
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found")

    action = req.action.upper()
    now = datetime.now(timezone.utc)

    if action == "ACCEPT":
        booking.status = "ACCEPTED"
        if booking.assigned_cart:
            booking.assigned_cart.status = "EN_ROUTE"

    elif action == "REJECT":
        cart = booking.assigned_cart
        booking.status = "REQUESTED"
        booking.assigned_cart_id = None
        if cart:
            cart.status = "IDLE"
        db.commit()
        update_queue_positions_and_wait_times(db)

    elif action == "ARRIVING":
        booking.status = "ARRIVING"
        # Set 5-minute no-show deadline
        booking.no_show_deadline = now + timedelta(seconds=settings.NO_SHOW_TIMEOUT_SEC)
        if booking.assigned_cart:
            booking.assigned_cart.status = "ARRIVED"

    elif action == "PICKED_UP":
        booking.status = "PICKED_UP"
        booking.no_show_deadline = None
        if booking.assigned_cart:
            booking.assigned_cart.status = "IN_SERVICE"

    elif action in ("COMPLETE", "COMPLETED"):
        booking.status = "COMPLETED"
        if booking.payment_method == "CASH":
            booking.payment_status = "PAID"
        cart = booking.assigned_cart
        if cart:
            cart.current_stop_id = booking.drop_stop_id
            cart.status = "IDLE"
            db.commit()
            await reassign_cart_if_queue_pending(db, cart)

    elif action == "CANCEL":
        booking.status = "CANCELLED"
        booking.cancellation_reason = req.reason or "Cancelled by driver"
        cart = booking.assigned_cart
        if cart:
            cart.status = "IDLE"
            db.commit()
            await reassign_cart_if_queue_pending(db, cart)
        update_queue_positions_and_wait_times(db)

    elif action == "NO_SHOW":
        booking.status = "NO_SHOW"
        booking.cancellation_reason = "Passenger did not arrive within 5 minutes"
        cart = booking.assigned_cart
        if cart:
            cart.status = "IDLE"
            db.commit()
            await reassign_cart_if_queue_pending(db, cart)
        update_queue_positions_and_wait_times(db)

    else:
        raise HTTPException(status_code=400, detail=f"Unsupported status action: '{action}'")

    db.commit()
    db.refresh(booking)

    await event_bus.publish(EVENT_GOLF_CART_STATUS_UPDATED, {
        "booking_id": booking.id,
        "action": action,
        "status": booking.status,
        "assigned_cart_id": booking.assigned_cart_id,
        "no_show_deadline": booking.no_show_deadline.isoformat() if booking.no_show_deadline else None
    })
    return enrich_booking_response(booking)
