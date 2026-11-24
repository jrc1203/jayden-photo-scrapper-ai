"""Photo API routes."""
from fastapi import APIRouter, Depends, HTTPException, Query, File, UploadFile, Form
from sqlalchemy.orm import Session
from sqlalchemy import func, or_
from typing import List, Optional
from pathlib import Path
import shutil

from app.core.database import get_db
from app.core.config import settings


def _validate_path_within_root(file_path: Path, root_path: Path) -> Path:
    """
    Validate that a file path is within the allowed root directory.
    Returns the resolved path if valid, raises HTTPException if not.
    """
    try:
        resolved_path = file_path.resolve()
        resolved_root = root_path.resolve()
        resolved_path.relative_to(resolved_root)
        return resolved_path
    except (ValueError, OSError):
        raise HTTPException(status_code=400, detail="Invalid file path")


from app.models.photo import Photo
from app.models.person import Person, PhotoPerson
from app.models.tag import Tag, photo_tags
from app.services.photo_scanner import PhotoScanner
from app.services.face_recognition import FaceRecognitionService

router = APIRouter(prefix="/photos", tags=["photos"])


@router.get("/")
async def list_photos(
    page: int = Query(1, ge=1),
    per_page: int = Query(50, ge=1, le=200),
    person_id: Optional[int] = None,
    tag_id: Optional[int] = None,
    search: Optional[str] = None,
    db: Session = Depends(get_db)
):
    """List photos with pagination and filters."""
    query = db.query(Photo)

    if person_id:
        query = query.join(PhotoPerson).filter(PhotoPerson.person_id == person_id)

    if tag_id:
        query = query.join(photo_tags).filter(photo_tags.c.tag_id == tag_id)

    if search:
        query = query.filter(
            or_(
                Photo.file_name.ilike(f"%{search}%"),
                Photo.camera_make.ilike(f"%{search}%"),
                Photo.camera_model.ilike(f"%{search}%"),
            )
        )

    total = query.count()
    photos = query.order_by(Photo.taken_at.desc().nullslast()).offset(
        (page - 1) * per_page
    ).limit(per_page).all()

    return {
        "photos": [
            {
                "id": p.id,
                "file_path": p.file_path,
                "file_name": p.file_name,
                "width": p.width,
                "height": p.height,
                "taken_at": p.taken_at.isoformat() if p.taken_at else None,
                "camera_make": p.camera_make,
                "camera_model": p.camera_model,
                "gps_latitude": p.gps_latitude,
                "gps_longitude": p.gps_longitude,
                "thumbnail_url": f"/api/v1/photos/{p.id}/thumbnail" if p.thumbnail_path else None,
                "persons_count": len(p.persons),
                "tags": [{"id": tag.id, "name": tag.name} for tag in p.tags],
            }
            for p in photos
        ],
        "total": total,
        "page": page,
        "per_page": per_page,
        "total_pages": (total + per_page - 1) // per_page,
    }


@router.get("/{photo_id}")
async def get_photo(photo_id: int, db: Session = Depends(get_db)):
    """Get detailed photo information."""
    photo = db.query(Photo).get(photo_id)
    if not photo:
        raise HTTPException(status_code=404, detail="Photo not found")

    return {
        "id": photo.id,
        "file_path": photo.file_path,
        "file_name": photo.file_name,
        "file_hash": photo.file_hash,
        "width": photo.width,
        "height": photo.height,
        "taken_at": photo.taken_at.isoformat() if photo.taken_at else None,
        "camera_make": photo.camera_make,
        "camera_model": photo.camera_model,
        "gps_latitude": photo.gps_latitude,
        "gps_longitude": photo.gps_longitude,
        "thumbnail_path": photo.thumbnail_path,
        "phash": photo.phash,
        "is_processed": photo.is_processed,
        "processing_error": photo.processing_error,
        "persons": [
            {
                "id": pp.person.id,
                "name": pp.person.display_name or pp.person.name,
                "confidence": pp.confidence,
                "is_verified": pp.is_verified,
                "is_primary": pp.is_primary,
                "location": {
                    "top": pp.face_top,
                    "right": pp.face_right,
                    "bottom": pp.face_bottom,
                    "left": pp.face_left,
                }
            }
            for pp in photo.persons
        ],
        "tags": [
            {
                "id": tag.id,
                "name": tag.name,
                "display_name": tag.display_name,
                "color": tag.color,
            }
            for tag in photo.tags
        ],
    }


