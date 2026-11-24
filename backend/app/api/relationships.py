"""Relationship API routes."""
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import List, Optional
from pydantic import BaseModel, Field

from app.core.database import get_db
from app.models.person import Person
from app.models.relationship import Relationship, RelationshipType
from app.services.relationship_service import RelationshipService

router = APIRouter(prefix="/relationships", tags=["relationships"])


class RelationshipCreatePayload(BaseModel):
    person_id: int = Field(gt=0)
    related_person_id: int = Field(gt=0)
    relationship_type: RelationshipType
    custom_type: Optional[str] = None
    description: Optional[str] = None
    confidence: float = Field(default=1.0, ge=0.0, le=1.0)
    is_verified: bool = False
    is_bidirectional: bool = True
    start_date: Optional[str] = None
    end_date: Optional[str] = None
    is_current: bool = True


class RelationshipUpdatePayload(BaseModel):
    relationship_type: Optional[RelationshipType] = None
    custom_type: Optional[str] = None
    description: Optional[str] = None
    confidence: Optional[float] = Field(default=None, ge=0.0, le=1.0)
    is_verified: Optional[bool] = None
    is_current: Optional[bool] = None
    start_date: Optional[str] = None
    end_date: Optional[str] = None


def serialize_relationship(relationship: Relationship) -> dict:
    return {
        "id": relationship.id,
        "person_id": relationship.person_id,
        "person_name": relationship.person.display_name or relationship.person.name,
        "related_person_id": relationship.related_person_id,
        "related_person_name": relationship.related_person.display_name or relationship.related_person.name,
        "type": relationship.relationship_type.value,
        "custom_type": relationship.custom_type,
        "confidence": relationship.confidence,
        "is_verified": relationship.is_verified,
        "is_bidirectional": relationship.is_bidirectional,
        "is_current": relationship.is_current,
        "description": relationship.description,
        "source": relationship.source,
        "inferred_from_photo_count": relationship.inferred_from_photo_count,
        "start_date": relationship.start_date.isoformat() if relationship.start_date else None,
        "end_date": relationship.end_date.isoformat() if relationship.end_date else None,
    }


@router.get("/")
async def list_relationships(
    person_id: Optional[int] = None,
    relationship_type: Optional[RelationshipType] = None,
    only_verified: bool = False,
    only_current: bool = True,
    db: Session = Depends(get_db)
):
    """List relationships with filters."""
    service = RelationshipService(db)

    if person_id:
        relationships = service.get_relationships(
            person_id,
            relationship_type=relationship_type,
            only_verified=only_verified,
            only_current=only_current
        )
    else:
        query = db.query(Relationship)
        if relationship_type:
            query = query.filter(Relationship.relationship_type == relationship_type)
        if only_verified:
            query = query.filter(Relationship.is_verified == True)
        if only_current:
            query = query.filter(Relationship.is_current == True)
        relationships = query.all()

    return {
        "relationships": [
            {
                "id": r.id,
                "person_id": r.person_id,
                "person_name": r.person.display_name or r.person.name,
                "related_person_id": r.related_person_id,
                "related_person_name": r.related_person.display_name or r.related_person.name,
                "type": r.relationship_type.value,
                "custom_type": r.custom_type,
                "confidence": r.confidence,
                "is_verified": r.is_verified,
                "is_bidirectional": r.is_bidirectional,
                "is_current": r.is_current,
                "description": r.description,
                "source": r.source,
                "inferred_from_photo_count": r.inferred_from_photo_count,
                "start_date": r.start_date.isoformat() if r.start_date else None,
                "end_date": r.end_date.isoformat() if r.end_date else None,
            }
            for r in relationships
        ]
    }


@router.post("/")
async def create_relationship(
    payload: RelationshipCreatePayload,
    db: Session = Depends(get_db)
):
    """Create a relationship from the frontend JSON payload."""
    from datetime import datetime

    person = db.get(Person, payload.person_id)
    related_person = db.get(Person, payload.related_person_id)
    if not person or not related_person:
        raise HTTPException(status_code=404, detail="Person not found")
    if payload.person_id == payload.related_person_id:
        raise HTTPException(status_code=400, detail="Cannot create relationship with self")

    service = RelationshipService(db)
    relationship = service.create_relationship(
        person_id=payload.person_id,
        related_person_id=payload.related_person_id,
        relationship_type=payload.relationship_type,
        custom_type=payload.custom_type,
        description=payload.description,
        confidence=payload.confidence,
        is_verified=payload.is_verified,
        is_bidirectional=payload.is_bidirectional,
        start_date=datetime.fromisoformat(payload.start_date) if payload.start_date else None,
        end_date=datetime.fromisoformat(payload.end_date) if payload.end_date else None,
        is_current=payload.is_current,
        source="manual",
        created_by="user",
    )
    db.refresh(relationship)
    return serialize_relationship(relationship)


