from datetime import datetime, timezone
from typing import Optional, List, Tuple
from sqlalchemy.orm import Session
from sqlalchemy import or_

from app.models.transport import Stop, Route, RouteStop
from app.models.shuttle_ops import TripInstance
from app.models.last_mile import GolfCart, ErickshawStand, ErickshawFare, BookingRequest
from app.services.eta_calculator import compute_trip_eta_to_stop
from app.services.cart_dispatcher import estimate_travel_minutes_between_stops
from app.schemas.transport import (
    JourneyResponse, JourneyLegShuttle, JourneyLegLastMile, StopResponse
)

def plan_multimodal_journey(
    db: Session,
    from_stop_id: int,
    to_stop_id: int
) -> JourneyResponse:
    from_stop = db.query(Stop).filter(Stop.id == from_stop_id).first()
    to_stop = db.query(Stop).filter(Stop.id == to_stop_id).first()
    
    if not from_stop or not to_stop:
        raise ValueError("Invalid origin or destination stop ID")
        
    # 1. Find routes connecting from_stop to to_stop
    # Query route_stops for both
    from_route_stops = db.query(RouteStop).filter(RouteStop.stop_id == from_stop_id).all()
    candidate_routes = []
    
    for frs in from_route_stops:
        trs = db.query(RouteStop).filter(
            RouteStop.route_id == frs.route_id,
            RouteStop.stop_id == to_stop_id,
            RouteStop.stop_order > frs.stop_order
        ).first()
        if trs:
            candidate_routes.append((frs.route_id, frs.stop_order, trs.stop_order))
            
    # 2. Find active trips on candidate routes
    primary_shuttle: Optional[JourneyLegShuttle] = None
    alt_shuttle: Optional[JourneyLegShuttle] = None
    
    active_trips_data: List[Tuple[TripInstance, int, str, str]] = []
    
    for route_id, _, _ in candidate_routes:
        trips = db.query(TripInstance).filter(
            TripInstance.route_id == route_id,
            TripInstance.status.in_(["STARTED", "AT_STOP", "IN_TRANSIT", "DELAYED", "SCHEDULED"])
        ).all()
        
        for t in trips:
            is_live, eta_sec, label, crowd = compute_trip_eta_to_stop(db, t, from_stop_id)
            if eta_sec is not None:
                active_trips_data.append((t, eta_sec, label, crowd))
                
    # Sort active trips by ETA
    active_trips_data.sort(key=lambda x: x[1])
    
    if active_trips_data:
        best_trip, eta_sec, label, crowd = active_trips_data[0]
        eta_mins = max(1, round(eta_sec / 60)) if eta_sec is not None else None
        is_full = (crowd == "FULL")
        
        primary_shuttle = JourneyLegShuttle(
            route_name=best_trip.route.name,
            route_code=best_trip.route.code,
            route_color=best_trip.route.color_hex,
            vehicle_number=best_trip.shuttle.vehicle_number,
            from_stop_name=from_stop.name,
            to_stop_name=to_stop.name,
            live_eta_minutes=eta_mins,
            crowd_level=crowd,
            is_full=is_full,
            status_label=label
        )
        
        if len(active_trips_data) > 1:
            alt_trip, a_eta_sec, a_label, a_crowd = active_trips_data[1]
            a_eta_mins = max(1, round(a_eta_sec / 60))
            alt_shuttle = JourneyLegShuttle(
                route_name=alt_trip.route.name,
                route_code=alt_trip.route.code,
                route_color=alt_trip.route.color_hex,
                vehicle_number=alt_trip.shuttle.vehicle_number,
                from_stop_name=from_stop.name,
                to_stop_name=to_stop.name,
                live_eta_minutes=a_eta_mins,
                crowd_level=a_crowd,
                is_full=(a_crowd == "FULL"),
                status_label=a_label
            )

    # 3. Assess Golf Cart availability
    idle_carts = db.query(GolfCart).filter(GolfCart.status == "IDLE").all()
    est_cart_wait_mins = 3
    if idle_carts:
        nearest_cart = min(
            idle_carts,
            key=lambda c: estimate_travel_minutes_between_stops(db, c.current_stop_id or from_stop_id, from_stop_id)
        )
        est_cart_wait_mins = estimate_travel_minutes_between_stops(
            db, nearest_cart.current_stop_id or from_stop_id, from_stop_id
        )
    else:
        # Check queue depth
        pending_count = db.query(BookingRequest).filter(BookingRequest.status == "REQUESTED").count()
        est_cart_wait_mins = max(4, (pending_count + 1) * 4)

    golf_cart_option = JourneyLegLastMile(
        mode="GOLF_CART",
        description=f"Golf Cart booking available at {from_stop.name}",
        origin_point=from_stop.name,
        destination_point=to_stop.name,
        estimated_wait_minutes=est_cart_wait_mins,
        availability_status="AVAILABLE" if idle_carts else "HIGH_DEMAND_QUEUE",
        bookable=True,
        details={"available_idle_carts": len(idle_carts)}
    )

    # 4. Assess E-Rickshaw availability and fare
    from_stand = db.query(ErickshawStand).filter(ErickshawStand.nearby_stop_id == from_stop_id).first()
    to_stand = db.query(ErickshawStand).filter(ErickshawStand.nearby_stop_id == to_stop_id).first()
    
    rickshaw_fare_inr = 15
    rickshaw_status = "AVAILABLE"
    
    if from_stand:
        rickshaw_status = from_stand.availability_status
        if to_stand:
            fare_rec = db.query(ErickshawFare).filter(
                ErickshawFare.from_stand_id == from_stand.id,
                ErickshawFare.to_stand_id == to_stand.id
            ).first()
            if fare_rec:
                rickshaw_fare_inr = fare_rec.fare_inr

    rickshaw_option = JourneyLegLastMile(
        mode="E_RICKSHAW",
        description=f"E-Rickshaw at {from_stand.name if from_stand else from_stop.name} (Flat ₹{rickshaw_fare_inr})",
        origin_point=from_stand.name if from_stand else from_stop.name,
        destination_point=to_stand.name if to_stand else to_stop.name,
        estimated_fare_inr=rickshaw_fare_inr,
        availability_status=rickshaw_status,
        bookable=False,
        details={"estimated_rickshaws": from_stand.estimated_rickshaws_present if from_stand else 3}
    )

    # 5. Synthesize Multimodal Recommendation Summary
    if primary_shuttle and not primary_shuttle.is_full:
        summary = (
            f"{primary_shuttle.vehicle_number} ({primary_shuttle.route_name}) arrives in ~{primary_shuttle.live_eta_minutes} min "
            f"with {primary_shuttle.crowd_level.lower()} crowd. "
            f"Last-mile: Golf Cart available at {to_stop.name} (~{est_cart_wait_mins} min wait) or E-Rickshaw (₹{rickshaw_fare_inr})."
        )
        recommended_last_mile = golf_cart_option
        alt_options = [rickshaw_option]
    elif primary_shuttle and primary_shuttle.is_full:
        alt_shuttle_text = f"Next shuttle in ~{alt_shuttle.live_eta_minutes} min." if alt_shuttle else "No other shuttle scheduled soon."
        summary = (
            f"⚠️ Caution: {primary_shuttle.vehicle_number} is FULL (>80% capacity). {alt_shuttle_text} "
            f"Recommended: Book a Golf Cart directly from {from_stop.name} (~{est_cart_wait_mins} min wait) "
            f"or take an E-Rickshaw (₹{rickshaw_fare_inr}, {rickshaw_status.lower()})."
        )
        recommended_last_mile = golf_cart_option
        alt_options = [rickshaw_option]
    else:
        summary = (
            f"No direct shuttle currently active from {from_stop.name} to {to_stop.name}. "
            f"Instant Golf Cart booking recommended (~{est_cart_wait_mins} min wait) "
            f"or board an E-Rickshaw (₹{rickshaw_fare_inr})."
        )
        recommended_last_mile = golf_cart_option
        alt_options = [rickshaw_option]

    return JourneyResponse(
        from_stop=StopResponse.model_validate(from_stop),
        to_stop=StopResponse.model_validate(to_stop),
        recommendation_summary=summary,
        shuttle_leg=primary_shuttle,
        alternative_shuttle_leg=alt_shuttle,
        last_mile_option=recommended_last_mile,
        alternative_options=alt_options
    )
