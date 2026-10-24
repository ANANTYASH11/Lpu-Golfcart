from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session
from typing import List, Optional
from datetime import datetime, timezone

from app.database import get_db
from app.models.transport import Stop, Route, RouteStop, Schedule
from app.models.shuttle_ops import TripInstance
from app.schemas.transport import (
    StopResponse, RouteResponse, TripArrivalResponse, JourneyResponse
)
from app.services.eta_calculator import compute_trip_eta_to_stop
from app.services.journey_planner import plan_multimodal_journey

router = APIRouter(prefix="/transport", tags=["Module 1: Student Transport"])

@router.get("/stops", response_model=List[StopResponse])
def get_stops(db: Session = Depends(get_db)):
    """Lists all designated campus transport stops with geo coordinates."""
    return db.query(Stop).order_by(Stop.id).all()

@router.get("/routes/{id}", response_model=RouteResponse)
def get_route(id: int, db: Session = Depends(get_db)):
    """Fetches details for a route including ordered stops and average segment times."""
    route = db.query(Route).filter(Route.id == id).first()
    if not route:
        raise HTTPException(status_code=404, detail="Route not found")
    return route

@router.get("/trips/search")
def search_trips(
    from_stop_id: int = Query(..., alias="from"),
    to_stop_id: int = Query(..., alias="to"),
    time: Optional[str] = None,
    db: Session = Depends(get_db)
):
    """
    Search trips running between two stops.
    """
    from_stop = db.query(Stop).filter(Stop.id == from_stop_id).first()
    to_stop = db.query(Stop).filter(Stop.id == to_stop_id).first()
    if not from_stop or not to_stop:
        raise HTTPException(status_code=400, detail="Invalid origin or destination stop")

    from_stops = db.query(RouteStop).filter(RouteStop.stop_id == from_stop_id).all()
    matching_trips = []

    for fs in from_stops:
        ts = db.query(RouteStop).filter(
            RouteStop.route_id == fs.route_id,
            RouteStop.stop_id == to_stop_id,
            RouteStop.stop_order > fs.stop_order
        ).first()
        if ts:
            # Active trips
            trips = db.query(TripInstance).filter(
                TripInstance.route_id == fs.route_id,
                TripInstance.status.in_(["STARTED", "AT_STOP", "IN_TRANSIT", "DELAYED", "SCHEDULED"])
            ).all()
            for t in trips:
                is_live, eta_sec, label, crowd = compute_trip_eta_to_stop(db, t, from_stop_id)
                matching_trips.append({
                    "trip_id": t.id,
                    "route_name": t.route.name,
                    "route_code": t.route.code,
                    "vehicle_number": t.shuttle.vehicle_number,
                    "trip_status": t.status,
                    "is_live": is_live,
                    "eta_seconds": eta_sec,
                    "eta_minutes": round(eta_sec / 60) if eta_sec is not None else None,
                    "status_label": label,
                    "crowd_level": crowd
                })

    return {
        "from_stop": from_stop.name,
        "to_stop": to_stop.name,
        "trips": matching_trips
    }

@router.get("/stops/{id}/arrivals", response_model=List[TripArrivalResponse])
def get_stop_arrivals(id: int, db: Session = Depends(get_db)):
    """
    Live arrivals board for a stop.
    Calculates live ETA, delay adjustments, and crowd level.
    Marks data 'Live unavailable' and falls back to timetable schedule if no driver update > 5 min.
    """
    stop = db.query(Stop).filter(Stop.id == id).first()
    if not stop:
        raise HTTPException(status_code=404, detail="Stop not found")

    route_stops = db.query(RouteStop).filter(RouteStop.stop_id == id).all()
    route_ids = [rs.route_id for rs in route_stops]

    trips = db.query(TripInstance).filter(
        TripInstance.route_id.in_(route_ids),
        TripInstance.status.in_(["STARTED", "AT_STOP", "IN_TRANSIT", "DELAYED", "SCHEDULED"])
    ).all()

    arrivals = []
    now = datetime.now(timezone.utc)

    for trip in trips:
        is_live, eta_sec, label, crowd = compute_trip_eta_to_stop(db, trip, id, now)
        if eta_sec is None and not is_live:
            # Still show scheduled entry if available
            sched = db.query(Schedule).filter(Schedule.route_id == trip.route_id).first()
            sched_time = sched.departure_time if sched else None
            arrivals.append(TripArrivalResponse(
                trip_id=trip.id,
                route_id=trip.route_id,
                route_name=trip.route.name,
                route_code=trip.route.code,
                route_color=trip.route.color_hex,
                vehicle_number=trip.shuttle.vehicle_number,
                current_stop_name=trip.current_stop.name if trip.current_stop else None,
                next_stop_name=trip.next_stop.name if trip.next_stop else None,
                target_stop_name=stop.name,
                scheduled_departure_time=sched_time,
                live_eta_iso=None,
                eta_seconds=None,
                eta_minutes=None,
                current_delay_sec=trip.current_delay_sec or 0,
                current_passenger_count=trip.current_passenger_count or 0,
                crowd_level=crowd,
                is_live=False,
                status_label=label,
                trip_status=trip.status
            ))
        elif eta_sec is not None:
            eta_mins = round(eta_sec / 60)
            arrivals.append(TripArrivalResponse(
                trip_id=trip.id,
                route_id=trip.route_id,
                route_name=trip.route.name,
                route_code=trip.route.code,
                route_color=trip.route.color_hex,
                vehicle_number=trip.shuttle.vehicle_number,
                current_stop_name=trip.current_stop.name if trip.current_stop else None,
                next_stop_name=trip.next_stop.name if trip.next_stop else None,
                target_stop_name=stop.name,
                scheduled_departure_time=None,
                live_eta_iso=None,
                eta_seconds=eta_sec,
                eta_minutes=eta_mins,
                current_delay_sec=trip.current_delay_sec or 0,
                current_passenger_count=trip.current_passenger_count or 0,
                crowd_level=crowd,
                is_live=is_live,
                status_label=label,
                trip_status=trip.status
            ))

    # Sort arrivals by eta_seconds (ascending, None at the end)
    arrivals.sort(key=lambda a: (a.eta_seconds is None, a.eta_seconds or 999999))
    return arrivals

@router.get("/journey", response_model=JourneyResponse)
def get_journey_plan(
    from_stop_id: int = Query(..., alias="from"),
    to_stop_id: int = Query(..., alias="to"),
    db: Session = Depends(get_db)
):
    """
    Multimodal Journey Planner:
    Returns shuttle leg (live ETA, crowd level) + last-mile option (e-rickshaw or golf cart).
    If shuttle is full (>80%) or cancelled, automatically suggests next shuttle or golf cart.
    """
    try:
        return plan_multimodal_journey(db, from_stop_id, to_stop_id)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
