from datetime import datetime
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.auth import get_current_user, require_roles
from app.models.user import User
from app.models.safety import SosEvent, IncidentReport
from app.config import settings
from app.schemas.safety import (
    SosTriggerRequest,
    SosLocationUpdateRequest,
    SosResolveRequest,
    SosEventResponse,
    IncidentReportCreate,
    IncidentReportResponse,
    HelplineInfoResponse,
)

router = APIRouter(prefix="/safety", tags=["Campus Safety & SOS"])
get_current_admin = require_roles(["ADMIN", "admin"])

@router.get("/helpline", response_model=HelplineInfoResponse)
def get_helpline_info():
    """Returns dynamically configured campus helpline contacts."""
    return HelplineInfoResponse(
        helpline=settings.CAMPUS_HELPLINE_NUMBER,
        security_desk="+91 1824 517001",
        ambulance="108",
        police="112",
        women_safety="+91 1824 517109"
    )

@router.post("/sos/trigger", response_model=SosEventResponse, status_code=status.HTTP_201_CREATED)
def trigger_sos(
    req: SosTriggerRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Triggers an emergency SOS beacon.
    Creates an active beacon with GPS coordinates, battery level, and test flag.
    """
    sos = SosEvent(
        user_id=current_user.id,
        latitude=req.latitude,
        longitude=req.longitude,
        accuracy_meters=req.accuracy_meters,
        battery_level=req.battery_level,
        status="ACTIVE",
        is_test=req.is_test,
        trigger_type=req.trigger_type,
        notes=req.notes,
        created_at=datetime.utcnow(),
        updated_at=datetime.utcnow()
    )
    db.add(sos)
    db.commit()
    db.refresh(sos)

    return SosEventResponse(
        id=sos.id,
        user_id=sos.user_id,
        user_name=current_user.username or current_user.email,
        user_email=current_user.email,
        latitude=sos.latitude,
        longitude=sos.longitude,
        accuracy_meters=sos.accuracy_meters,
        battery_level=sos.battery_level,
        status=sos.status,
        is_test=sos.is_test,
        trigger_type=sos.trigger_type,
        notes=sos.notes,
        created_at=sos.created_at,
        updated_at=sos.updated_at,
        resolved_at=sos.resolved_at
    )

@router.post("/sos/{sos_id}/location", response_model=SosEventResponse)
def update_sos_location(
    sos_id: int,
    req: SosLocationUpdateRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Streams live GPS coordinates and battery info for an active beacon."""
    sos = db.query(SosEvent).filter(SosEvent.id == sos_id).first()
    if not sos:
        raise HTTPException(status_code=404, detail="SOS beacon not found")

    if sos.user_id != current_user.id and current_user.role.upper() != "ADMIN":
        raise HTTPException(status_code=403, detail="Not authorized to update this SOS beacon")

    if sos.status != "ACTIVE":
        raise HTTPException(status_code=400, detail="Cannot update location for an inactive SOS beacon")

    sos.latitude = req.latitude
    sos.longitude = req.longitude
    sos.accuracy_meters = req.accuracy_meters
    sos.battery_level = req.battery_level
    sos.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(sos)

    return SosEventResponse(
        id=sos.id,
        user_id=sos.user_id,
        user_name=sos.user.username if sos.user else None,
        user_email=sos.user.email if sos.user else None,
        latitude=sos.latitude,
        longitude=sos.longitude,
        accuracy_meters=sos.accuracy_meters,
        battery_level=sos.battery_level,
        status=sos.status,
        is_test=sos.is_test,
        trigger_type=sos.trigger_type,
        notes=sos.notes,
        created_at=sos.created_at,
        updated_at=sos.updated_at,
        resolved_at=sos.resolved_at
    )

@router.post("/sos/{sos_id}/resolve", response_model=SosEventResponse)
def resolve_sos(
    sos_id: int,
    req: SosResolveRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Cancels or resolves an active SOS beacon."""
    sos = db.query(SosEvent).filter(SosEvent.id == sos_id).first()
    if not sos:
        raise HTTPException(status_code=404, detail="SOS beacon not found")

    if sos.user_id != current_user.id and current_user.role.upper() != "ADMIN":
        raise HTTPException(status_code=403, detail="Not authorized to resolve this SOS beacon")

    sos.status = "RESOLVED"
    sos.resolved_by_id = current_user.id
    sos.resolved_at = datetime.utcnow()
    sos.updated_at = datetime.utcnow()
    if req.resolution_notes:
        sos.notes = (sos.notes or "") + f" [Resolved: {req.resolution_notes}]"
    db.commit()
    db.refresh(sos)

    return SosEventResponse(
        id=sos.id,
        user_id=sos.user_id,
        user_name=sos.user.username if sos.user else None,
        user_email=sos.user.email if sos.user else None,
        latitude=sos.latitude,
        longitude=sos.longitude,
        accuracy_meters=sos.accuracy_meters,
        battery_level=sos.battery_level,
        status=sos.status,
        is_test=sos.is_test,
        trigger_type=sos.trigger_type,
        notes=sos.notes,
        created_at=sos.created_at,
        updated_at=sos.updated_at,
        resolved_at=sos.resolved_at
    )

@router.get("/sos/active", response_model=List[SosEventResponse])
def get_active_sos_beacons(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Returns active SOS beacons.
    Admin sees all active campus beacons; regular users see their own active beacon.
    """
    query = db.query(SosEvent).filter(SosEvent.status == "ACTIVE")
    if current_user.role.upper() != "ADMIN":
        query = query.filter(SosEvent.user_id == current_user.id)

    events = query.order_by(SosEvent.created_at.desc()).all()
    results = []
    for ev in events:
        results.append(
            SosEventResponse(
                id=ev.id,
                user_id=ev.user_id,
                user_name=ev.user.username if ev.user else None,
                user_email=ev.user.email if ev.user else None,
                latitude=ev.latitude,
                longitude=ev.longitude,
                accuracy_meters=ev.accuracy_meters,
                battery_level=ev.battery_level,
                status=ev.status,
                is_test=ev.is_test,
                trigger_type=ev.trigger_type,
                notes=ev.notes,
                created_at=ev.created_at,
                updated_at=ev.updated_at,
                resolved_at=ev.resolved_at
            )
        )
    return results

@router.post("/incident/report", response_model=IncidentReportResponse, status_code=status.HTTP_201_CREATED)
def submit_incident_report(
    req: IncidentReportCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Submits a safety, harassment, or transport incident report."""
    incident = IncidentReport(
        user_id=current_user.id,
        category=req.category,
        description=req.description,
        location=req.location,
        vehicle_number=req.vehicle_number,
        status="SUBMITTED",
        created_at=datetime.utcnow(),
        updated_at=datetime.utcnow()
    )
    db.add(incident)
    db.commit()
    db.refresh(incident)

    return IncidentReportResponse(
        id=incident.id,
        user_id=incident.user_id,
        user_name=current_user.username or current_user.email,
        category=incident.category,
        description=incident.description,
        location=incident.location,
        vehicle_number=incident.vehicle_number,
        status=incident.status,
        resolution_notes=incident.resolution_notes,
        created_at=incident.created_at
    )

@router.get("/incident/my-reports", response_model=List[IncidentReportResponse])
def get_my_incident_reports(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Retrieves reports submitted by the logged-in user."""
    reports = db.query(IncidentReport).filter(
        IncidentReport.user_id == current_user.id
    ).order_by(IncidentReport.created_at.desc()).all()

    return [
        IncidentReportResponse(
            id=r.id,
            user_id=r.user_id,
            user_name=current_user.username or current_user.email,
            category=r.category,
            description=r.description,
            location=r.location,
            vehicle_number=r.vehicle_number,
            status=r.status,
            resolution_notes=r.resolution_notes,
            created_at=r.created_at
        )
        for r in reports
    ]

@router.get("/admin/incidents", response_model=List[IncidentReportResponse])
def get_all_incidents_admin(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_admin)
):
    """Admin endpoint to view all safety & transport incident reports."""
    reports = db.query(IncidentReport).order_by(IncidentReport.created_at.desc()).all()
    return [
        IncidentReportResponse(
            id=r.id,
            user_id=r.user_id,
            user_name=r.user.username if r.user else None,
            category=r.category,
            description=r.description,
            location=r.location,
            vehicle_number=r.vehicle_number,
            status=r.status,
            resolution_notes=r.resolution_notes,
            created_at=r.created_at
        )
        for r in reports
    ]
