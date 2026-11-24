"""Settings API routes."""
from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session
from sqlalchemy import func
from typing import Optional
from pathlib import Path

from app.core.database import get_db
from app.models.photo import Photo
from app.models.person import Person
from app.models.relationship import Relationship
from app.models.tag import Tag
from app.core.config import settings
from app.core.user_settings import persist_thumbnail_quality

router = APIRouter(prefix="/settings", tags=["settings"])


class UpdateSettingsRequest(BaseModel):
    """The settings subset currently supported for persistence."""

    thumbnail_quality: Optional[int] = Field(default=None, ge=50, le=95)
    photo_directory: Optional[str] = None


@router.get("/")
async def get_settings():
    """Get current settings."""
    return {
        "photo_directory": str(settings.photos_path),
        "face_recognition_model": settings.FACE_DETECTION_MODEL,
        "face_tolerance": settings.FACE_RECOGNITION_TOLERANCE,
        "min_face_size": settings.MIN_FACE_SIZE,
        "thumbnail_size": settings.THUMBNAIL_SIZE,
        "thumbnail_quality": settings.THUMBNAIL_QUALITY,
        "thumbnail_format": settings.THUMBNAIL_FORMAT,
        "database_path": str(settings.DATABASE_URL.replace("sqlite:///", "")),
        "data_path": str(settings.data_path),
    }


@router.put("/")
async def update_settings(request: UpdateSettingsRequest):
    """Persist supported settings and return the effective values."""
    if request.thumbnail_quality is not None:
        try:
            persist_thumbnail_quality(request.thumbnail_quality)
        except (OSError, RuntimeError) as error:
            raise HTTPException(status_code=500, detail="Could not save thumbnail quality") from error
        settings.THUMBNAIL_QUALITY = request.thumbnail_quality

    if request.photo_directory is not None:
        photo_directory = Path(request.photo_directory).expanduser()
        if not photo_directory.is_dir():
            raise HTTPException(status_code=400, detail="Photo directory does not exist or is not a directory")
        photo_directory = photo_directory.resolve()
        try:
            from app.core.user_settings import persist_photo_directory
            persist_photo_directory(photo_directory)
        except (OSError, RuntimeError) as error:
            raise HTTPException(status_code=500, detail="Could not save photo directory") from error
        settings.PHOTOS_SOURCE_PATH = photo_directory

    return {
        "photo_directory": str(settings.photos_path),
        "face_recognition_model": settings.FACE_DETECTION_MODEL,
        "face_tolerance": settings.FACE_RECOGNITION_TOLERANCE,
        "min_face_size": settings.MIN_FACE_SIZE,
        "thumbnail_size": settings.THUMBNAIL_SIZE,
        "thumbnail_quality": settings.THUMBNAIL_QUALITY,
        "thumbnail_format": settings.THUMBNAIL_FORMAT,
        "database_path": str(settings.DATABASE_URL.replace("sqlite:///", "")),
        "data_path": str(settings.data_path),
    }


@router.get("/stats")
async def get_stats(db: Session = Depends(get_db)):
    """Get database statistics."""
    total_photos = db.query(Photo).count()
    total_persons = db.query(Person).count()
    total_relationships = db.query(Relationship).count()
    total_tags = db.query(Tag).count()

    # Database file size
    import os
    from pathlib import Path
    # Extract path from DATABASE_URL (sqlite:///path)
    db_path = settings.DATABASE_URL.replace("sqlite:///", "")
    db_size = os.path.getsize(db_path) if Path(db_path).exists() else 0

    # Photos with/without faces
    photos_with_faces = db.query(Photo).filter(Photo.is_processed == True).count()
    photos_without_faces = total_photos - photos_with_faces

    return {
        "total_photos": total_photos,
        "total_persons": total_persons,
        "total_relationships": total_relationships,
        "total_tags": total_tags,
        "db_size_mb": round(db_size / (1024 * 1024), 2),
        "photos_with_faces": photos_with_faces,
        "photos_without_faces": photos_without_faces,
    }


@router.post("/clear-database")
async def clear_database(db: Session = Depends(get_db)):
    """Clear all data from database (keeps photos folder intact)."""
    # Delete in order to respect foreign keys
    db.query(Tag).delete()
    db.query(Relationship).delete()
    # Photo-person associations
    from app.models.person import PhotoPerson
    db.query(PhotoPerson).delete()
    from app.models.tag import photo_tags
    db.query(photo_tags).delete()
    db.query(Person).delete()
    db.query(Photo).delete()
    db.commit()

    return {"success": True, "message": "Database cleared"}


@router.get("/face-processing-progress")
async def get_face_processing_progress():
    """Get face processing progress (placeholder for background job tracking)."""
    # In a real implementation, this would track a background job
    return {
        "processed": 0,
        "total": 0,
        "current": "Idle",
        "status": "idle",
    }


@router.post("/infer-relationships")
async def infer_relationships(
    min_cooccurrence: int = Query(3, ge=1),
    min_confidence: float = Query(0.7, ge=0.1, le=1.0),
    db: Session = Depends(get_db)
):
    """Trigger relationship inference from photo co-occurrence."""
    from app.services.relationship_service import RelationshipService

    service = RelationshipService(db)
    result = service.infer_relationships(min_cooccurrence, min_confidence)

    return {
        "created": result["created"],
        "relationships": result["relationships"],
    }


@router.post("/scan-photos")
async def scan_photos(force: bool = Query(False)):
    """Scan photo directory for new/updated photos."""
    from app.services.photo_scanner import PhotoScanner

    scanner = PhotoScanner()
    result = scanner.scan(force_rescan=force)

    return {
        "total_files": result["total_files"],
        "new_photos": result["new_photos"],
        "updated_photos": result["updated_photos"],
        "skipped_photos": result["skipped_photos"],
        "errors": result["errors"],
    }


@router.post("/process-faces")
async def process_faces(batch_size: int = Query(50, ge=1, le=200)):
    """Process all unprocessed photos for faces."""
    from app.services.face_recognition import FaceRecognitionService

    service = FaceRecognitionService()
    result = service.process_all_unprocessed(batch_size)

    return {
        "processed": result["processed"],
        "faces_found": result["faces_found"],
        "new_persons": result["new_persons"],
        "matched_persons": result["matched_persons"],
        "errors": result["errors"],
    }
