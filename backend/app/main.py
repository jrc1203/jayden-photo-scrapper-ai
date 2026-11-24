"""Main FastAPI application."""
import ipaddress
import secrets
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI, Depends, HTTPException, Header
from fastapi import Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from starlette.exceptions import HTTPException as StarletteHTTPException

from app.core.config import settings
from app.core.database import init_db
from app.core.user_settings import load_persisted_settings
from app.api import photos, persons, relationships, tags, settings as settings_api


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan events."""
    # Startup
    await init_db()

    # Ensure directories exist
    settings.photos_path.mkdir(parents=True, exist_ok=True)
    settings.data_path.mkdir(parents=True, exist_ok=True)
    (settings.data_path / "thumbnails").mkdir(parents=True, exist_ok=True)
    load_persisted_settings()

    yield

    # Shutdown
    pass


app = FastAPI(
    title=settings.APP_NAME,
    description="Intelligent photo gallery management with face recognition and relationship mapping",
    version="1.0.0",
    lifespan=lifespan,
    docs_url="/api/docs",
    redoc_url="/api/redoc",
)

# API Key dependency
_ALLOWED_LOOPBACK_ORIGINS = {
    "http://localhost:8000",
    "http://127.0.0.1:8000",
}
_STATE_CHANGING_METHODS = {"POST", "PUT", "PATCH", "DELETE"}


def _is_exact_loopback_peer(request: Request) -> bool:
    """Trust only literal IPv4/IPv6 loopback client addresses, never forwarded headers."""
    if request.client is None:
        return False
    try:
        peer_ip = ipaddress.ip_address(request.client.host)
    except ValueError:
        return False
    return peer_ip in {ipaddress.ip_address("127.0.0.1"), ipaddress.ip_address("::1")}


async def verify_api_key(
    request: Request,
    x_api_key: str | None = Header(default=None, alias="X-API-Key"),
):
    """Require an API key off-host and protect loopback browser requests from CSRF."""
    expected_key = settings.API_KEY
    if not expected_key.strip():
        raise HTTPException(status_code=503, detail="API key is not configured")

    is_loopback = _is_exact_loopback_peer(request)
    origin = request.headers.get("origin")

    if is_loopback:
        same_origin = f"{request.url.scheme}://{request.url.netloc}"
        allowed_origin = origin in _ALLOWED_LOOPBACK_ORIGINS or origin == same_origin
        if origin is not None and not allowed_origin:
            raise HTTPException(status_code=403, detail="Origin not allowed")
        if request.method.upper() in _STATE_CHANGING_METHODS and not allowed_origin:
            raise HTTPException(status_code=403, detail="Allowed Origin required for state-changing loopback requests")

    if x_api_key is None:
        if is_loopback:
            return None
        raise HTTPException(status_code=401, detail="Invalid or missing API key")

    supplied = x_api_key.encode("utf-8")
    expected = expected_key.encode("utf-8")
    if not secrets.compare_digest(supplied, expected):
        raise HTTPException(status_code=401, detail="Invalid or missing API key")
    return x_api_key


# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount static files for thumbnails
app.mount(
    "/thumbnails",
    StaticFiles(directory=settings.data_path / "thumbnails", check_dir=False),
    name="thumbnails",
)

# Include routers with API key protection
app.include_router(photos.router, prefix=settings.API_V1_PREFIX, dependencies=[Depends(verify_api_key)])
app.include_router(persons.router, prefix=settings.API_V1_PREFIX, dependencies=[Depends(verify_api_key)])
app.include_router(relationships.router, prefix=settings.API_V1_PREFIX, dependencies=[Depends(verify_api_key)])
app.include_router(tags.router, prefix=settings.API_V1_PREFIX, dependencies=[Depends(verify_api_key)])
app.include_router(settings_api.router, prefix=settings.API_V1_PREFIX, dependencies=[Depends(verify_api_key)])

# Serve the built frontend at the app root when it is available.
FRONTEND_DIST = Path(__file__).parent.parent.parent / "frontend" / "dist"


class SPAStaticFiles(StaticFiles):
    """Serve the React entrypoint for client-side routes, not missing assets."""

    async def get_response(self, path: str, scope):
        try:
            return await super().get_response(path, scope)
        except StarletteHTTPException as exc:
            if exc.status_code != 404 or Path(path).suffix:
                raise
            return await super().get_response("index.html", scope)

@app.get("/health")
async def health_check():
    """Health check endpoint."""
    return {"status": "healthy"}


@app.get("/")
async def root():
    """Root endpoint."""
    index_file = FRONTEND_DIST / "index.html"
    if index_file.is_file():
        return FileResponse(index_file)
    return {
        "name": settings.APP_NAME,
        "version": "1.0.0",
        "docs": "/api/docs",
    }

# Serve React frontend in production, including client-side routes.
if FRONTEND_DIST.exists():
    app.mount("/", SPAStaticFiles(directory=FRONTEND_DIST, html=True), name="frontend")


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("app.main:app", host="127.0.0.1", port=8000, reload=settings.DEBUG, proxy_headers=False)
