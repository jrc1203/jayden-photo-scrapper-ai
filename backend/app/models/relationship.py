"""Relationship model - represents connections between people (mind map)."""
from sqlalchemy import Column, Integer, String, DateTime, Float, ForeignKey, Text, Enum as SQLEnum, Index, Boolean
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from datetime import datetime
from enum import Enum
from typing import Optional

from app.core.database import Base


class RelationshipType(str, Enum):
    """Types of relationships between people."""
    # Family
    SPOUSE = "spouse"
    PARTNER = "partner"
    PARENT = "parent"
    CHILD = "child"
    SIBLING = "sibling"
    GRANDPARENT = "grandparent"
    GRANDCHILD = "grandchild"
    UNCLE_AUNT = "uncle_aunt"
    NIECE_NEPHEW = "niece_nephew"
    COUSIN = "cousin"
    IN_LAW = "in_law"

    # Social
    FRIEND = "friend"
    CLOSE_FRIEND = "close_friend"
    ACQUAINTANCE = "acquaintance"
    COLLEAGUE = "colleague"
    CLASSMATE = "classmate"
    NEIGHBOR = "neighbor"

    # Professional
    MANAGER = "manager"
    REPORTS_TO = "reports_to"
    MENTOR = "mentor"
    MENTEE = "mentee"
    BUSINESS_PARTNER = "business_partner"

    # Custom
    CUSTOM = "custom"


class Relationship(Base):
    """Relationship model - directed edge between two people."""
    __tablename__ = "relationships"

    id = Column(Integer, primary_key=True, index=True)

    # People involved
    person_id = Column(Integer, ForeignKey("persons.id", ondelete="CASCADE"), nullable=False, index=True)
    related_person_id = Column(Integer, ForeignKey("persons.id", ondelete="CASCADE"), nullable=False, index=True)

    # Relationship details
    relationship_type = Column(SQLEnum(RelationshipType), nullable=False, index=True)
    custom_type = Column(String(100))  # For CUSTOM type

    # Metadata
    description = Column(Text)
    confidence = Column(Float, default=1.0)  # How sure we are
    is_verified = Column(Boolean, default=False)  # User confirmed
    is_bidirectional = Column(Boolean, default=True)  # If true, inverse also exists

    # Temporal
    start_date = Column(DateTime)  # When relationship started
    end_date = Column(DateTime)  # When relationship ended (if applicable)
    is_current = Column(Boolean, default=True)

    # Source
    source = Column(String(50), default="manual")  # "manual", "inferred", "imported"
    inferred_from_photo_count = Column(Integer, default=0)  # If inferred, how many photos

    # Timestamps
    created_at = Column(DateTime, default=func.now(), nullable=False)
    updated_at = Column(DateTime, default=func.now(), onupdate=func.now(), nullable=False)
    created_by = Column(String(100))  # User who created this

    # Relationships
    person = relationship("Person", foreign_keys=[person_id], back_populates="relationships_from")
    related_person = relationship("Person", foreign_keys=[related_person_id], back_populates="relationships_to")

    # Constraints
    __table_args__ = (
        Index("ix_relationship_unique", "person_id", "related_person_id", "relationship_type", unique=True),
        Index("ix_relationship_bidirectional", "related_person_id", "person_id"),
    )

    def __repr__(self):
        return f"<Relationship({self.person_id} --{self.relationship_type}--> {self.related_person_id})>"

    @property
    def inverse_type(self) -> "RelationshipType":
        """Get the inverse relationship type."""
        inverses = {
            RelationshipType.SPOUSE: RelationshipType.SPOUSE,
            RelationshipType.PARTNER: RelationshipType.PARTNER,
            RelationshipType.PARENT: RelationshipType.CHILD,
            RelationshipType.CHILD: RelationshipType.PARENT,
            RelationshipType.SIBLING: RelationshipType.SIBLING,
            RelationshipType.GRANDPARENT: RelationshipType.GRANDCHILD,
            RelationshipType.GRANDCHILD: RelationshipType.GRANDPARENT,
            RelationshipType.UNCLE_AUNT: RelationshipType.NIECE_NEPHEW,
            RelationshipType.NIECE_NEPHEW: RelationshipType.UNCLE_AUNT,
            RelationshipType.COUSIN: RelationshipType.COUSIN,
            RelationshipType.IN_LAW: RelationshipType.IN_LAW,
            RelationshipType.FRIEND: RelationshipType.FRIEND,
            RelationshipType.CLOSE_FRIEND: RelationshipType.CLOSE_FRIEND,
            RelationshipType.ACQUAINTANCE: RelationshipType.ACQUAINTANCE,
            RelationshipType.COLLEAGUE: RelationshipType.COLLEAGUE,
            RelationshipType.CLASSMATE: RelationshipType.CLASSMATE,
            RelationshipType.NEIGHBOR: RelationshipType.NEIGHBOR,
            RelationshipType.MANAGER: RelationshipType.REPORTS_TO,
            RelationshipType.REPORTS_TO: RelationshipType.MANAGER,
            RelationshipType.MENTOR: RelationshipType.MENTEE,
            RelationshipType.MENTEE: RelationshipType.MENTOR,
            RelationshipType.BUSINESS_PARTNER: RelationshipType.BUSINESS_PARTNER,
        }
        return inverses.get(self.relationship_type, RelationshipType.CUSTOM)