"""Tag models for flexible photo categorization."""
from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, Text, Index, Boolean, Table, Float
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from datetime import datetime

from app.core.database import Base


# Association table for photo-tag many-to-many
photo_tags = Table(
    "photo_tags",
    Base.metadata,
    Column("photo_id", Integer, ForeignKey("photos.id", ondelete="CASCADE"), primary_key=True),
    Column("tag_id", Integer, ForeignKey("tags.id", ondelete="CASCADE"), primary_key=True),
    Column("created_at", DateTime, default=func.now()),
    Column("confidence", Float, default=1.0),
    Column("source", String(50), default="manual"),
)


class Tag(Base):
    """Tag model for categorizing photos (events, locations, occasions, etc.)."""
    __tablename__ = "tags"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(255), unique=True, nullable=False, index=True)
    display_name = Column(String(255))
    description = Column(Text)
    color = Column(String(7))  # Hex color for UI
    icon = Column(String(100))  # Icon identifier

    # Hierarchy
    parent_id = Column(Integer, ForeignKey("tags.id"), index=True)
    tag_type = Column(String(50), index=True)  # "event", "location", "occasion", "activity", "custom"

    # Metadata
    is_auto = Column(Boolean, default=False)  # Auto-generated vs manual
    usage_count = Column(Integer, default=0)

    # Timestamps
    created_at = Column(DateTime, default=func.now(), nullable=False)
    updated_at = Column(DateTime, default=func.now(), onupdate=func.now(), nullable=False)

    # Relationships
    photos = relationship("Photo", secondary=photo_tags, back_populates="tags")
    children = relationship("Tag", backref="parent", remote_side=[id])

    def __repr__(self):
        return f"<Tag(id={self.id}, name='{self.name}')>"