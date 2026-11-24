"""Persistence for user-adjustable settings stored outside the photo database."""
import json
import logging
import os
import tempfile
from pathlib import Path
from typing import Any

from app.core.config import settings


logger = logging.getLogger(__name__)
SETTINGS_FILE_NAME = "app-settings.json"
MIN_THUMBNAIL_QUALITY = 50
MAX_THUMBNAIL_QUALITY = 95


def _settings_file() -> Path:
    return settings.data_path / SETTINGS_FILE_NAME


def load_persisted_settings() -> None:
    """Apply valid persisted overrides after the data directory is available."""
    path = _settings_file()
    if not path.exists():
        return

    try:
        with path.open("r", encoding="utf-8") as settings_file:
            data = json.load(settings_file)
    except (OSError, json.JSONDecodeError):
        logger.exception("Could not read persisted app settings from %s", path)
        return

    if not isinstance(data, dict):
        logger.warning("Ignoring persisted app settings because %s is not a JSON object", path)
        return

    quality = data.get("thumbnail_quality")
    if _is_valid_thumbnail_quality(quality):
        settings.THUMBNAIL_QUALITY = quality
    elif quality is not None:
        logger.warning("Ignoring invalid thumbnail_quality value in %s", path)

    photo_directory = data.get("photo_directory")
    if isinstance(photo_directory, str) and photo_directory.strip():
        photo_path = Path(photo_directory).expanduser()
        if photo_path.is_dir():
            settings.PHOTOS_SOURCE_PATH = photo_path.resolve()
        else:
            logger.warning("Ignoring unavailable photo_directory override in %s", path)


def persist_thumbnail_quality(quality: int) -> None:
    """Persist thumbnail quality while preserving other JSON settings."""
    if not _is_valid_thumbnail_quality(quality):
        raise ValueError("thumbnail_quality must be between 50 and 95")
    _persist_setting("thumbnail_quality", quality)


def persist_photo_directory(directory: Path) -> None:
    """Persist a validated source directory while preserving other settings."""
    if not directory.is_dir():
        raise ValueError("Photo directory does not exist or is not a directory")
    _persist_setting("photo_directory", str(directory.resolve()))


def _persist_setting(key: str, value: Any) -> None:
    path = _settings_file()
    path.parent.mkdir(parents=True, exist_ok=True)
    data: dict[str, Any] = {}

    if path.exists():
        try:
            with path.open("r", encoding="utf-8") as settings_file:
                existing_data = json.load(settings_file)
        except (OSError, json.JSONDecodeError) as error:
            raise RuntimeError(f"Could not read existing settings file: {path}") from error
        if not isinstance(existing_data, dict):
            raise RuntimeError(f"Existing settings file must contain a JSON object: {path}")
        data = existing_data

    data[key] = value
    temporary_path: Path | None = None
    try:
        with tempfile.NamedTemporaryFile(
            mode="w",
            encoding="utf-8",
            dir=path.parent,
            prefix=f".{path.name}.",
            suffix=".tmp",
            delete=False,
        ) as temporary_file:
            temporary_path = Path(temporary_file.name)
            json.dump(data, temporary_file, indent=2)
            temporary_file.write("\n")
        os.replace(temporary_path, path)
    finally:
        if temporary_path is not None and temporary_path.exists():
            temporary_path.unlink()


def _is_valid_thumbnail_quality(value: object) -> bool:
    return (
        isinstance(value, int)
        and not isinstance(value, bool)
        and MIN_THUMBNAIL_QUALITY <= value <= MAX_THUMBNAIL_QUALITY
    )
