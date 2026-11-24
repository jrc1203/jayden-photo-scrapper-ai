"""Person API routes."""
from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import func, or_
from typing import List, Optional

from app.core.database import get_db
from app.models.person import Person, PhotoPerson
from app.models.photo import Photo
from app.services.face_recognition import FaceRecognitionService
from app.services.relationship_service import RelationshipService


class PersonCreatePayload(BaseModel):
    name: str = Field(min_length=1, max_length=255)
    display_name: Optional[str] = None
    birth_date: Optional[str] = None
    notes: Optional[str] = None


class PersonUpdatePayload(BaseModel):
    name: Optional[str] = None
    display_name: Optional[str] = None
    birth_date: Optional[str] = None
    notes: Optional[str] = None


router = APIRouter(prefix="/persons", tags=["persons"])


@router.get("/")
async def list_persons(
    page: int = Query(1, ge=1),
    per_page: int = Query(50, ge=1, le=200),
    search: Optional[str] = None,
    only_with_photos: bool = True,
    db: Session = Depends(get_db)
):
    """List all persons with pagination."""
    query = db.query(Person)

    if search:
        query = query.filter(
            or_(
                Person.name.ilike(f"%{search}%"),
                Person.display_name.ilike(f"%{search}%"),
            )
        )

    if only_with_photos:
        query = query.join(PhotoPerson).group_by(Person.id).having(func.count(PhotoPerson.id) > 0)

    total = query.count()
    persons = query.order_by(Person.name).offset(
        (page - 1) * per_page
    ).limit(per_page).all()

    return {
        "persons": [
            {
                "id": p.id,
                "name": p.name,
                "display_name": p.display_name or p.name,
                "reference_photo_id": p.reference_photo_id,
                "photo_count": len(p.photo_links),
                "is_manual": p.is_manual,
                "created_at": p.created_at.isoformat() if p.created_at else None,
            }
            for p in persons
        ],
        "total": total,
        "page": page,
        "per_page": per_page,
        "total_pages": (total + per_page - 1) // per_page,
    }


@router.get("/{person_id}")
async def get_person(person_id: int, db: Session = Depends(get_db)):
    """Get detailed person information."""
    person = db.query(Person).options(joinedload(Person.photo_links).joinedload(PhotoPerson.photo)).filter(Person.id == person_id).first()
    if not person:
        raise HTTPException(status_code=404, detail="Person not found")

    # Get photos - photo_links are already loaded via joinedload
    photo_links = person.photo_links
    photos = [pl.photo for pl in photo_links]

    # Get relationships
    rel_service = RelationshipService(db)
    relationships = rel_service.get_relationships(person_id)

    return {
        "id": person.id,
        "name": person.name,
        "display_name": person.display_name or person.name,
        "reference_photo_id": person.reference_photo_id,
        "birth_date": person.birth_date.isoformat() if person.birth_date else None,
        "notes": person.notes,
        "is_manual": person.is_manual,
        "confidence_threshold": person.confidence_threshold,
        "photo_count": len(photos),
        "photos": (lambda pl_map: [
            {
                "id": photo.id,
                "file_name": photo.file_name,
                "taken_at": photo.taken_at.isoformat() if photo.taken_at else None,
                "thumbnail_url": f"/api/v1/photos/{photo.id}/thumbnail",
                "confidence": pl_map[photo.id].confidence if photo.id in pl_map else 1.0,
                "is_verified": pl_map[photo.id].is_verified if photo.id in pl_map else False,
                "location": {
                    "top": pl_map[photo.id].face_top,
                    "right": pl_map[photo.id].face_right,
                    "bottom": pl_map[photo.id].face_bottom,
                    "left": pl_map[photo.id].face_left,
                } if photo.id in pl_map else None,
            }
            for photo in photos
        ])({pl.photo_id: pl for pl in photo_links}),
        "relationships": [
            {
                "id": r.id,
                "type": r.relationship_type.value,
                "custom_type": r.custom_type,
                "related_person": {
                    "id": r.related_person.id,
                    "name": r.related_person.display_name or r.related_person.name,
                },
                "confidence": r.confidence,
                "is_verified": r.is_verified,
                "is_current": r.is_current,
                "description": r.description,
            }
            for r in relationships
        ],
    }


