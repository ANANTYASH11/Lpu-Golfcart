from fastapi import APIRouter, Depends, HTTPException, Query, UploadFile, File, Response, status
from sqlalchemy.orm import Session
from typing import List, Optional
from datetime import datetime, timezone, timedelta
import math
import csv
import io

from app.database import get_db
from app.models.transport import Stop, Route, RouteStop, Schedule
from app.models.shuttle_ops import TripInstance, Shuttle
from app.schemas.transport import (
    StopResponse, StopNearMeResponse, RouteResponse, TripArrivalResponse,
    JourneyResponse, TimetableResponse, TimetableRouteGroup, ScheduleResponse,
    NextDeparturesResponse, NextDepartureItem, ShuttleProgressResponse, ShuttleProgressStop
)
from app.services.eta_calculator import compute_trip_eta_to_stop
from app.services.journey_planner import plan_multimodal_journey
from app.services.fare_engine import is_campus_peak_hour, calculate_haversine_distance_km

router = APIRouter(prefix="/transport", tags=["Module 1: Student Transport"])

@router.get("/stops", response_model=List[StopResponse])
def get_stops(db: Session = Depends(get_db)):
    """Lists all designated campus transport stops with geo coordinates."""
    return db.query(Stop).order_by(Stop.id).all()

@router.get("/stops/near-me", response_model=List[StopNearMeResponse])
def get_stops_near_me(
    lat: float = Query(..., description="User latitude"),
    lon: Optional[float] = Query(None, description="User longitude (lon)"),
    lng: Optional[float] = Query(None, description="User longitude (lng)"),
    limit: int = Query(5, ge=1, le=20),
    db: Session = Depends(get_db)
):
    """
    Finds campus stops closest to rider's current GPS location,
    with walking distance and estimated walk time.
    """
    target_lon = lon if lon is not None else lng
    if target_lon is None:
        raise HTTPException(status_code=422, detail="Missing longitude: pass 'lon' or 'lng'")

    all_stops = db.query(Stop).all()
    results = []

    for stop in all_stops:
        # Distance calculation
        lat1, lon1 = math.radians(lat), math.radians(target_lon)
        lat2, lon2 = math.radians(stop.latitude), math.radians(stop.longitude)
        dlat = lat2 - lat1
        dlon = lon2 - lon1
        a = math.sin(dlat / 2)**2 + math.cos(lat1) * math.cos(lat2) * math.sin(dlon / 2)**2
        c = 2 * math.asin(math.sqrt(max(0.0, min(1.0, a))))
        dist_meters = int(round(6371000 * c))
        # Walk speed: ~75 meters/min (4.5 km/h)
        walk_mins = max(1, int(round(dist_meters / 75.0)))

        results.append({
            "id": stop.id,
            "name": stop.name,
            "code": stop.code,
            "latitude": stop.latitude,
            "longitude": stop.longitude,
            "has_shelter": stop.has_shelter,
            "is_transfer_hub": stop.is_transfer_hub,
            "distance_meters": dist_meters,
            "walk_time_mins": walk_mins
        })

    results.sort(key=lambda s: s["distance_meters"])
    return results[:limit]

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
    """Search trips running between two stops."""
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

    arrivals.sort(key=lambda a: (a.eta_seconds is None, a.eta_seconds or 999999))
    return arrivals

