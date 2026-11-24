"""Person model - represents a person identified in photos."""
from sqlalchemy import Column, Integer, String, DateTime, Float, ForeignKey, Text, Boolean, JSON, Index
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from datetime import datetime
from typing import Optional, List

from app.core.database import Base


class Person(Base):
    """Person model - a unique person identified across photos."""
    __tablename__ = "persons"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(255), nullable=False, index=True)
    display_name = Column(String(255))  # User-friendly name (can be different from name)

    # Face recognition
    face_embedding = Column(JSON)  # Store face encoding as JSON array
    face_embedding_model = Column(String(100))  # Which model generated the embedding
    reference_photo_id = Column(Integer, ForeignKey("photos.id"))  # Best reference photo

    # Metadata
    birth_date = Column(DateTime)
    notes = Column(Text)
    is_manual = Column(Boolean, default=False)  # Manually created vs auto-detected
    confidence_threshold = Column(Float, default=0.6)

    # Timestamps
    created_at = Column(DateTime, default=func.now(), nullable=False)
    updated_at = Column(DateTime, default=func.now(), onupdate=func.now(), nullable=False)

    # Relationships
    photo_links = relationship("PhotoPerson", back_populates="person", cascade="all, delete-orphan")
    relationships_from = relationship("Relationship", foreign_keys="Relationship.person_id", back_populates="person")
    relationships_to = relationship("Relationship", foreign_keys="Relationship.related_person_id", back_populates="related_person")

    def __repr__(self):
        return f"<Person(id={self.id}, name='{self.name}')>"


class PhotoPerson(Base):
    """Association table linking photos to persons with face locations."""
    __tablename__ = "photo_persons"

    id = Column(Integer, primary_key=True, index=True)
    photo_id = Column(Integer, ForeignKey("photos.id", ondelete="CASCADE"), nullable=False, index=True)
    person_id = Column(Integer, ForeignKey("persons.id", ondelete="CASCADE"), nullable=False, index=True)

    # Face location in photo (normalized 0-1)
    face_top = Column(Float)
    face_right = Column(Float)
    face_bottom = Column(Float)
    face_left = Column(Float)

    # Confidence
    confidence = Column(Float, default=1.0)
    is_verified = Column(Boolean, default=False)  # User confirmed this match
    is_primary = Column(Boolean, default=False)  # Primary face in this photo

    # Source
    detection_method = Column(String(50))  # "auto", "manual", "imported"

    # Timestamps
    created_at = Column(DateTime, default=func.now(), nullable=False)

    # Relationships
    photo = relationship("Photo", back_populates="persons")
    person = relationship("Person", back_populates="photo_links")

    # Unique constraint - one person per face location per photo
    __table_args__ = (
        Index("ix_photo_person_unique", "photo_id", "person_id", "face_top", "face_left", unique=True),
    )

    def __repr__(self):
        return f"<PhotoPerson(photo_id={self.photo_id}, person_id={self.person_id})>"