@router.put("/{relationship_id}")
async def update_relationship(
    relationship_id: int,
    payload: RelationshipUpdatePayload,
    db: Session = Depends(get_db)
):
    """Update a relationship from the frontend JSON payload."""
    from datetime import datetime

    relationship = db.get(Relationship, relationship_id)
    if not relationship:
        raise HTTPException(status_code=404, detail="Relationship not found")

    changes = payload.model_dump(exclude_unset=True)
    for field in ("relationship_type", "custom_type", "description", "confidence", "is_verified", "is_current"):
        if field in changes:
            value = changes[field]
            if field == "relationship_type" and value is not None:
                relationship.relationship_type = value
            elif field != "relationship_type":
                setattr(relationship, field, value)

    for field in ("start_date", "end_date"):
        if field in changes:
            value = changes[field]
            setattr(relationship, field, datetime.fromisoformat(value) if value else None)

    db.commit()
    db.refresh(relationship)
    return serialize_relationship(relationship)


@router.delete("/{relationship_id}")
async def delete_relationship(relationship_id: int, db: Session = Depends(get_db)):
    """Delete a relationship."""
    relationship = db.query(Relationship).get(relationship_id)
    if not relationship:
        raise HTTPException(status_code=404, detail="Relationship not found")

    db.delete(relationship)
    db.commit()

    return {"success": True}


@router.get("/mind-map")
async def get_mind_map(
    person_id: Optional[int] = None,
    depth: int = Query(2, ge=1, le=5),
    db: Session = Depends(get_db)
):
    """Get mind map data for visualization."""
    service = RelationshipService(db)
    data = service.get_mind_map_data(person_id, depth)
    return data


@router.get("/statistics")
async def get_statistics(db: Session = Depends(get_db)):
    """Get relationship graph statistics."""
    service = RelationshipService(db)
    stats = service.get_statistics()
    return stats


@router.post("/infer")
async def infer_relationships(
    min_cooccurrence: int = 3,
    min_confidence: float = 0.7,
    db: Session = Depends(get_db)
):
    """Infer relationships from photo co-occurrence."""
    service = RelationshipService(db)
    relationships = service.infer_relationships_from_photos(min_cooccurrence, min_confidence)
    return {
        "created": len(relationships),
        "relationships": [
            {
                "id": r.id,
                "person_id": r.person_id,
                "related_person_id": r.related_person_id,
                "type": r.relationship_type.value,
                "confidence": r.confidence,
            }
            for r in relationships
        ]
    }


@router.get("/path/{person1_id}/{person2_id}")
async def get_shortest_path(person1_id: int, person2_id: int, db: Session = Depends(get_db)):
    """Find shortest relationship path between two people."""
    service = RelationshipService(db)
    path = service.get_shortest_path(person1_id, person2_id)

    if not path:
        return {"path": [], "found": False}

    # Get person details for path
    persons = db.query(Person).filter(Person.id.in_(path)).all()
    person_map = {p.id: p for p in persons}

    return {
        "path": [
            {
                "person_id": pid,
                "name": person_map[pid].display_name or person_map[pid].name if pid in person_map else f"Person {pid}",
            }
            for pid in path
        ],
        "found": True,
        "distance": len(path) - 1,
    }


@router.get("/components")
async def get_connected_components(db: Session = Depends(get_db)):
    """Get connected components in relationship graph."""
    service = RelationshipService(db)
    components = service.get_connected_components()

    # Get person details
    all_ids = [pid for comp in components for pid in comp]
    persons = db.query(Person).filter(Person.id.in_(all_ids)).all()
    person_map = {p.id: p for p in persons}

    return {
        "components": [
            [
                {
                    "person_id": pid,
                    "name": person_map[pid].display_name or person_map[pid].name if pid in person_map else f"Person {pid}",
                }
                for pid in component
            ]
            for component in components
        ]
    }


@router.get("/types")
async def get_relationship_types():
    """Get all available relationship types."""
    return {
        "types": [
            {"value": t.value, "label": t.value.replace("_", " ").title()}
            for t in RelationshipType
        ]
    }