@router.post("/")
async def create_person(
    payload: PersonCreatePayload,
    db: Session = Depends(get_db)
):
    """Manually create a person from the frontend JSON payload."""
    from datetime import datetime

    person = Person(
        name=payload.name.strip(),
        display_name=payload.display_name,
        birth_date=datetime.fromisoformat(payload.birth_date) if payload.birth_date else None,
        notes=payload.notes,
        is_manual=True,
    )
    db.add(person)
    db.commit()
    db.refresh(person)

    return {
        "id": person.id,
        "name": person.name,
        "display_name": person.display_name or person.name,
    }


@router.put("/{person_id}")
async def update_person(
    person_id: int,
    payload: PersonUpdatePayload,
    db: Session = Depends(get_db)
):
    """Update person information from the JSON payload used by the frontend."""
    from datetime import datetime

    person = db.get(Person, person_id)
    if not person:
        raise HTTPException(status_code=404, detail="Person not found")

    changes = payload.model_dump(exclude_unset=True)
    if "name" in changes and changes["name"] is not None:
        person.name = changes["name"]
    if "display_name" in changes:
        person.display_name = changes["display_name"]
    if "birth_date" in changes:
        value = changes["birth_date"]
        person.birth_date = datetime.fromisoformat(value) if value else None
    if "notes" in changes:
        person.notes = changes["notes"]

    db.commit()
    db.refresh(person)

    return {
        "id": person.id,
        "name": person.name,
        "display_name": person.display_name or person.name,
    }


@router.delete("/{person_id}")
async def delete_person(person_id: int, db: Session = Depends(get_db)):
    """Delete a person and all their face links."""
    person = db.query(Person).get(person_id)
    if not person:
        raise HTTPException(status_code=404, detail="Person not found")

    db.delete(person)
    db.commit()

    return {"success": True}


@router.post("/{person_id}/merge/{other_person_id}")
async def merge_persons(person_id: int, other_person_id: int, db: Session = Depends(get_db)):
    """Merge two persons (keep person_id, merge other_person_id into it)."""
    service = FaceRecognitionService(db)
    try:
        merged = service.merge_persons(person_id, other_person_id)
        return {
            "success": True,
            "merged_person_id": merged.id,
        }
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/{person_id}/photos")
async def get_person_photos(
    person_id: int,
    page: int = Query(1, ge=1),
    per_page: int = Query(50, ge=1, le=200),
    db: Session = Depends(get_db)
):
    """Get all photos for a person."""
    person = db.query(Person).get(person_id)
    if not person:
        raise HTTPException(status_code=404, detail="Person not found")

    service = FaceRecognitionService(db)
    photos = service.get_person_photos(person_id, limit=per_page, offset=(page - 1) * per_page)

    total = len(person.photo_links)

    return {
        "photos": [
            {
                "id": p.id,
                "file_name": p.file_name,
                "taken_at": p.taken_at.isoformat() if p.taken_at else None,
                "thumbnail_url": f"/api/v1/photos/{p.id}/thumbnail",
            }
            for p in photos
        ],
        "total": total,
        "page": page,
        "per_page": per_page,
        "total_pages": (total + per_page - 1) // per_page,
    }


@router.post("/{person_id}/verify-face/{photo_id}")
async def verify_face(person_id: int, photo_id: int, verified: bool = True, db: Session = Depends(get_db)):
    """Verify or unverify a face match."""
    from app.models.person import PhotoPerson

    link = db.query(PhotoPerson).filter(
        PhotoPerson.person_id == person_id,
        PhotoPerson.photo_id == photo_id
    ).first()

    if not link:
        raise HTTPException(status_code=404, detail="Face link not found")

    link.is_verified = verified
    db.commit()

    return {"success": True, "is_verified": link.is_verified}


@router.get("/{person_id}/suggestions")
async def get_relationship_suggestions(person_id: int, limit: int = 10, db: Session = Depends(get_db)):
    """Get suggested relationships for a person."""
    service = RelationshipService(db)
    suggestions = service.suggest_relationships(person_id, limit)
    return {"suggestions": suggestions}