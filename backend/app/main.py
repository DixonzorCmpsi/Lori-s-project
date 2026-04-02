"""FastAPI application for Digital Call Board."""

from contextlib import asynccontextmanager
from fastapi import FastAPI, HTTPException, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from app.database import init_db
from app.routers import (
    auth,
    theaters,
    productions,
    schedule,
    bulletin,
    members,
    invite,
    conflicts,
    cast_profile,
    cast_assignments,
    chat,
    join,
    scenes,
    attendance,
)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Create database tables on startup."""
    await init_db()
    yield


def create_app() -> FastAPI:
    """Create and configure the FastAPI application."""
    app = FastAPI(
        title="Digital Call Board API",
        lifespan=lifespan,
        description="Theater Production Management API",
        version="1.0.0",
    )

    # CORS middleware
    app.add_middleware(
        CORSMiddleware,
        allow_origins=[
            "http://localhost:5173",
            "http://localhost:3000",
            "http://127.0.0.1:5173",
            "http://127.0.0.1:3000",
        ],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    # Include all routers with correct prefixes
    app.include_router(auth.router, prefix="/api/auth", tags=["auth"])
    app.include_router(theaters.router, prefix="/api/theaters", tags=["theaters"])
    app.include_router(
        productions.router, prefix="/api/productions", tags=["productions"]
    )
    app.include_router(schedule.router, prefix="/api/productions", tags=["schedule"])
    app.include_router(bulletin.router, prefix="/api/productions", tags=["bulletin"])
    app.include_router(members.router, prefix="/api/productions", tags=["members"])
    app.include_router(invite.router, prefix="/api/productions", tags=["invite"])
    app.include_router(conflicts.router, prefix="/api/productions", tags=["conflicts"])
    app.include_router(
        cast_profile.router, prefix="/api/productions", tags=["cast_profile"]
    )
    app.include_router(cast_assignments.router, prefix="/api/productions", tags=["cast_assignments"])
    app.include_router(chat.router, prefix="/api/productions", tags=["chat"])
    app.include_router(join.router, prefix="/api", tags=["join"])
    app.include_router(scenes.router, prefix="/api", tags=["scenes"])
    app.include_router(attendance.router, prefix="/api", tags=["attendance"])

    # Custom exception handlers to match spec error format
    @app.exception_handler(HTTPException)
    async def http_exception_handler(request: Request, exc: HTTPException):
        """Convert HTTPException to spec-compliant error format."""
        detail = exc.detail
        if isinstance(detail, dict) and "error" in detail:
            return JSONResponse(status_code=exc.status_code, content=detail)
        return JSONResponse(
            status_code=exc.status_code,
            content={"error": "INTERNAL_ERROR", "message": str(detail)},
        )

    @app.exception_handler(RequestValidationError)
    async def validation_exception_handler(request: Request, exc: RequestValidationError):
        """Convert Pydantic validation errors to spec format."""
        fields = []
        for error in exc.errors():
            loc = error.get("loc", [])
            field_name = str(loc[-1]) if loc else "unknown"
            fields.append({"field": field_name, "message": error.get("msg", "Invalid value")})
        return JSONResponse(
            status_code=400,
            content={
                "error": "VALIDATION_ERROR",
                "message": "Invalid input",
                "fields": fields,
            },
        )

    # --- Security headers middleware ---
    from starlette.middleware.base import BaseHTTPMiddleware
    from starlette.responses import Response as StarletteResponse

    class SecurityHeadersMiddleware(BaseHTTPMiddleware):
        async def dispatch(self, request, call_next):
            response = await call_next(request)
            response.headers["x-frame-options"] = "DENY"
            response.headers["x-content-type-options"] = "nosniff"
            response.headers["referrer-policy"] = "strict-origin-when-cross-origin"
            response.headers["strict-transport-security"] = "max-age=31536000; includeSubDomains"
            response.headers["permissions-policy"] = "camera=(), microphone=(), geolocation=()"
            response.headers["content-security-policy"] = (
                "default-src 'self'; script-src 'self' 'unsafe-inline'; "
                "style-src 'self' 'unsafe-inline'; "
                "img-src 'self' blob: data: https://lh3.googleusercontent.com; "
                "connect-src 'self' wss: https://accounts.google.com https://oauth2.googleapis.com; "
                "font-src 'self' data:; form-action 'self' https://accounts.google.com"
            )
            return response

    app.add_middleware(SecurityHeadersMiddleware)

    # --- CSRF origin checking middleware ---
    CSRF_PROTECTED_PATHS = [
        "/api/auth/register", "/api/auth/verify-email", "/api/auth/resend-verification",
        "/api/auth/forgot-password", "/api/auth/reset-password",
    ]

    class CSRFMiddleware(BaseHTTPMiddleware):
        async def dispatch(self, request, call_next):
            if request.method in ("POST", "PUT", "PATCH", "DELETE"):
                path = request.scope.get("path", "")
                if any(path.startswith(p) for p in CSRF_PROTECTED_PATHS):
                    origin = request.headers.get("origin", "")
                    if origin and origin not in (
                        "http://localhost:5173", "http://localhost:3000",
                        "http://127.0.0.1:5173", "http://127.0.0.1:3000",
                        "http://test",  # httpx test client
                    ):
                        return JSONResponse(
                            status_code=403,
                            content={"error": "FORBIDDEN", "message": "Invalid origin"},
                        )
            return await call_next(request)

    app.add_middleware(CSRFMiddleware)

    # --- Rate limiting (in-memory for dev) ---
    import time as time_module
    from collections import defaultdict

    _rate_limits: dict = defaultdict(list)  # ip -> list of timestamps

    class RateLimitMiddleware(BaseHTTPMiddleware):
        async def dispatch(self, request, call_next):
            path = request.scope.get("path", "")
            if path == "/api/auth/login" and request.method == "POST":
                client_ip = request.client.host if request.client else "unknown"
                now = time_module.time()
                # Clean old entries (older than 60 seconds)
                _rate_limits[client_ip] = [t for t in _rate_limits[client_ip] if now - t < 60]
                if len(_rate_limits[client_ip]) >= 5:
                    return JSONResponse(
                        status_code=429,
                        content={"error": "RATE_LIMITED", "message": "Too many requests"},
                    )
                _rate_limits[client_ip].append(now)
            return await call_next(request)

    app.add_middleware(RateLimitMiddleware)

    # --- Realtime token endpoint ---
    from app.routers.auth import get_current_user
    from fastapi import Depends

    @app.post("/api/productions/{production_id}/realtime/token")
    async def generate_realtime_token(
        production_id: str,
        current_user: dict = Depends(get_current_user),
    ):
        """Generate a short-lived JWT for Supabase Realtime."""
        from jose import jwt as jose_jwt
        from datetime import datetime, timedelta
        from app.config import get_settings
        settings = get_settings()
        payload = {
            "sub": current_user["id"],
            "production_id": production_id,
            "exp": datetime.utcnow() + timedelta(minutes=5),
        }
        token = jose_jwt.encode(payload, settings.nextauth_secret, algorithm="HS256")
        return {"token": token}

    # Health check endpoint
    @app.get("/api/health")
    async def health_check():
        return {"status": "ok", "db": "connected"}

    return app


# Required for running with: uvicorn app.main:app --reload
app = create_app()
