"""Photo model - represents a photo file in the gallery."""
from sqlalchemy import Column, Integer, String, DateTime, Float, ForeignKey, Index, Text, Boolean, UniqueConstraint
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from datetime import datetime
from typing import Optional

from app.core.database import Base


class Photo(Base):
    """Photo model - references a single photo file without duplicating it."""
    __tablename__ = "photos"

    id = Column(Integer, primary_key=True, index=True)
    file_path = Column(String(500), unique=True, nullable=False, index=True)  # Relative to photos root
    file_name = Column(String(255), nullable=False)
    file_hash = Column(String(64), nullable=False, index=True)  # SHA256 for deduplication

    # EXIF/Metadata
    width = Column(Integer)
    height = Column(Integer)
    taken_at = Column(DateTime, index=True)  # From EXIF DateTimeOriginal
    camera_make = Column(String(100))
    camera_model = Column(String(100))
    gps_latitude = Column(Float)
    gps_longitude = Column(Float)

    # Processing
    thumbnail_path = Column(String(500))  # Generated thumbnail path
    phash = Column(String(64), index=True)  # Perceptual hash for similarity

    # Status
    is_processed = Column(Boolean, default=False)
    processing_error = Column(Text)

    # Timestamps
    created_at = Column(DateTime, default=func.now(), nullable=False)
    updated_at = Column(DateTime, default=func.now(), onupdate=func.now(), nullable=False)
    scanned_at = Column(DateTime, default=func.now(), nullable=False)

    # Relationships
    persons = relationship("PhotoPerson", back_populates="photo", cascade="all, delete-orphan")
    tags = relationship("Tag", secondary="photo_tags", back_populates="photos")

    # Indexes
    __table_args__ = (
        Index("ix_photos_taken_at_file_hash", "taken_at", "file_hash"),
        Index("ix_photos_gps", "gps_latitude", "gps_longitude"),
        UniqueConstraint("file_hash", name="uq_photos_file_hash"),
    )

    def __repr__(self):
        return f"<Photo(id={self.id}, file_name='{self.file_name}')>"