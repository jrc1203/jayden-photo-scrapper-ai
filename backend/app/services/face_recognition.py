"""Face recognition service - detects and recognizes faces in photos."""
import face_recognition
import numpy as np
from pathlib import Path
from typing import List, Optional, Tuple, Dict
from sqlalchemy.orm import Session

from app.core.config import settings
from app.models.photo import Photo
from app.models.person import Person, PhotoPerson
from app.core.database import SessionLocal


class FaceRecognitionService:
    """Handles face detection, encoding, and recognition."""

    def __init__(self, db: Session = None):
        self.db = db or SessionLocal()
        self.tolerance = settings.FACE_RECOGNITION_TOLERANCE
        self.model = settings.FACE_DETECTION_MODEL
        self.min_face_size = settings.MIN_FACE_SIZE

    def process_photo(self, photo: Photo) -> List[Dict]:
        """
        Process a single photo for faces.
        Returns list of detected faces with encodings and locations.
        """
        photo_path = settings.photos_path / photo.file_path

        try:
            # Load image
            image = face_recognition.load_image_file(str(photo_path))

            # Detect faces
            face_locations = face_recognition.face_locations(
                image,
                model=self.model,
                number_of_times_to_upsample=1
            )

            if not face_locations:
                return []

            # Get face encodings
            face_encodings = face_recognition.face_encodings(
                image,
                known_face_locations=face_locations,
                num_jitters=1,
                model="large"
            )

            results = []
            for i, (location, encoding) in enumerate(zip(face_locations, face_encodings)):
                top, right, bottom, left = location

                # Normalize coordinates (0-1)
                height, width = image.shape[:2]
                norm_location = {
                    "top": top / height,
                    "right": right / width,
                    "bottom": bottom / height,
                    "left": left / width,
                }

                # Check face size
                face_width = right - left
                face_height = bottom - top
                if face_width < self.min_face_size or face_height < self.min_face_size:
                    continue

                results.append({
                    "encoding": encoding.tolist(),
                    "location": norm_location,
                    "face_index": i,
                })

            return results

        except Exception as e:
            print(f"Error processing photo {photo.id}: {e}")
            return []

    def find_or_create_person(self, face_encoding: List[float], photo: Photo,
                               location: Dict, confidence: float = 1.0,
                               known_embeddings: Optional[List[Tuple[Person, np.ndarray]]] = None) -> tuple[Person, bool]:
        """
        Find matching person or create new one.
        Returns a tuple of (Person object, is_new boolean).

        Args:
            known_embeddings: Optional pre-loaded list of (Person, embedding_array) tuples.
                              If not provided, loads all persons from DB (inefficient for batch processing).
                              For scalability, pass pre-loaded embeddings to avoid N+1 queries.
        """
        # Search for similar faces in database
        if known_embeddings is None:
            # Fallback: load all persons (inefficient - loads ALL for EACH face)
            # SCALABILITY LIMITATION: This queries the database for every single face.
            # For production use with many faces, pass pre-loaded embeddings or use a vector database.
            known_persons = self.db.query(Person).filter(
                Person.face_embedding.isnot(None)
            ).all()
            known_embeddings = [
                (p, np.array(p.face_embedding)) for p in known_persons if p.face_embedding
            ]

        best_match = None
        best_distance = float('inf')
        face_encoding_arr = np.array(face_encoding)

        for person, known_encoding in known_embeddings:
            distance = np.linalg.norm(face_encoding_arr - known_encoding)

            if distance < self.tolerance and distance < best_distance:
                best_distance = distance
                best_match = person

        if best_match:
            # Update person's embedding with new sample (rolling average)
            self._update_person_embedding(best_match, face_encoding)
            return best_match, False
        else:
            # Create new person
            person = Person(
                name=f"Person_{photo.id}_{location['face_index']}",
                face_embedding=face_encoding,
                face_embedding_model="face_recognition_large",
                is_manual=False,
                confidence_threshold=self.tolerance,
            )
            self.db.add(person)
            self.db.flush()
            return person, True

    def _update_person_embedding(self, person: Person, new_encoding: List[float]):
        """Update person's face embedding with rolling average."""
        if person.face_embedding:
            old_encoding = np.array(person.face_embedding)
            new_encoding_arr = np.array(new_encoding)
            # Simple average (could be weighted by confidence)
            updated = (old_encoding + new_encoding_arr) / 2
            person.face_embedding = updated.tolist()
        else:
            person.face_embedding = new_encoding

    def link_face_to_person(self, photo: Photo, person: Person,
                            location: Dict, confidence: float,
                            is_verified: bool = False,
                            detection_method: str = "auto") -> PhotoPerson:
        """Create PhotoPerson link between photo and person."""
        # Check if link already exists
        existing = self.db.query(PhotoPerson).filter(
            PhotoPerson.photo_id == photo.id,
            PhotoPerson.person_id == person.id,
            PhotoPerson.face_top == location["top"],
            PhotoPerson.face_left == location["left"]
        ).first()

        if existing:
            existing.confidence = max(existing.confidence, confidence)
            existing.is_verified = existing.is_verified or is_verified
            return existing

        # Determine if this is the primary face (largest face in photo)
        # For simplicity, first face is primary
        is_primary = False
        existing_links = self.db.query(PhotoPerson).filter(
            PhotoPerson.photo_id == photo.id
        ).count()
        if existing_links == 0:
            is_primary = True

        link = PhotoPerson(
            photo_id=photo.id,
            person_id=person.id,
            face_top=location["top"],
            face_right=location["right"],
            face_bottom=location["bottom"],
            face_left=location["left"],
            confidence=confidence,
            is_verified=is_verified,
            is_primary=is_primary,
            detection_method=detection_method,
        )
        self.db.add(link)

        # Update person's reference photo if this is a good match
        if confidence > 0.8 and (not person.reference_photo_id or is_primary):
            person.reference_photo_id = photo.id

        return link

    def process_all_unprocessed(self, batch_size: int = 50) -> dict:
        """Process all unprocessed photos for faces using a single transaction per batch."""
        stats = {
            "processed": 0,
            "faces_found": 0,
            "new_persons": 0,
            "matched_persons": 0,
            "errors": 0,
        }

        try:
            # Load all known person embeddings ONCE per batch (not per face)
            # This avoids N+1 queries where N = number of faces
            # SCALABILITY NOTE: For very large datasets (>10k persons), consider
            # using a vector database (e.g., pgvector, Pinecone, Weaviate) or
            # approximate nearest neighbor search (e.g., FAISS, HNSW) instead of
            # loading all embeddings into memory.
            known_persons = self.db.query(Person).filter(
                Person.face_embedding.isnot(None)
            ).all()
            known_embeddings = [
                (p, np.array(p.face_embedding)) for p in known_persons if p.face_embedding
            ]

            photos = self.db.query(Photo).filter(
                Photo.is_processed == False
            ).limit(batch_size).all()

            for photo in photos:
                try:
                    faces = self.process_photo(photo)

                    for face in faces:
                        stats["faces_found"] += 1
                        person, is_new = self.find_or_create_person(
                            face["encoding"], photo, face["location"],
                            known_embeddings=known_embeddings
                        )

                        # Update the cache with the new person if created
                        if is_new:
                            stats["new_persons"] += 1
                            known_embeddings.append((person, np.array(person.face_embedding)))
                        else:
                            stats["matched_persons"] += 1
                            # Update the cached embedding for this person (rolling average)
                            for i, (p, emb) in enumerate(known_embeddings):
                                if p.id == person.id:
                                    known_embeddings[i] = (person, np.array(person.face_embedding))
                                    break

                        self.link_face_to_person(
                            photo, person, face["location"],
                            confidence=1.0 - min(face_recognition.face_distance(
                                [np.array(person.face_embedding)], np.array(face["encoding"])
                            )[0], 1.0) if person.face_embedding else 0.5
                        )

                    photo.is_processed = True
                    stats["processed"] += 1

                except Exception as e:
                    photo.processing_error = str(e)
                    stats["errors"] += 1
                    print(f"Error processing photo {photo.id}: {e}")

            # Commit once at the end for the entire batch
            self.db.commit()
        except Exception as e:
            # Rollback on any error
            self.db.rollback()
            stats["errors"] += 1
            print(f"Batch processing failed, rolled back: {e}")
            raise

        return stats

    def get_person_photos(self, person_id: int, limit: int = 100, offset: int = 0) -> List[Photo]:
        """Get all photos containing a specific person."""
        return self.db.query(Photo).join(PhotoPerson).filter(
            PhotoPerson.person_id == person_id
        ).order_by(Photo.taken_at.desc().nullslast()).offset(offset).limit(limit).all()

    def merge_persons(self, primary_id: int, secondary_id: int) -> Person:
        """Merge two person records (when user confirms they're the same)."""
        primary = self.db.query(Person).get(primary_id)
        secondary = self.db.query(Person).get(secondary_id)

        if not primary or not secondary:
            raise ValueError("Person not found")

        # Reassign all photo links
        links = self.db.query(PhotoPerson).filter(
            PhotoPerson.person_id == secondary_id
        ).all()

        for link in links:
            # Check if primary already has a link for this photo/location
            existing = self.db.query(PhotoPerson).filter(
                PhotoPerson.photo_id == link.photo_id,
                PhotoPerson.person_id == primary_id,
                PhotoPerson.face_top == link.face_top,
                PhotoPerson.face_left == link.face_left
            ).first()

            if existing:
                # Keep higher confidence
                existing.confidence = max(existing.confidence, link.confidence)
                existing.is_verified = existing.is_verified or link.is_verified
                self.db.delete(link)
            else:
                link.person_id = primary_id

        # Merge embeddings
        if secondary.face_embedding and primary.face_embedding:
            primary.face_embedding = (
                (np.array(primary.face_embedding) + np.array(secondary.face_embedding)) / 2
            ).tolist()
        elif secondary.face_embedding:
            primary.face_embedding = secondary.face_embedding

        # Keep the earlier created_at
        if secondary.created_at < primary.created_at:
            primary.created_at = secondary.created_at

        # Delete secondary
        self.db.delete(secondary)
        self.db.commit()

        return primary


def process_faces_batch(batch_size: int = 50) -> dict:
    """Convenience function to process faces in batch."""
    service = FaceRecognitionService()
    return service.process_all_unprocessed(batch_size)