"""Photo scanning service - discovers and indexes photos from the source folder."""
import os
import hashlib
import logging
import traceback
import time
from pathlib import Path
from typing import List, Optional, Generator
from datetime import datetime
from PIL import Image, ExifTags
import imagehash
from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError

from app.core.config import settings
from app.core.exceptions import ThumbnailGenerationError, PhotoProcessingError


def _validate_path_within_root(file_path: Path, root_path: Path) -> Path:
    """
    Validate that a file path is within the allowed root directory.
    Returns the resolved path if valid, raises ValueError if not.
    """
    try:
        resolved_path = file_path.resolve()
        resolved_root = root_path.resolve()
        resolved_path.relative_to(resolved_root)
        return resolved_path
    except (ValueError, OSError):
        raise ValueError("Invalid file path: path traversal attempt detected")


from app.models import photo, person, tag, relationship  # Import all models to ensure mappers are initialized
from app.models.photo import Photo
from app.models.person import PhotoPerson
from app.models.tag import photo_tags
from app.core.database import SessionLocal


logger = logging.getLogger(__name__)


class PhotoScanner:
    """Scans the photos directory and indexes photos in the database."""

    # Retry configuration for thumbnail generation
    MAX_RETRIES = 3
    RETRY_DELAY = 1.0  # seconds
    RETRY_BACKOFF = 2.0  # exponential backoff multiplier

    def __init__(self, db: Session = None):
        self.db = db or SessionLocal()
        self.photos_root = settings.photos_path
        self.supported_formats = settings.SUPPORTED_FORMATS

    def scan(self, force_rescan: bool = False) -> dict:
        """
        Scan photos directory and update database.
        Returns statistics about the scan.
        Uses a single transaction for the entire scan operation.
        """
        stats = {
            "total_files": 0,
            "new_photos": 0,
            "updated_photos": 0,
            "skipped_photos": 0,
            "errors": 0,
        }

        try:
            for file_path in self._walk_photos():
                stats["total_files"] += 1
                try:
                    result = self._process_file(file_path, force_rescan)
                    if result == "new":
                        stats["new_photos"] += 1
                    elif result == "updated":
                        stats["updated_photos"] += 1
                    else:
                        stats["skipped_photos"] += 1
                except Exception as e:
                    stats["errors"] += 1
                    print(f"Error processing {file_path}: {e}")

            # Commit once at the end for the entire scan
            self.db.commit()
        except Exception as e:
            # Rollback on any error
            self.db.rollback()
            stats["errors"] += 1
            print(f"Scan failed, rolled back: {e}")
            raise

        return stats

    def _walk_photos(self) -> Generator[Path, None, None]:
        """Walk the photos directory and yield supported image files."""
        for root, dirs, files in os.walk(self.photos_root):
            for file in files:
                file_path = Path(root) / file
                if file_path.suffix.lower() in self.supported_formats:
                    yield file_path

    def _process_file(self, file_path: Path, force_rescan: bool = False) -> str:
        """Process a single photo file. Does not commit - caller handles transaction."""
        # Validate path is within photos root (path traversal protection)
        try:
            file_path = _validate_path_within_root(file_path, self.photos_root)
        except ValueError:
            return "skipped"

        # Get relative path from photos root
        try:
            rel_path = file_path.relative_to(self.photos_root)
        except ValueError:
            # File is outside photos root
            return "skipped"

        rel_path_str = str(rel_path).replace("\\", "/")

        # Calculate file hash
        file_hash = self._calculate_file_hash(file_path)

        # Check if already in database
        existing = self.db.query(Photo).filter(Photo.file_hash == file_hash).first()

        if existing and not force_rescan:
            updated = False

            # Check if file path changed
            if existing.file_path != rel_path_str:
                existing.file_path = rel_path_str
                existing.file_name = file_path.name
                existing.updated_at = datetime.utcnow()
                updated = True

            # Backfill missing thumbnails without forcing a metadata rescan.
            # A stored path may also be stale if its file was removed.
            if not self._thumbnail_exists(existing):
                thumbnail_path = self._generate_thumbnail(existing)
                if thumbnail_path:
                    existing.thumbnail_path = thumbnail_path
                    updated = True

            # Don't commit - caller handles it.
            return "updated" if updated else "skipped"

        # Extract metadata
        metadata = self._extract_metadata(file_path)

        # Calculate perceptual hash
        phash = self._calculate_phash(file_path)

        # Use database-level upsert with ON CONFLICT to avoid race conditions
        # SQLite supports ON CONFLICT (file_hash) DO UPDATE
        try:
            if existing:
                # Update existing record
                existing.file_path = rel_path_str
                existing.file_name = file_path.name
                existing.width = metadata.get("width")
                existing.height = metadata.get("height")
                existing.taken_at = metadata.get("taken_at")
                existing.camera_make = metadata.get("camera_make")
                existing.camera_model = metadata.get("camera_model")
                existing.gps_latitude = metadata.get("gps_latitude")
                existing.gps_longitude = metadata.get("gps_longitude")
                existing.phash = phash
                existing.updated_at = datetime.utcnow()
                existing.scanned_at = datetime.utcnow()
                thumbnail_path = self._generate_thumbnail(existing)
                if thumbnail_path:
                    existing.thumbnail_path = thumbnail_path
                # Don't commit - caller handles it
                return "updated"
            else:
                # Insert new record - let DB enforce uniqueness
                photo = Photo(
                    file_path=rel_path_str,
                    file_name=file_path.name,
                    file_hash=file_hash,
                    width=metadata.get("width"),
                    height=metadata.get("height"),
                    taken_at=metadata.get("taken_at"),
                    camera_make=metadata.get("camera_make"),
                    camera_model=metadata.get("camera_model"),
                    gps_latitude=metadata.get("gps_latitude"),
                    gps_longitude=metadata.get("gps_longitude"),
                    phash=phash,
                    is_processed=False,
                    scanned_at=datetime.utcnow(),
                )
                photo.thumbnail_path = self._generate_thumbnail(photo)
                self.db.add(photo)
                # Don't commit - caller handles it
                return "new"
        except IntegrityError:
            # Race condition: another scan inserted the same file_hash concurrently
            # Note: we don't rollback here since caller manages the transaction
            # Instead, we return "skipped" and let the caller decide
            return "skipped"

    def _generate_thumbnail(self, photo: Photo) -> Optional[str]:
        """Generate a thumbnail when possible without failing photo indexing."""
        try:
            return self.generate_thumbnail(photo)
        except Exception as e:
            logger.warning(
                "Could not generate thumbnail for %s; photo will remain indexed: %s",
                photo.file_path,
                e,
            )
            return None

    def _thumbnail_exists(self, photo: Photo) -> bool:
        """Check that a stored thumbnail path resolves to a file under data_path."""
        if not photo.thumbnail_path:
            return False

        try:
            thumbnail_path = _validate_path_within_root(
                settings.data_path / photo.thumbnail_path,
                settings.data_path,
            )
            return thumbnail_path.is_file()
        except (OSError, ValueError):
            return False

    def _calculate_file_hash(self, file_path: Path) -> str:
        """Calculate SHA256 hash of file for deduplication."""
        hasher = hashlib.sha256()
        with open(file_path, "rb") as f:
            for chunk in iter(lambda: f.read(8192), b""):
                hasher.update(chunk)
        return hasher.hexdigest()

    def _calculate_phash(self, file_path: Path) -> Optional[str]:
        """Calculate perceptual hash for similarity detection."""
        try:
            with Image.open(file_path) as img:
                # Convert to RGB if needed
                if img.mode != "RGB":
                    img = img.convert("RGB")
                phash = imagehash.phash(img)
                return str(phash)
        except Exception:
            return None

    def _extract_metadata(self, file_path: Path) -> dict:
        """Extract EXIF metadata from image."""
        metadata = {
            "width": None,
            "height": None,
            "taken_at": None,
            "camera_make": None,
            "camera_model": None,
            "gps_latitude": None,
            "gps_longitude": None,
        }

        try:
            with Image.open(file_path) as img:
                metadata["width"] = img.width
                metadata["height"] = img.height

                exif = img.getexif()
                if exif:
                    # Parse EXIF data
                    for tag_id, value in exif.items():
                        tag = ExifTags.TAGS.get(tag_id, tag_id)

                        if tag == "DateTimeOriginal" and value:
                            try:
                                metadata["taken_at"] = datetime.strptime(value, "%Y:%m:%d %H:%M:%S")
                            except ValueError:
                                pass
                        elif tag == "Make":
                            metadata["camera_make"] = value
                        elif tag == "Model":
                            metadata["camera_model"] = value
                        elif tag == "GPSInfo" and value:
                            gps = self._parse_gps(value)
                            if gps:
                                metadata["gps_latitude"] = gps[0]
                                metadata["gps_longitude"] = gps[1]
        except Exception:
            pass

        return metadata

    def _parse_gps(self, gps_info: dict) -> Optional[tuple]:
        """Parse GPS coordinates from EXIF GPSInfo."""
        try:
            def convert_to_degrees(value):
                d, m, s = value
                return d + (m / 60.0) + (s / 3600.0)

            lat = gps_info.get(2)  # GPSLatitude
            lat_ref = gps_info.get(1)  # GPSLatitudeRef
            lon = gps_info.get(4)  # GPSLongitude
            lon_ref = gps_info.get(3)  # GPSLongitudeRef

            if lat and lon:
                lat_deg = convert_to_degrees(lat)
                lon_deg = convert_to_degrees(lon)

                if lat_ref == "S":
                    lat_deg = -lat_deg
                if lon_ref == "W":
                    lon_deg = -lon_deg

                return (lat_deg, lon_deg)
        except Exception:
            pass
        return None

    def generate_thumbnail(self, photo: Photo, max_retries: int = None) -> str:
        """
        Generate thumbnail for a photo with retry logic.

        Args:
            photo: The Photo object to generate thumbnail for
            max_retries: Maximum number of retry attempts (defaults to class MAX_RETRIES)

        Returns:
            Relative path to the generated thumbnail

        Raises:
            ThumbnailGenerationError: If thumbnail generation fails after all retries
        """
        if max_retries is None:
            max_retries = self.MAX_RETRIES

        # Validate source path is within photos root
        source_path = _validate_path_within_root(self.photos_root / photo.file_path, self.photos_root)

        thumb_dir = settings.data_path / "thumbnails"
        thumb_dir.mkdir(parents=True, exist_ok=True)

        thumb_name = f"{photo.file_hash[:16]}.jpg"
        thumb_path = thumb_dir / thumb_name

        # Validate thumbnail path is within data directory
        thumb_path = _validate_path_within_root(thumb_path, settings.data_path)

        last_error = None
        delay = self.RETRY_DELAY

        for attempt in range(max_retries + 1):
            try:
                with Image.open(source_path) as img:
                    if img.mode != "RGB":
                        img = img.convert("RGB")
                    img.thumbnail(settings.THUMBNAIL_SIZE, Image.Resampling.LANCZOS)
                    img.save(thumb_path, "JPEG", quality=settings.THUMBNAIL_QUALITY, optimize=True)

                logger.info(f"Thumbnail generated for {photo.file_path}: thumbnails/{thumb_name}")
                return f"thumbnails/{thumb_name}"

            except (ValueError, OSError, IOError) as e:
                last_error = e
                error_msg = f"Error generating thumbnail for {photo.file_path} (attempt {attempt + 1}/{max_retries + 1}): {e}"
                logger.warning(error_msg, extra={
                    "photo_path": photo.file_path,
                    "attempt": attempt + 1,
                    "max_retries": max_retries,
                    "error_type": type(e).__name__,
                })

                # Don't retry on validation errors (path issues)
                if isinstance(e, ValueError):
                    logger.error(f"Path validation failed for {photo.file_path}, not retrying: {e}")
                    raise ThumbnailGenerationError(
                        f"Invalid path for thumbnail generation: {e}",
                        photo_path=photo.file_path,
                        original_error=e,
                        retryable=False
                    )

                # Check if we should retry
                if attempt < max_retries:
                    logger.info(f"Retrying in {delay:.1f}s...")
                    time.sleep(delay)
                    delay *= self.RETRY_BACKOFF
                else:
                    logger.error(f"All retry attempts exhausted for {photo.file_path}")

            except Exception as e:
                last_error = e
                error_msg = f"Unexpected error generating thumbnail for {photo.file_path}: {e}"
                logger.error(error_msg, extra={
                    "photo_path": photo.file_path,
                    "error_type": type(e).__name__,
                    "traceback": traceback.format_exc(),
                })
                # Don't retry on unexpected errors
                break

        # All retries exhausted or non-retryable error
        raise ThumbnailGenerationError(
            f"Failed to generate thumbnail for {photo.file_path} after {max_retries + 1} attempts: {last_error}",
            photo_path=photo.file_path,
            original_error=last_error,
            retryable=not isinstance(last_error, ValueError)
        )


def scan_photos(force_rescan: bool = False) -> dict:
    """Convenience function to scan photos."""
    scanner = PhotoScanner()
    return scanner.scan(force_rescan)
