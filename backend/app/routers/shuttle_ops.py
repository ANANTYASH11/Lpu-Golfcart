from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from datetime import datetime, timezone
from typing import List, Optional

from app.database import get_db
from app.models.shuttle_ops import Shuttle, Driver, TripInstance, TripStatusUpdate
from app.models.transport import RouteStop, Stop
from app.schemas.shuttle_ops import (
    TripStartRequest, TripProgressRequest, CrowdUpdateRequest,
    TripCancelRequest, TripInstanceResponse, TripStatusUpdateResponse
)
from app.services.eta_calculator import calculate_crowd_level
from app.events import (
    event_bus,
    EVENT_TRIP_STARTED,
    EVENT_TRIP_PROGRESS_UPDATED,
    EVENT_CROWD_UPDATED,
    EVENT_TRIP_CANCELLED,
    EVENT_TRIP_COMPLETED
)

router = APIRouter(prefix="/operations", tags=["Module 2: Shuttle Operations"])

@router.get("/trips/active", response_model=List[TripInstanceResponse])
def get_active_trips(db: Session = Depends(get_db)):
    """Lists all active shuttle trips currently operating or scheduled."""
    return db.query(TripInstance).filter(
        TripInstance.status.in_(["SCHEDULED", "STARTED", "AT_STOP", "IN_TRANSIT", "DELAYED"])
    ).all()

@router.get("/trips/{id}", response_model=TripInstanceResponse)
def get_trip(id: int, db: Session = Depends(get_db)):
    trip = db.query(TripInstance).filter(TripInstance.id == id).first()
    if not trip:
        raise HTTPException(status_code=404, detail="Trip not found")
    return trip

@router.post("/trips/{id}/start", response_model=TripInstanceResponse)
async def start_trip(id: int, req: Optional[TripStartRequest] = None, db: Session = Depends(get_db)):
    """
    Driver initiates the shuttle trip.
    Publishes TripStarted event.
    """
    trip = db.query(TripInstance).filter(TripInstance.id == id).first()
    if not trip:
        raise HTTPException(status_code=404, detail="Trip not found")
    if trip.status not in ["SCHEDULED", "COMPLETED", "CANCELLED"]:
        raise HTTPException(status_code=400, detail=f"Cannot start trip currently in state '{trip.status}'")

    first_stop = None
    if req and req.start_stop_id:
        first_stop = db.query(Stop).filter(Stop.id == req.start_stop_id).first()
    if not first_stop:
        first_rs = db.query(RouteStop).filter(RouteStop.route_id == trip.route_id).order_by(RouteStop.stop_order).first()
        first_stop_id = first_rs.stop_id if first_rs else None
    else:
        first_stop_id = first_stop.id

    now = datetime.now(timezone.utc)
    trip.status = "STARTED"
    trip.actual_start_time = now
    trip.current_stop_id = first_stop_id
    trip.last_driver_update_at = now
    trip.current_delay_sec = 0

    # Determine next stop
    if first_stop_id:
        current_rs = db.query(RouteStop).filter(
            RouteStop.route_id == trip.route_id,
            RouteStop.stop_id == first_stop_id
        ).first()
        if current_rs:
            next_rs = db.query(RouteStop).filter(
                RouteStop.route_id == trip.route_id,
                RouteStop.stop_order == current_rs.stop_order + 1
            ).first()
            trip.next_stop_id = next_rs.stop_id if next_rs else None

    # Record status update
    status_update = TripStatusUpdate(
        trip_instance_id=trip.id,
        update_type="START",
        stop_id=first_stop_id,
        passenger_count=trip.current_passenger_count,
        delay_sec=0,
        notes="Trip started by driver",
        recorded_at=now
    )
    db.add(status_update)
    db.commit()
    db.refresh(trip)

    await event_bus.publish(EVENT_TRIP_STARTED, {
        "trip_id": trip.id,
        "route_id": trip.route_id,
        "shuttle_id": trip.shuttle_id,
        "current_stop_id": trip.current_stop_id,
        "next_stop_id": trip.next_stop_id,
        "status": trip.status,
        "crowd_level": trip.current_crowd_level
    })
    return trip