@router.get("/shuttle/{shuttle_id}/progress", response_model=ShuttleProgressResponse)
def get_shuttle_progress(shuttle_id: int, db: Session = Depends(get_db)):
    """
    Returns ordered stops progress for a shuttle along its active route,
    identifying passed stops, current stop, and next stops with ETAs.
    """
    shuttle = db.query(Shuttle).filter(Shuttle.id == shuttle_id).first()
    if not shuttle:
        raise HTTPException(status_code=404, detail="Shuttle not found")

    active_trip = db.query(TripInstance).filter(
        TripInstance.shuttle_id == shuttle_id,
        TripInstance.status.in_(["STARTED", "AT_STOP", "IN_TRANSIT", "DELAYED", "SCHEDULED"])
    ).first()

    if not active_trip:
        raise HTTPException(status_code=404, detail="No active trip found for this shuttle")

    route_stops = db.query(RouteStop).filter(
        RouteStop.route_id == active_trip.route_id
    ).order_by(RouteStop.stop_order).all()

    current_order = 0
    if active_trip.current_stop_id:
        cur_rs = db.query(RouteStop).filter(
            RouteStop.route_id == active_trip.route_id,
            RouteStop.stop_id == active_trip.current_stop_id
        ).first()
        if cur_rs:
            current_order = cur_rs.stop_order

    stops_progress = []
    for rs in route_stops:
        is_passed = rs.stop_order < current_order
        is_current = rs.stop_id == active_trip.current_stop_id
        is_next = rs.stop_id == active_trip.next_stop_id

        eta_min = None
        if not is_passed:
            _, eta_sec, _, _ = compute_trip_eta_to_stop(db, active_trip, rs.stop_id)
            if eta_sec is not None:
                eta_min = max(0, round(eta_sec / 60))

        stops_progress.append(ShuttleProgressStop(
            stop_id=rs.stop.id,
            stop_name=rs.stop.name,
            stop_order=rs.stop_order,
            is_passed=is_passed,
            is_current=is_current,
            is_next=is_next,
            eta_minutes=eta_min
        ))

    return ShuttleProgressResponse(
        shuttle_id=shuttle.id,
        vehicle_number=shuttle.vehicle_number,
        route_id=active_trip.route_id,
        route_name=active_trip.route.name,
        route_color=active_trip.route.color_hex,
        status=active_trip.status,
        current_stop_name=active_trip.current_stop.name if active_trip.current_stop else None,
        next_stop_name=active_trip.next_stop.name if active_trip.next_stop else None,
        current_delay_sec=active_trip.current_delay_sec or 0,
        crowd_level=active_trip.current_crowd_level or "LOW",
        passenger_count=active_trip.current_passenger_count or 0,
        capacity=shuttle.capacity,
        stops=stops_progress
    )

@router.get("/timetable", response_model=TimetableResponse)
def get_timetable(
    schedule_type: str = Query("REGULAR", description="REGULAR, EXAM_DAY, or HOLIDAY"),
    db: Session = Depends(get_db)
):
    """
    Returns full campus route timetables from database,
    highlighting peak lecture-rush hours and active schedules.
    """
    sched_type = schedule_type.upper()
    routes = db.query(Route).filter(Route.is_active == True).all()

    route_groups = []
    for r in routes:
        schedules = db.query(Schedule).filter(
            Schedule.route_id == r.id,
            Schedule.schedule_type == sched_type
        ).order_by(Schedule.departure_time).all()

        # If no specific schedule type found, fallback to REGULAR
        if not schedules and sched_type != "REGULAR":
            schedules = db.query(Schedule).filter(
                Schedule.route_id == r.id,
                Schedule.schedule_type == "REGULAR"
            ).order_by(Schedule.departure_time).all()

        route_groups.append(TimetableRouteGroup(
            route_id=r.id,
            route_name=r.name,
            route_code=r.code,
            color_hex=r.color_hex,
            schedules=[ScheduleResponse.model_validate(s) for s in schedules]
        ))

    return TimetableResponse(
        schedule_type=sched_type,
        active_routes=route_groups,
        peak_hours_windows=[
            {"name": "Morning Lecture Rush", "start": "08:30", "end": "09:30"},
            {"name": "Midday Lunch Rush", "start": "12:30", "end": "13:30"},
            {"name": "Evening Departure Rush", "start": "16:30", "end": "17:30"}
        ],
        is_currently_peak=is_campus_peak_hour(),
        last_updated_at=datetime.now(timezone.utc).strftime("%d %b %Y, %H:%M UTC")
    )

