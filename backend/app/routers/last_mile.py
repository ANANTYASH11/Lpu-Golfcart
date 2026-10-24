from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session
from datetime import datetime, timezone, timedelta
from typing import List, Optional

from app.database import get_db
from app.config import settings
from app.models.last_mile import ErickshawStand, ErickshawFare, GolfCart, BookingRequest
from app.models.user import User
from app.models.transport import Stop
from app.schemas.last_mile import (
    ErickshawStandResponse, ErickshawFareResponse, FareQuoteResponse,
    GolfCartResponse, BookingCreateRequest, BookingStatusUpdateRequest,
    BookingResponse, AvailableCartsResponse
)
from app.auth import get_current_user, get_current_user_optional
from app.services.cart_dispatcher import (
    auto_assign_cart_or_enqueue,
    reassign_cart_if_queue_pending,
    check_and_expire_no_shows,
    update_queue_positions_and_wait_times
)
from app.events import event_bus, EVENT_GOLF_CART_STATUS_UPDATED

router = APIRouter(prefix="/lastmile", tags=["Module 3: Last-Mile & Golf Cart Booking"])

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

    fare_amount = fare.fare_inr if fare else 15  # default flat rate
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
    return AvailableCartsResponse(
        total_carts=len(carts),
        available_carts=idle_carts,
        busy_carts_count=len(carts) - len(idle_carts)
    )

@router.post("/bookings", response_model=BookingResponse)
async def create_booking(
    req: BookingCreateRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Student books a golf cart (instant or scheduled ahead).
    - Checks active booking limits (max 1 active booking per student).
    - Evaluates priority (differently-abled, medical, elderly visitors).
    - Auto-assigns nearest free cart with enough capacity or queues request.
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
    is_prio = current_user.is_priority or bool(req.is_priority)
    prio_reason = req.priority_reason or current_user.priority_reason or ("Medical/Priority" if is_prio else None)

    booking = BookingRequest(
        student_id=current_user.id,
        pickup_stop_id=req.pickup_stop_id,
        drop_stop_id=req.drop_stop_id,
        passenger_count=max(1, min(req.passenger_count, 6)),
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
    return booking

@router.get("/bookings/{id}", response_model=BookingResponse)
def get_booking_status(id: int, db: Session = Depends(get_db)):
    """Fetch booking details, current queue position, assigned cart, and estimated wait."""
    booking = db.query(BookingRequest).filter(BookingRequest.id == id).first()
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found")
    return booking

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
    return booking

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
        # Fallback: check any cart assigned to driver
        driver = current_user.driver_profile
        if driver:
            cart = db.query(GolfCart).filter(GolfCart.assigned_driver_id == driver.id).first()

    if not cart:
        return None

    booking = db.query(BookingRequest).filter(
        BookingRequest.assigned_cart_id == cart.id,
        BookingRequest.status.in_(["ACCEPTED", "ARRIVING", "PICKED_UP"])
    ).first()
    return booking

@router.patch("/bookings/{id}/status", response_model=BookingResponse)
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
    - REJECT: Driver rejects dispatch -> cart made IDLE, request re-queued for another cart.
    - ARRIVING: Driver reached pickup point -> sets 5 min no-show countdown timer.
    - PICKED_UP: Passenger boarded -> cart state becomes IN_SERVICE.
    - COMPLETE: Reached drop location -> marks COMPLETED, cart becomes IDLE, triggers next queue assignment.
    - CANCEL: Student or Admin cancels ride -> cart freed, next queue assignment.
    - NO_SHOW: Auto or driver marks passenger absent -> cart freed, next queue assignment.
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
        # Cart driver declined; unassign cart and re-enqueue booking
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

    elif action == "COMPLETE":
        booking.status = "COMPLETED"
        cart = booking.assigned_cart
        if cart:
            cart.current_stop_id = booking.drop_stop_id
            cart.status = "IDLE"
            db.commit()
            await reassign_cart_if_queue_pending(db, cart)

    elif action == "CANCEL":
        booking.status = "CANCELLED"
        cart = booking.assigned_cart
        if cart:
            cart.status = "IDLE"
            db.commit()
            await reassign_cart_if_queue_pending(db, cart)
        update_queue_positions_and_wait_times(db)

    elif action == "NO_SHOW":
        booking.status = "NO_SHOW"
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
    return booking