@router.post("/trips/{id}/progress", response_model=TripInstanceResponse)
async def update_trip_progress(id: int, req: TripProgressRequest, db: Session = Depends(get_db)):
    """
    Driver advances shuttle to the next stop or updates delays.
    Publishes TripProgressUpdated event.
    """
    trip = db.query(TripInstance).filter(TripInstance.id == id).first()
    if not trip:
        raise HTTPException(status_code=404, detail="Trip not found")
    if trip.status not in ["STARTED", "AT_STOP", "IN_TRANSIT", "DELAYED"]:
        raise HTTPException(status_code=400, detail=f"Cannot progress trip in '{trip.status}' state")

    now = datetime.now(timezone.utc)
    trip.current_stop_id = req.next_stop_id
    trip.status = "AT_STOP"
    trip.last_driver_update_at = now
    trip.current_delay_sec = req.delay_sec

    if req.passenger_count is not None:
        trip.current_passenger_count = req.passenger_count
        trip.current_crowd_level = calculate_crowd_level(
            req.passenger_count, trip.shuttle.capacity if trip.shuttle else 35
        )

    # Compute next stop in sequence
    current_rs = db.query(RouteStop).filter(
        RouteStop.route_id == trip.route_id,
        RouteStop.stop_id == req.next_stop_id
    ).first()
    if current_rs:
        next_rs = db.query(RouteStop).filter(
            RouteStop.route_id == trip.route_id,
            RouteStop.stop_order == current_rs.stop_order + 1
        ).first()
        trip.next_stop_id = next_rs.stop_id if next_rs else None

    status_update = TripStatusUpdate(
        trip_instance_id=trip.id,
        update_type="STOP_REACHED",
        stop_id=req.next_stop_id,
        passenger_count=trip.current_passenger_count,
        delay_sec=req.delay_sec,
        notes=req.notes or f"Reached stop {req.next_stop_id}",
        recorded_at=now
    )
    db.add(status_update)
    db.commit()
    db.refresh(trip)

    await event_bus.publish(EVENT_TRIP_PROGRESS_UPDATED, {
        "trip_id": trip.id,
        "current_stop_id": trip.current_stop_id,
        "next_stop_id": trip.next_stop_id,
        "status": trip.status,
        "delay_sec": trip.current_delay_sec,
        "passenger_count": trip.current_passenger_count,
        "crowd_level": trip.current_crowd_level
    })
    return trip

@router.post("/trips/{id}/crowd", response_model=TripInstanceResponse)
async def update_crowd(id: int, req: CrowdUpdateRequest, db: Session = Depends(get_db)):
    """
    Updates onboard passenger count and computes crowd level (<40% Low, 40-80% Moderate, >80% Full).
    Publishes CrowdUpdated event.
    """
    trip = db.query(TripInstance).filter(TripInstance.id == id).first()
    if not trip:
        raise HTTPException(status_code=404, detail="Trip not found")

    capacity = trip.shuttle.capacity if trip.shuttle else 35
    crowd_level = calculate_crowd_level(req.passenger_count, capacity)

    now = datetime.now(timezone.utc)
    trip.current_passenger_count = req.passenger_count
    trip.current_crowd_level = crowd_level
    trip.last_driver_update_at = now

    status_update = TripStatusUpdate(
        trip_instance_id=trip.id,
        update_type="CROWD_CHANGE",
        stop_id=trip.current_stop_id,
        passenger_count=req.passenger_count,
        delay_sec=trip.current_delay_sec,
        notes=req.notes or f"Crowd updated to {crowd_level}",
        recorded_at=now
    )
    db.add(status_update)
    db.commit()
    db.refresh(trip)

    await event_bus.publish(EVENT_CROWD_UPDATED, {
        "trip_id": trip.id,
        "passenger_count": trip.current_passenger_count,
        "crowd_level": trip.current_crowd_level,
        "capacity": capacity,
        "ratio": round(req.passenger_count / capacity, 2)
    })
    return trip