@router.get("/timetable/next-departures/{stop_id}", response_model=NextDeparturesResponse)
def get_next_departures_for_stop(
    stop_id: int,
    db: Session = Depends(get_db)
):
    """Returns the next 5 departures for a designated stop."""
    stop = db.query(Stop).filter(Stop.id == stop_id).first()
    if not stop:
        raise HTTPException(status_code=404, detail="Stop not found")

    route_stops = db.query(RouteStop).filter(RouteStop.stop_id == stop_id).all()
    route_ids = [rs.route_id for rs in route_stops]

    all_schedules = db.query(Schedule).filter(
        Schedule.route_id.in_(route_ids)
    ).all()

    now = datetime.now(timezone.utc)
    current_time_str = now.strftime("%H:%M:%S")

    departure_items = []
    for s in all_schedules:
        # Calculate minutes until departure
        dep_time_str = s.departure_time
        # Convert to minutes
        try:
            h, m, sec = map(int, dep_time_str.split(":"))
            dep_mins = h * 60 + m
            now_mins = now.hour * 60 + now.minute
            diff_mins = dep_mins - now_mins
            if diff_mins < 0:
                diff_mins += 24 * 60  # Next day cycle
        except Exception:
            diff_mins = 15

        route = s.route
        departure_items.append(NextDepartureItem(
            route_name=route.name,
            route_code=route.code,
            route_color=route.color_hex,
            departure_time=s.departure_time,
            day_of_week=s.day_of_week,
            schedule_type=s.schedule_type or "REGULAR",
            frequency_mins=s.frequency_mins,
            mins_until_departure=diff_mins,
            is_peak=is_campus_peak_hour()
        ))

    departure_items.sort(key=lambda d: d.mins_until_departure)
    return NextDeparturesResponse(
        stop_id=stop.id,
        stop_name=stop.name,
        current_time=now.strftime("%H:%M"),
        departures=departure_items[:5]
    )

@router.get("/timetable/export-csv")
def export_timetable_csv(db: Session = Depends(get_db)):
    """Exports timetable schedules to CSV."""
    schedules = db.query(Schedule).all()
    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(["route_id", "route_code", "route_name", "departure_time", "day_of_week", "schedule_type", "frequency_mins"])

    for s in schedules:
        writer.writerow([
            s.route_id,
            s.route.code if s.route else "",
            s.route.name if s.route else "",
            s.departure_time,
            s.day_of_week,
            s.schedule_type or "REGULAR",
            s.frequency_mins
        ])

    return Response(
        content=output.getvalue(),
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=unicart_timetable.csv"}
    )

@router.post("/timetable/import-csv")
async def import_timetable_csv(
    file: UploadFile = File(...),
    db: Session = Depends(get_db)
):
    """Admin CSV import endpoint to update campus timetables."""
    contents = await file.read()
    decoded = contents.decode("utf-8")
    reader = csv.DictReader(io.StringIO(decoded))

    imported_count = 0
    for row in reader:
        try:
            route_id = int(row.get("route_id", 1))
            dep_time = row.get("departure_time", "08:30:00")
            day_week = row.get("day_of_week", "WEEKDAY")
            sched_type = row.get("schedule_type", "REGULAR")
            freq = int(row.get("frequency_mins", 15))

            # Upsert
            existing = db.query(Schedule).filter(
                Schedule.route_id == route_id,
                Schedule.departure_time == dep_time,
                Schedule.schedule_type == sched_type
            ).first()

            if existing:
                existing.day_of_week = day_week
                existing.frequency_mins = freq
            else:
                db.add(Schedule(
                    route_id=route_id,
                    departure_time=dep_time,
                    day_of_week=day_week,
                    schedule_type=sched_type,
                    frequency_mins=freq
                ))
            imported_count += 1
        except Exception as e:
            continue

    db.commit()
    return {
        "status": "success",
        "imported_rows": imported_count,
        "message": f"Successfully updated {imported_count} timetable schedule rows from CSV."
    }

@router.get("/journey", response_model=JourneyResponse)
def get_journey_plan(
    from_stop_id: int = Query(..., alias="from"),
    to_stop_id: int = Query(..., alias="to"),
    db: Session = Depends(get_db)
):
    """Multimodal Journey Planner."""
    try:
        return plan_multimodal_journey(db, from_stop_id, to_stop_id)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
