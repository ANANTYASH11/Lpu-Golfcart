import os
import uuid
from pathlib import Path
from datetime import datetime, timezone, timedelta
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form, status, Response
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session

from app.database import get_db
from app.auth import get_current_user, require_roles
from app.models.user import User
from app.models.priority import PriorityApplication
from app.schemas.priority import (
    PriorityStatusResponse,
    AdminReviewRequest,
    AdminApplicationItem
)

router = APIRouter(prefix="/priority", tags=["Priority Access & Accessibility"])

STORAGE_DIR = Path(__file__).resolve().parent.parent.parent / "data" / "priority_docs"
STORAGE_DIR.mkdir(parents=True, exist_ok=True)

ALLOWED_MIME_TYPES = {
    "application/pdf": ".pdf",
    "image/png": ".png",
    "image/jpeg": ".jpg",
    "image/jpg": ".jpg"
}
MAX_FILE_SIZE = 5 * 1024 * 1024  # 5 MB

@router.post("/apply", response_model=PriorityStatusResponse)
async def submit_priority_application(
    full_name: str = Form(...),
    reg_number: Optional[str] = Form(None),
    category: str = Form(...),
    reason_description: str = Form(...),
    document: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Submits a new medical / accessibility priority application with supporting document.
    Document is verified (PDF/PNG/JPG, max 5 MB) and stored in secure vault.
    """
    if category not in ["MEDICAL", "DIFFERENTLY_ABLED", "ELDERLY_VISITOR", "TEMPORARY_INJURY"]:
        raise HTTPException(
            status_code=400,
            detail="Invalid category. Must be MEDICAL, DIFFERENTLY_ABLED, ELDERLY_VISITOR, or TEMPORARY_INJURY"
        )

    # Validate MIME type
    mime_type = document.content_type or ""
    if mime_type not in ALLOWED_MIME_TYPES:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid file type '{mime_type}'. Supported formats: PDF, PNG, JPEG (Max 5 MB)."
        )

    # Read contents and check size
    contents = await document.read()
    file_size = len(contents)
    if file_size > MAX_FILE_SIZE:
        raise HTTPException(
            status_code=400,
            detail=f"File exceeds maximum allowed size of 5 MB (Current size: {file_size / (1024*1024):.2f} MB)."
        )

    ext = ALLOWED_MIME_TYPES[mime_type]
    unique_filename = f"priority_{current_user.id}_{uuid.uuid4().hex[:10]}{ext}"
    target_path = STORAGE_DIR / unique_filename

    # Save to disk
    with open(target_path, "wb") as f:
        f.write(contents)

    application = PriorityApplication(
        user_id=current_user.id,
        full_name=full_name,
        reg_number=reg_number,
        category=category,
        reason_description=reason_description,
        document_filename=document.filename or unique_filename,
        document_path=str(target_path),
        document_mime_type=mime_type,
        document_size_bytes=file_size,
        status="PENDING"
    )
    db.add(application)
    db.commit()
    db.refresh(application)

    return PriorityStatusResponse(
        id=application.id,
        user_id=application.user_id,
        full_name=application.full_name,
        category=application.category,
        reason_description=application.reason_description,
        document_filename=application.document_filename,
        status=application.status,
        admin_notes=application.admin_notes,
        applied_at=application.created_at.strftime("%d %b %Y, %H:%M UTC"),
        reviewed_at=application.reviewed_at.strftime("%d %b %Y, %H:%M UTC") if application.reviewed_at else None,
        expires_at=application.expires_at.strftime("%d %b %Y") if application.expires_at else None,
        is_active_priority=current_user.is_priority
    )

@router.get("/status", response_model=Optional[PriorityStatusResponse])
def get_user_priority_status(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Returns the student's latest priority application status, review notes, and expiration.
    """
    app = db.query(PriorityApplication).filter(
        PriorityApplication.user_id == current_user.id
    ).order_by(PriorityApplication.id.desc()).first()

    if not app:
        return None

    return PriorityStatusResponse(
        id=app.id,
        user_id=app.user_id,
        full_name=app.full_name,
        category=app.category,
        reason_description=app.reason_description,
        document_filename=app.document_filename,
        status=app.status,
        admin_notes=app.admin_notes,
        applied_at=app.created_at.strftime("%d %b %Y, %H:%M UTC"),
        reviewed_at=app.reviewed_at.strftime("%d %b %Y, %H:%M UTC") if app.reviewed_at else None,
        expires_at=app.expires_at.strftime("%d %b %Y") if app.expires_at else None,
        is_active_priority=current_user.is_priority
    )

@router.get("/document/{id}")
def download_priority_document(
    id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Secure file download endpoint. Only accessible by the applicant student or admin.
    """
    app = db.query(PriorityApplication).filter(PriorityApplication.id == id).first()
    if not app:
        raise HTTPException(status_code=404, detail="Document not found")

    if app.user_id != current_user.id and current_user.role != "ADMIN":
        raise HTTPException(status_code=403, detail="Unauthorized access to medical document")

    file_path = Path(app.document_path)
    if not file_path.exists():
        raise HTTPException(status_code=404, detail="Document file missing on disk")

    return FileResponse(
        path=str(file_path),
        media_type=app.document_mime_type,
        filename=app.document_filename
    )

@router.get("/admin/applications", response_model=List[AdminApplicationItem])
def get_admin_applications(
    status_filter: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(["ADMIN"]))
):
    """
    Admin review queue: lists applications with filtering (e.g. PENDING, APPROVED).
    """
    query = db.query(PriorityApplication)
    if status_filter:
        query = query.filter(PriorityApplication.status == status_filter.upper())
    apps = query.order_by(PriorityApplication.id.desc()).all()

    return [
        AdminApplicationItem(
            id=a.id,
            user_id=a.user_id,
            username=a.user.username,
            email=a.user.email,
            full_name=a.full_name,
            reg_number=a.reg_number,
            category=a.category,
            reason_description=a.reason_description,
            document_filename=a.document_filename,
            document_size_kb=round(a.document_size_bytes / 1024),
            status=a.status,
            applied_at=a.created_at.strftime("%d %b %Y, %H:%M UTC")
        )
        for a in apps
    ]

@router.post("/admin/applications/{id}/review")
def review_priority_application(
    id: int,
    payload: AdminReviewRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(["ADMIN"]))
):
    """
    Admin approves or rejects priority application.
    Approval instantly unlocks priority golf cart bookings for the student.
    """
    app = db.query(PriorityApplication).filter(PriorityApplication.id == id).first()
    if not app:
        raise HTTPException(status_code=404, detail="Application not found")

    now = datetime.now(timezone.utc)
    app.reviewed_by_id = current_user.id
    app.reviewed_at = now
    app.admin_notes = payload.notes

    student = db.query(User).filter(User.id == app.user_id).first()

    if payload.action.upper() == "APPROVE":
        app.status = "APPROVED"
        app.expires_at = now + timedelta(days=payload.validity_days)
        if student:
            student.is_priority = True
            student.priority_reason = app.category
    elif payload.action.upper() == "REJECT":
        app.status = "REJECTED"
        if student:
            # If rejected, remove priority unless student has another approved application
            other_active = db.query(PriorityApplication).filter(
                PriorityApplication.user_id == student.id,
                PriorityApplication.status == "APPROVED",
                PriorityApplication.id != app.id
            ).first()
            if not other_active:
                student.is_priority = False
                student.priority_reason = None
    else:
        raise HTTPException(status_code=400, detail="Invalid review action: must be APPROVE or REJECT")

    db.commit()
    return {
        "status": "success",
        "application_id": app.id,
        "new_status": app.status,
        "student_priority_active": student.is_priority if student else False,
        "message": f"Application #{app.id} marked as {app.status}."
    }
