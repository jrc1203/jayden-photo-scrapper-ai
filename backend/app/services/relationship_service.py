"""Relationship service - builds and manages the mind map of people connections."""
import networkx as nx
from typing import List, Dict, Optional, Set, Tuple
from sqlalchemy.orm import Session
from sqlalchemy import func, and_, or_
from collections import Counter

from app.core.config import settings
from app.models.person import Person
from app.models.photo import Photo
from app.models.person import PhotoPerson
from app.models.relationship import Relationship, RelationshipType
from app.core.database import SessionLocal


class RelationshipService:
    """Manages relationships between people and builds the mind map."""

    def __init__(self, db: Session = None):
        self.db = db or SessionLocal()

    def create_relationship(self, person_id: int, related_person_id: int,
                           relationship_type: RelationshipType,
                           custom_type: str = None,
                           description: str = None,
                           confidence: float = 1.0,
                           is_verified: bool = False,
                           is_bidirectional: bool = True,
                           start_date=None,
                           end_date=None,
                           is_current: bool = True,
                           source: str = "manual",
                           created_by: str = "user") -> Relationship:
        """Create a new relationship between two people."""
        # Check if relationship already exists
        existing = self.db.query(Relationship).filter(
            Relationship.person_id == person_id,
            Relationship.related_person_id == related_person_id,
            Relationship.relationship_type == relationship_type
        ).first()

        if existing:
            return existing

        relationship = Relationship(
            person_id=person_id,
            related_person_id=related_person_id,
            relationship_type=relationship_type,
            custom_type=custom_type,
            description=description,
            confidence=confidence,
            is_verified=is_verified,
            is_bidirectional=is_bidirectional,
            start_date=start_date,
            end_date=end_date,
            is_current=is_current,
            source=source,
            created_by=created_by,
        )
        self.db.add(relationship)

        # Create inverse relationship if bidirectional
        if is_bidirectional:
            inverse_type = relationship.inverse_type
            inverse = Relationship(
                person_id=related_person_id,
                related_person_id=person_id,
                relationship_type=inverse_type,
                custom_type=custom_type,
                description=description,
                confidence=confidence,
                is_verified=is_verified,
                is_bidirectional=is_bidirectional,
                start_date=start_date,
                end_date=end_date,
                is_current=is_current,
                source=source,
                created_by=created_by,
            )
            self.db.add(inverse)

        self.db.commit()
        return relationship

    def get_relationships(self, person_id: int,
                         relationship_type: RelationshipType = None,
                         only_verified: bool = False,
                         only_current: bool = True) -> List[Relationship]:
        """Get all relationships for a person."""
        query = self.db.query(Relationship).filter(Relationship.person_id == person_id)

        if relationship_type:
            query = query.filter(Relationship.relationship_type == relationship_type)
        if only_verified:
            query = query.filter(Relationship.is_verified == True)
        if only_current:
            query = query.filter(Relationship.is_current == True)

        return query.all()

    def get_relationship_graph(self, person_id: int = None,
                              depth: int = 2) -> nx.Graph:
        """
        Build a NetworkX graph of relationships.
        If person_id is provided, center the graph on that person.
        """
        G = nx.Graph()

        # Get all relationships
        relationships = self.db.query(Relationship).filter(
            Relationship.is_current == True
        ).all()

        # Add nodes (people)
        persons = self.db.query(Person).all()
        for person in persons:
            G.add_node(person.id, label=person.display_name or person.name,
                      name=person.name, reference_photo_id=person.reference_photo_id)

        # Add edges (relationships)
        for rel in relationships:
            if rel.is_current:
                G.add_edge(
                    rel.person_id,
                    rel.related_person_id,
                    type=rel.relationship_type.value,
                    confidence=rel.confidence,
                    verified=rel.is_verified,
                    description=rel.description,
                )

        # If person_id specified, extract subgraph
        if person_id and person_id in G:
            # Get nodes within depth
            nodes_to_keep = {person_id}
            current_layer = {person_id}

            for _ in range(depth):
                next_layer = set()
                for node in current_layer:
                    neighbors = set(G.neighbors(node))
                    next_layer.update(neighbors)
                nodes_to_keep.update(next_layer)
                current_layer = next_layer

            G = G.subgraph(nodes_to_keep).copy()

        return G

    def infer_relationships_from_photos(self, min_cooccurrence: int = 3,
                                       min_confidence: float = 0.7) -> List[Relationship]:
        """
        Infer relationships based on photo co-occurrence.
        People who appear together frequently are likely related.
        """
        # Get all photos with multiple people
        photo_person_counts = self.db.query(
            PhotoPerson.photo_id,
            func.count(PhotoPerson.person_id).label('person_count')
        ).group_by(PhotoPerson.photo_id).having(
            func.count(PhotoPerson.person_id) > 1
        ).all()

        # Count co-occurrences
        cooccurrence = Counter()

        for photo_id, _ in photo_person_counts:
            persons_in_photo = self.db.query(PhotoPerson.person_id).filter(
                PhotoPerson.photo_id == photo_id
            ).all()
            person_ids = [p[0] for p in persons_in_photo]

            # Count all pairs
            for i, p1 in enumerate(person_ids):
                for p2 in person_ids[i+1:]:
                    pair = tuple(sorted([p1, p2]))
                    cooccurrence[pair] += 1

        # Create inferred relationships
        created = []
        for (p1, p2), count in cooccurrence.items():
            if count >= min_cooccurrence:
                # Check if relationship already exists
                existing = self.db.query(Relationship).filter(
                    or_(
                        and_(Relationship.person_id == p1, Relationship.related_person_id == p2),
                        and_(Relationship.person_id == p2, Relationship.related_person_id == p1)
                    ),
                    Relationship.source == "inferred"
                ).first()

                if not existing:
                    # Infer relationship type based on context
                    # For now, use FRIEND as default
                    rel = self.create_relationship(
                        person_id=p1,
                        related_person_id=p2,
                        relationship_type=RelationshipType.FRIEND,
                        confidence=min(count / 10.0, 0.9),
                        is_verified=False,
                        source="inferred",
                        inferred_from_photo_count=count,
                        created_by="system"
                    )
                    created.append(rel)

        return created

    def get_mind_map_data(self, person_id: int = None, depth: int = 2) -> Dict:
        """Get mind map data formatted for frontend visualization."""
        G = self.get_relationship_graph(person_id, depth)

        nodes = []
        edges = []

        for node_id, data in G.nodes(data=True):
            nodes.append({
                "id": node_id,
                "label": data.get("label", f"Person {node_id}"),
                "name": data.get("name", ""),
                "reference_photo_id": data.get("reference_photo_id"),
                "size": G.degree(node_id) + 5,  # Size based on connections
            })

        for source, target, data in G.edges(data=True):
            edges.append({
                "from": source,
                "to": target,
                "type": data.get("type", "friend"),
                "confidence": data.get("confidence", 1.0),
                "verified": data.get("verified", False),
                "label": data.get("type", "").replace("_", " ").title(),
            })

        return {
            "nodes": nodes,
            "edges": edges,
            "center_person_id": person_id,
        }

    def suggest_relationships(self, person_id: int, limit: int = 10) -> List[Dict]:
        """Suggest potential relationships based on photo co-occurrence and graph structure."""
        suggestions = []

        # Get co-occurrence with other people
        person_photos = self.db.query(PhotoPerson.photo_id).filter(
            PhotoPerson.person_id == person_id
        ).all()
        photo_ids = [p[0] for p in person_photos]

        if not photo_ids:
            return suggestions

        # Find people who appear in same photos
        cooccurrence = self.db.query(
            PhotoPerson.person_id,
            func.count(PhotoPerson.photo_id).label('count')
        ).filter(
            PhotoPerson.photo_id.in_(photo_ids),
            PhotoPerson.person_id != person_id
        ).group_by(PhotoPerson.person_id).order_by(
            func.count(PhotoPerson.photo_id).desc()
        ).limit(limit).all()

        for other_id, count in cooccurrence:
            # Check if relationship already exists
            existing = self.db.query(Relationship).filter(
                or_(
                    and_(Relationship.person_id == person_id, Relationship.related_person_id == other_id),
                    and_(Relationship.person_id == other_id, Relationship.related_person_id == person_id)
                )
            ).first()

            if not existing:
                other_person = self.db.query(Person).get(other_id)
                if other_person:
                    suggestions.append({
                        "person_id": other_id,
                        "person_name": other_person.display_name or other_person.name,
                        "cooccurrence_count": count,
                        "suggested_type": RelationshipType.FRIEND.value,
                        "confidence": min(count / 5.0, 0.8),
                    })

        return suggestions

    def get_shortest_path(self, person1_id: int, person2_id: int) -> List[int]:
        """Find shortest relationship path between two people."""
        G = self.get_relationship_graph()
        try:
            return nx.shortest_path(G, person1_id, person2_id)
        except nx.NetworkXNoPath:
            return []

    def get_connected_components(self) -> List[List[int]]:
        """Get all connected components in the relationship graph."""
        G = self.get_relationship_graph()
        return list(nx.connected_components(G))

    def export_graph_gephi(self, filepath: str):
        """Export relationship graph to Gephi format (GEXF)."""
        G = self.get_relationship_graph()
        nx.write_gexf(G, filepath)

    def get_statistics(self) -> Dict:
        """Get relationship graph statistics."""
        G = self.get_relationship_graph()

        return {
            "total_people": G.number_of_nodes(),
            "total_relationships": G.number_of_edges(),
            "connected_components": nx.number_connected_components(G),
            "average_degree": sum(dict(G.degree()).values()) / G.number_of_nodes() if G.number_of_nodes() > 0 else 0,
            "density": nx.density(G),
            "clustering_coefficient": nx.average_clustering(G) if G.number_of_nodes() > 0 else 0,
        }


def build_mind_map(person_id: int = None, depth: int = 2) -> Dict:
    """Convenience function to build mind map data."""
    service = RelationshipService()
    return service.get_mind_map_data(person_id, depth)