"""Tag API routes."""
from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session
from sqlalchemy import func
from typing import List, Optional

from app.core.database import get_db
from app.models.tag import Tag, photo_tags
from app.models.photo import Photo

router = APIRouter(prefix="/tags", tags=["tags"])


class TagCreatePayload(BaseModel):
    name: str = Field(min_length=1, max_length=255)
    display_name: Optional[str] = None
    description: Optional[str] = None
    color: Optional[str] = None
    icon: Optional[str] = None
    tag_type: Optional[str] = None
    parent_id: Optional[int] = None


class TagUpdatePayload(BaseModel):
    name: Optional[str] = Field(default=None, min_length=1, max_length=255)
    display_name: Optional[str] = None
    description: Optional[str] = None
    color: Optional[str] = None
    icon: Optional[str] = None
    tag_type: Optional[str] = None
    parent_id: Optional[int] = None


@router.get("/")
async def list_tags(
    page: int = Query(1, ge=1),
    per_page: int = Query(100, ge=1, le=500),
    tag_type: Optional[str] = None,
    parent_id: Optional[int] = None,
    search: Optional[str] = None,
    db: Session = Depends(get_db)
):
    """List all tags with pagination."""
    query = db.query(Tag)

    if tag_type:
        query = query.filter(Tag.tag_type == tag_type)
    if parent_id is not None:
        query = query.filter(Tag.parent_id == parent_id)
    if search:
        query = query.filter(Tag.name.ilike(f"%{search}%"))

    total = query.count()
    tags = query.order_by(Tag.usage_count.desc(), Tag.name).offset(
        (page - 1) * per_page
    ).limit(per_page).all()

    def get_tag_level(tag: Tag, db: Session) -> int:
        """Calculate the level/depth of a tag in the hierarchy."""
        level = 0
        current = tag
        while current.parent_id:
            level += 1
            current = db.query(Tag).get(current.parent_id)
            if not current:
                break
        return level

    return {
        "tags": [
            {
                "id": t.id,
                "name": t.name,
                "display_name": t.display_name or t.name,
                "description": t.description,
                "color": t.color,
                "icon": t.icon,
                "tag_type": t.tag_type,
                "parent_id": t.parent_id,
                "usage_count": t.usage_count,
                "is_auto": t.is_auto,
                "level": get_tag_level(t, db),
            }
            for t in tags
        ],
        "total": total,
        "page": page,
        "per_page": per_page,
        "total_pages": (total + per_page - 1) // per_page,
    }


@router.get("/tree")
async def get_tag_tree(db: Session = Depends(get_db)):
    """Get hierarchical tag tree."""
    tags = db.query(Tag).all()
    tag_map = {t.id: t for t in tags}

    # Build tree
    roots = []
    children_map = {}

    for tag in tags:
        if tag.parent_id:
            if tag.parent_id not in children_map:
                children_map[tag.parent_id] = []
            children_map[tag.parent_id].append(tag)
        else:
            roots.append(tag)

    def build_node(tag: Tag, level: int = 0) -> dict:
        children = children_map.get(tag.id, [])
        return {
            "id": tag.id,
            "name": tag.name,
            "display_name": tag.display_name or tag.name,
            "color": tag.color,
            "icon": tag.icon,
            "tag_type": tag.tag_type,
            "usage_count": tag.usage_count,
            "level": level,
            "children": [build_node(c, level + 1) for c in children],
        }

    return {"tags": [build_node(r) for r in roots]}


@router.get("/{tag_id}")
async def get_tag(tag_id: int, db: Session = Depends(get_db)):
    """Get tag details."""
    tag = db.query(Tag).get(tag_id)
    if not tag:
        raise HTTPException(status_code=404, detail="Tag not found")

    return {
        "id": tag.id,
        "name": tag.name,
        "display_name": tag.display_name or tag.name,
        "description": tag.description,
        "color": tag.color,
        "icon": tag.icon,
        "tag_type": tag.tag_type,
        "parent_id": tag.parent_id,
        "usage_count": tag.usage_count,
        "is_auto": tag.is_auto,
    }


@router.post("/")
async def create_tag(payload: TagCreatePayload, db: Session = Depends(get_db)):
    """Create a tag from the frontend JSON payload."""
    name = payload.name.strip()
    existing = db.query(Tag).filter(Tag.name == name).first()
    if existing:
        raise HTTPException(status_code=400, detail="Tag with this name already exists")

    if payload.parent_id is not None and not db.get(Tag, payload.parent_id):
        raise HTTPException(status_code=404, detail="Parent tag not found")

    tag = Tag(
        name=name,
        display_name=payload.display_name,
        description=payload.description,
        color=payload.color or "#3B82F6",
        icon=payload.icon,
        tag_type=payload.tag_type,
        parent_id=payload.parent_id,
    )
    db.add(tag)
    db.commit()
    db.refresh(tag)

    return {
        "id": tag.id,
        "name": tag.name,
        "display_name": tag.display_name or tag.name,
    }


@router.put("/{tag_id}")
async def update_tag(
    tag_id: int,
    payload: TagUpdatePayload,
    db: Session = Depends(get_db)
):
    """Update a tag from the frontend JSON payload."""
    tag = db.get(Tag, tag_id)
    if not tag:
        raise HTTPException(status_code=404, detail="Tag not found")

    changes = payload.model_dump(exclude_unset=True)
    if "name" in changes and changes["name"] is not None:
        name = changes["name"].strip()
        existing = db.query(Tag).filter(Tag.name == name, Tag.id != tag_id).first()
        if existing:
            raise HTTPException(status_code=400, detail="Tag with this name already exists")
        tag.name = name

    if "parent_id" in changes:
        parent_id = changes["parent_id"]
        if parent_id == tag_id:
            raise HTTPException(status_code=400, detail="Cannot set parent to self")
        if parent_id is not None:
            parent = db.get(Tag, parent_id)
            if not parent:
                raise HTTPException(status_code=404, detail="Parent tag not found")
            current = parent
            while current is not None:
                if current.id == tag_id:
                    raise HTTPException(status_code=400, detail="Cannot create a tag hierarchy cycle")
                current = db.get(Tag, current.parent_id) if current.parent_id is not None else None
        tag.parent_id = parent_id

    for field in ("display_name", "description", "color", "icon", "tag_type"):
        if field in changes:
            setattr(tag, field, changes[field])

    db.commit()
    db.refresh(tag)

    return {
        "id": tag.id,
        "name": tag.name,
        "display_name": tag.display_name or tag.name,
    }


@router.delete("/{tag_id}")
async def delete_tag(tag_id: int, db: Session = Depends(get_db)):
    """Delete a tag."""
    tag = db.query(Tag).get(tag_id)
    if not tag:
        raise HTTPException(status_code=404, detail="Tag not found")

    db.delete(tag)
    db.commit()

    return {"success": True}


@router.get("/{tag_id}/photos")
async def get_tag_photos(
    tag_id: int,
    page: int = Query(1, ge=1),
    per_page: int = Query(50, ge=1, le=200),
    db: Session = Depends(get_db)
):
    """Get all photos with a specific tag."""
    tag = db.query(Tag).get(tag_id)
    if not tag:
        raise HTTPException(status_code=404, detail="Tag not found")

    from sqlalchemy import select
    query = db.query(Photo).join(photo_tags).filter(photo_tags.c.tag_id == tag_id)
    total = query.count()
    photos = query.order_by(Photo.taken_at.desc().nullslast()).offset(
        (page - 1) * per_page
    ).limit(per_page).all()

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