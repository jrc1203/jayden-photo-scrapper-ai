"""Custom exceptions for the application."""
from typing import Optional


class AppException(Exception):
    """Base application exception."""

    def __init__(self, message: str, details: Optional[dict] = None):
        self.message = message
        self.details = details or {}
        super().__init__(self.message)


class ThumbnailGenerationError(AppException):
    """Raised when thumbnail generation fails."""

    def __init__(self, message: str, photo_path: str = None, original_error: Exception = None, retryable: bool = False):
        details = {}
        if photo_path:
            details["photo_path"] = photo_path
        if original_error:
            details["original_error"] = str(original_error)
            details["original_error_type"] = type(original_error).__name__
        details["retryable"] = retryable
        super().__init__(message, details)
        self.photo_path = photo_path
        self.original_error = original_error
        self.retryable = retryable


class PhotoProcessingError(AppException):
    """Raised when photo processing fails."""

    def __init__(self, message: str, photo_path: str = None, original_error: Exception = None, retryable: bool = False):
        details = {}
        if photo_path:
            details["photo_path"] = photo_path
        if original_error:
            details["original_error"] = str(original_error)
            details["original_error_type"] = type(original_error).__name__
        details["retryable"] = retryable
        super().__init__(message, details)
        self.photo_path = photo_path
        self.original_error = original_error
        self.retryable = retryable


class ValidationError(AppException):
    """Raised when input validation fails."""
    pass


class NotFoundError(AppException):
    """Raised when a resource is not found."""

    def __init__(self, message: str, resource_type: str = None, resource_id: str = None):
        details = {}
        if resource_type:
            details["resource_type"] = resource_type
        if resource_id:
            details["resource_id"] = resource_id
        super().__init__(message, details)
        self.resource_type = resource_type
        self.resource_id = resource_id