@router.get("/{photo_id}/image")
async def get_photo_image(photo_id: int, db: Session = Depends(get_db)):
    """Serve the original photo image."""
    from fastapi.responses import FileResponse
    photo = db.query(Photo).get(photo_id)
    if not photo:
        raise HTTPException(status_code=404, detail="Photo not found")

    file_path = settings.photos_path / photo.file_path
    validated_path = _validate_path_within_root(file_path, settings.photos_path)
    if not validated_path.exists():
        raise HTTPException(status_code=404, detail="Photo file not found")

    return FileResponse(validated_path)


@router.get("/{photo_id}/thumbnail")
async def get_photo_thumbnail(photo_id: int, db: Session = Depends(get_db)):
    """Serve photo thumbnail."""
    from fastapi.responses import FileResponse
    photo = db.query(Photo).get(photo_id)
    if not photo:
        raise HTTPException(status_code=404, detail="Photo not found")

    if photo.thumbnail_path:
        thumb_path = settings.data_path / photo.thumbnail_path
        validated_path = _validate_path_within_root(thumb_path, settings.data_path)
        if validated_path.exists():
            return FileResponse(validated_path)

    # Fallback to original image
    file_path = settings.photos_path / photo.file_path
    validated_path = _validate_path_within_root(file_path, settings.photos_path)
    if validated_path.exists():
        return FileResponse(validated_path)

    raise HTTPException(status_code=404, detail="Thumbnail not found")


@router.post("/scan")
async def scan_photos(force: bool = False, db: Session = Depends(get_db)):
    """Trigger photo directory scan."""
    scanner = PhotoScanner(db)
    stats = scanner.scan(force_rescan=force)
    return stats


@router.post("/{photo_id}/process-faces")
async def process_photo_faces(photo_id: int, db: Session = Depends(get_db)):
    """Process a single photo for face detection."""
    photo = db.query(Photo).get(photo_id)
    if not photo:
        raise HTTPException(status_code=404, detail="Photo not found")

    service = FaceRecognitionService(db)
    faces = service.process_photo(photo)

    results = []
    for face in faces:
        person = service.find_or_create_person(face["encoding"], photo, face["location"])
        db.flush()
        link = service.link_face_to_person(photo, person, face["location"], confidence=0.8)
        results.append({
            "person_id": person.id,
            "person_name": person.display_name or person.name,
            "location": face["location"],
        })

    photo.is_processed = True
    db.commit()

    return {"faces_found": len(results), "faces": results}


@router.post("/process-all-faces")
async def process_all_faces(batch_size: int = 50, db: Session = Depends(get_db)):
    """Process all unprocessed photos for faces."""
    service = FaceRecognitionService(db)
    stats = service.process_all_unprocessed(batch_size)
    return stats


@router.post("/{photo_id}/tags")
async def add_photo_tag(photo_id: int, tag_id: int, db: Session = Depends(get_db)):
    """Add a tag to a photo."""
    photo = db.query(Photo).get(photo_id)
    if not photo:
        raise HTTPException(status_code=404, detail="Photo not found")

    tag = db.query(Tag).get(tag_id)
    if not tag:
        raise HTTPException(status_code=404, detail="Tag not found")

    # Check if already tagged
    from sqlalchemy import select
    existing = db.execute(
        select(photo_tags).where(
            photo_tags.c.photo_id == photo_id,
            photo_tags.c.tag_id == tag_id
        )
    ).first()

    if not existing:
        db.execute(photo_tags.insert().values(photo_id=photo_id, tag_id=tag_id))
        tag.usage_count += 1
        db.commit()

    return {"success": True}


@router.delete("/{photo_id}/tags/{tag_id}")
async def remove_photo_tag(photo_id: int, tag_id: int, db: Session = Depends(get_db)):
    """Remove a tag from a photo."""
    from sqlalchemy import delete
    result = db.execute(
        delete(photo_tags).where(
            photo_tags.c.photo_id == photo_id,
            photo_tags.c.tag_id == tag_id
        )
    )
    if result.rowcount > 0:
        tag = db.query(Tag).get(tag_id)
        if tag:
            tag.usage_count = max(0, tag.usage_count - 1)
        db.commit()
    return {"success": True}