@router.post("/trips/{id}/end", response_model=TripInstanceResponse)
async def end_trip(id: int, db: Session = Depends(get_db)):
    """Marks trip completed."""
    trip = db.query(TripInstance).filter(TripInstance.id == id).first()
    if not trip:
        raise HTTPException(status_code=404, detail="Trip not found")

    now = datetime.now(timezone.utc)
    trip.status = "COMPLETED"
    trip.actual_end_time = now
    trip.last_driver_update_at = now

    status_update = TripStatusUpdate(
        trip_instance_id=trip.id,
        update_type="COMPLETED",
        stop_id=trip.current_stop_id,
        passenger_count=0,
        delay_sec=trip.current_delay_sec,
        notes="Trip marked completed by driver",
        recorded_at=now
    )
    db.add(status_update)
    db.commit()
    db.refresh(trip)

    await event_bus.publish(EVENT_TRIP_COMPLETED, {"trip_id": trip.id, "status": "COMPLETED"})
    return trip

@router.post("/trips/{id}/cancel", response_model=TripInstanceResponse)
async def cancel_trip(id: int, req: TripCancelRequest, db: Session = Depends(get_db)):
    """Cancels trip and broadcasts TripCancelled event."""
    trip = db.query(TripInstance).filter(TripInstance.id == id).first()
    if not trip:
        raise HTTPException(status_code=404, detail="Trip not found")

    now = datetime.now(timezone.utc)
    trip.status = "CANCELLED"
    trip.last_driver_update_at = now

    status_update = TripStatusUpdate(
        trip_instance_id=trip.id,
        update_type="CANCEL",
        stop_id=trip.current_stop_id,
        passenger_count=trip.current_passenger_count,
        delay_sec=trip.current_delay_sec,
        notes=f"Cancelled: {req.reason}",
        recorded_at=now
    )
    db.add(status_update)
    db.commit()
    db.refresh(trip)

    await event_bus.publish(EVENT_TRIP_CANCELLED, {
        "trip_id": trip.id,
        "reason": req.reason,
        "status": "CANCELLED"
    })
    return trip

@router.post("/trips/{id}/undo", response_model=TripInstanceResponse)
async def undo_last_update(id: int, db: Session = Depends(get_db)):
    """
    Driver mis-tap recovery:
    Pops the most recent TripStatusUpdate and restores previous trip state.
    """
    trip = db.query(TripInstance).filter(TripInstance.id == id).first()
    if not trip:
        raise HTTPException(status_code=404, detail="Trip not found")

    updates = db.query(TripStatusUpdate).filter(
        TripStatusUpdate.trip_instance_id == trip.id
    ).order_by(TripStatusUpdate.id.desc()).all()

    if not updates:
        raise HTTPException(status_code=400, detail="No prior status updates to undo")

    last_update = updates[0]
    db.delete(last_update)
    db.commit()

    # Restore from previous update or default
    if len(updates) > 1:
        prev = updates[1]
        trip.current_stop_id = prev.stop_id
        trip.current_passenger_count = prev.passenger_count
        trip.current_delay_sec = prev.delay_sec
        trip.current_crowd_level = calculate_crowd_level(
            prev.passenger_count, trip.shuttle.capacity if trip.shuttle else 35
        )
        if prev.update_type == "START":
            trip.status = "STARTED"
        elif prev.update_type == "STOP_REACHED":
            trip.status = "AT_STOP"
        elif prev.update_type == "CROWD_CHANGE":
            trip.status = "AT_STOP"
        elif prev.update_type == "CANCEL":
            trip.status = "STARTED"
    else:
        # Revert to scheduled
        trip.status = "SCHEDULED"
        trip.actual_start_time = None
        trip.current_stop_id = None
        trip.next_stop_id = None
        trip.current_passenger_count = 0
        trip.current_crowd_level = "LOW"
        trip.current_delay_sec = 0

    now = datetime.now(timezone.utc)
    trip.last_driver_update_at = now
    db.commit()
    db.refresh(trip)

    await event_bus.publish(EVENT_TRIP_PROGRESS_UPDATED, {
        "trip_id": trip.id,
        "status": trip.status,
        "current_stop_id": trip.current_stop_id,
        "notes": "Action undone by driver"
    })
    return trip
