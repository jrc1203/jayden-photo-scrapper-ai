"""Application configuration using Pydantic Settings."""
from pathlib import Path
from pydantic import model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict
from typing import Optional


class Settings(BaseSettings):
    """Application settings loaded from environment variables."""

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore"
    )

    # Application
    APP_NAME: str = "Jayden Photo Scrapper AI"
    DEBUG: bool = False
    API_V1_PREFIX: str = "/api/v1"

    # Paths
    PHOTOS_SOURCE_PATH: Path = Path("../photos")
    DATA_DIR: Path = Path("../data")

    # Database
    DATABASE_URL: str = "sqlite:///../data/app.db"

    # Security
    SECRET_KEY: str
    API_KEY: str
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30
    ALLOWED_ORIGINS: list[str] = []

    @model_validator(mode="after")
    def validate_secret_key(self) -> "Settings":
        """Validate that authentication secrets are configured with nonblank values."""
        if not self.DEBUG and not self.SECRET_KEY.strip():
            raise ValueError("SECRET_KEY must be set in production (DEBUG=False)")
        if not self.API_KEY.strip():
            raise ValueError("API_KEY must be a non-empty value")
        return self

    # Face Recognition
    FACE_RECOGNITION_BACKEND: str = "local"  # "local" or "cloud"
    FACE_DETECTION_MODEL: str = "hog"  # "hog" or "cnn"
    FACE_RECOGNITION_TOLERANCE: float = 0.6
    MIN_FACE_SIZE: int = 20

    # Embeddings
    EMBEDDING_MODEL: str = "all-MiniLM-L6-v2"
    EMBEDDING_DIMENSION: int = 384

    # Image Processing
    THUMBNAIL_SIZE: tuple[int, int] = (256, 256)
    THUMBNAIL_QUALITY: int = 85
    THUMBNAIL_FORMAT: str = "JPEG"
    MAX_IMAGE_DIMENSION: int = 1920
    SUPPORTED_FORMATS: tuple[str, ...] = (".jpg", ".jpeg", ".png", ".webp", ".heic", ".heif")

    # Scanning
    SCAN_BATCH_SIZE: int = 50
    SCAN_INTERVAL_HOURS: int = 24

    @property
    def photos_path(self) -> Path:
        """Get absolute path to photos directory."""
        return self.PHOTOS_SOURCE_PATH.resolve()

    @property
    def data_path(self) -> Path:
        """Get absolute path to data directory."""
        return self.DATA_DIR.resolve()


settings = Settings()
