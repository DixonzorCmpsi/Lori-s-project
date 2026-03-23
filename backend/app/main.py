"""FastAPI application for Digital Call Board."""

from fastapi import FastAPI, HTTPException, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
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
    chat,
    join,
)


def create_app() -> FastAPI:
    """Create and configure the FastAPI application.

    This function MUST be exported - tests import it:
        from app.main import create_app
        app = create_app()
    """
    app = FastAPI(
        title="Digital Call Board API",
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
    app.include_router(chat.router, prefix="/api/productions", tags=["chat"])
    app.include_router(join.router, prefix="/api", tags=["join"])

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

    # Health check endpoint
    @app.get("/api/health")
    async def health_check():
        return {"status": "ok", "db": "connected"}

    return app


# Required for running with: uvicorn app.main:app --reload
app = create_app()
