"""Auth router - Authentication endpoints."""

from datetime import date, datetime, timedelta
from typing import Any, Optional
import uuid

from fastapi import APIRouter, Depends, HTTPException, Request, status
from jose import jwt, JWTError
from passlib.context import CryptContext
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import get_settings
from app.database import async_session_maker, get_db
from app.models import User, PasswordResetToken, EmailVerificationToken
from app.services.business_logic import (
    check_age_gate,
    derive_age_range,
    validate_password,
    FIELD_MAX_LENGTHS,
    BREACHED_PASSWORDS,
)

router = APIRouter()
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
settings = get_settings()


# --- Pydantic request models ---

class RegisterRequest(BaseModel):
    email: str
    name: str
    password: str
    date_of_birth: str

class LoginRequest(BaseModel):
    email: str
    password: str

class ForgotPasswordRequest(BaseModel):
    email: str

class ResetPasswordRequest(BaseModel):
    token: str
    new_password: str

class VerifyEmailRequest(BaseModel):
    token: str

class ResendVerificationRequest(BaseModel):
    email: str

class CompleteProfileRequest(BaseModel):
    date_of_birth: str

class GoogleOAuthCallbackRequest(BaseModel):
    google_id: str
    email: str
    name: str

class JoinRequest(BaseModel):
    token: str


# --- Helper functions ---

def hash_password(password: str) -> str:
    return pwd_context.hash(password)

def verify_password(plain_password: str, hashed_password: str) -> bool:
    return pwd_context.verify(plain_password, hashed_password)

def create_access_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    to_encode = data.copy()
    expire = datetime.utcnow() + (expires_delta or timedelta(days=30))
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, settings.nextauth_secret, algorithm="HS256")


async def get_current_user(request: Request) -> dict:
    """Get the current authenticated user from the request."""
    auth_header = request.headers.get("Authorization")
    if not auth_header or not auth_header.startswith("Bearer "):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail={"error": "UNAUTHORIZED", "message": "Authentication required"},
        )

    token = auth_header.split(" ")[1]
    try:
        payload = jwt.decode(token, settings.nextauth_secret, algorithms=["HS256"])
        user_id = payload.get("sub")
        token_version = payload.get("token_version", 0)
        if not user_id:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail={"error": "UNAUTHORIZED", "message": "Invalid token"},
            )
    except JWTError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail={"error": "UNAUTHORIZED", "message": "Invalid token"},
        )

    async with async_session_maker() as session:
        result = await session.execute(select(User).where(User.id == user_id))
        user = result.scalar_one_or_none()

        if not user:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail={"error": "UNAUTHORIZED", "message": "User not found"},
            )

        if user.token_version != token_version:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail={"error": "UNAUTHORIZED", "message": "Session expired"},
            )

        return {"id": user.id, "email": user.email, "name": user.name, "role": "user"}


# --- Endpoints ---

@router.post("/register", status_code=status.HTTP_201_CREATED)
async def register(body: RegisterRequest) -> dict[str, Any]:
    """Register a new user."""
    email, name, password, date_of_birth = body.email, body.name, body.password, body.date_of_birth

    # Validate email format
    import re as re_mod
    if not re_mod.match(r'^[^@\s]+@[^@\s]+\.[^@\s]+$', email):
        raise HTTPException(status_code=400, detail={"error": "VALIDATION_ERROR", "message": "Invalid input", "fields": [{"field": "email", "message": "Invalid email format"}]})

    # Validate lengths
    errors = []
    if len(email) > 320:
        errors.append({"field": "email", "message": "Must be 320 characters or fewer"})
    if len(name) > 200:
        errors.append({"field": "name", "message": "Must be 200 characters or fewer"})
    if errors:
        raise HTTPException(status_code=400, detail={"error": "VALIDATION_ERROR", "message": "Invalid input", "fields": errors})

    # Password validation
    pw_validation = validate_password(password)
    if not pw_validation["valid"]:
        raise HTTPException(
            status_code=400,
            detail={"error": "VALIDATION_ERROR", "message": pw_validation["reason"], "fields": [{"field": "password", "message": pw_validation["reason"]}]},
        )

    # Age gate
    try:
        dob = date.fromisoformat(date_of_birth)
    except ValueError:
        raise HTTPException(status_code=400, detail={"error": "VALIDATION_ERROR", "message": "Invalid date format", "fields": [{"field": "date_of_birth", "message": "Invalid date format"}]})

    age_check = check_age_gate(dob, date.today())
    if not age_check["allowed"]:
        raise HTTPException(status_code=400, detail={"error": "VALIDATION_ERROR", "message": "You must be at least 13 years old to create an account", "fields": [{"field": "date_of_birth", "message": "You must be at least 13 years old"}]})

    age_range = derive_age_range(dob, date.today())

    async with async_session_maker() as session:
        # Anti-enumeration: check if email exists
        result = await session.execute(select(User).where(User.email == email))
        existing = result.scalar_one_or_none()

        if existing:
            # Return generic success to not reveal email exists
            return {"message": "Check your email for a verification link"}

        user = User(
            id=str(uuid.uuid4()),
            email=email,
            name=name,
            password_hash=hash_password(password),
            age_range=age_range,
            email_verified=False,
        )
        session.add(user)

        # Create verification token and send email
        import secrets, hashlib
        raw_token = secrets.token_urlsafe(32)
        token_hash = hashlib.sha256(raw_token.encode()).hexdigest()
        verify_token = EmailVerificationToken(
            id=str(uuid.uuid4()),
            user_id=user.id,
            token_hash=token_hash,
            expires_at=datetime.utcnow() + timedelta(hours=24),
        )
        session.add(verify_token)
        await session.commit()

        # Send verification email
        try:
            from app.services.email import send_email_verification
            from app.config import get_settings
            settings = get_settings()
            base_url = settings.nextauth_url or "http://localhost:5173"
            verify_url = f"{base_url}/verify-email?token={raw_token}"
            send_email_verification(email, name, verify_url)
        except Exception:
            pass  # Email failure should not block registration

        return {
            "id": user.id,
            "email": user.email,
            "name": user.name,
            "age_range": user.age_range,
            "email_verified": user.email_verified,
        }


@router.post("/login")
async def login(body: LoginRequest) -> dict[str, Any]:
    """Login with email and password."""
    email, password = body.email, body.password

    async with async_session_maker() as session:
        result = await session.execute(select(User).where(User.email == email))
        user = result.scalar_one_or_none()

        # Check lockout
        if user and user.locked_until and user.locked_until > datetime.utcnow():
            raise HTTPException(
                status_code=401,
                detail={"error": "UNAUTHORIZED", "message": "Account is locked. Try again later."},
            )

        if not user or not user.password_hash or not verify_password(password, user.password_hash):
            # Track failed attempts if user exists
            if user:
                user.failed_login_attempts = (user.failed_login_attempts or 0) + 1
                if user.failed_login_attempts >= 10:
                    user.locked_until = datetime.utcnow() + timedelta(minutes=30)
                await session.commit()

            raise HTTPException(
                status_code=401,
                detail={"error": "UNAUTHORIZED", "message": "Invalid email or password"},
            )

        # Reset failed attempts on success
        user.failed_login_attempts = 0
        user.locked_until = None
        await session.commit()

        token = create_access_token({"sub": user.id, "token_version": user.token_version})
        return {"access_token": token, "token_type": "bearer"}


@router.post("/google/callback")
async def google_oauth_callback(body: GoogleOAuthCallbackRequest) -> dict[str, Any]:
    """Handle Google OAuth callback. Creates/links user and returns JWT."""
    async with async_session_maker() as session:
        result = await session.execute(select(User).where(User.email == body.email))
        existing = result.scalar_one_or_none()

        if existing:
            if existing.email_verified:
                existing.google_id = body.google_id
                await session.commit()
                user = existing
            else:
                user = User(
                    id=str(uuid.uuid4()),
                    email=f"google-{body.google_id}@oauth.internal",
                    name=body.name,
                    google_id=body.google_id,
                    email_verified=True,
                    age_range=None,
                )
                session.add(user)
                await session.commit()
        else:
            user = User(
                id=str(uuid.uuid4()),
                email=body.email,
                name=body.name,
                google_id=body.google_id,
                email_verified=True,
                age_range=None,
            )
            session.add(user)
            await session.commit()

        token = create_access_token({"sub": user.id, "token_version": user.token_version})
        return {
            "access_token": token,
            "token_type": "bearer",
            "age_range": user.age_range,
            "email_verified": True,
        }


@router.post("/logout")
async def logout(current_user: dict = Depends(get_current_user)) -> dict:
    return {"message": "Logged out"}


@router.post("/logout-all")
async def logout_all(current_user: dict = Depends(get_current_user)) -> dict:
    async with async_session_maker() as session:
        result = await session.execute(select(User).where(User.id == current_user["id"]))
        user = result.scalar_one_or_none()
        if user:
            user.token_version += 1
            await session.commit()
    return {"message": "Logged out of all devices"}


@router.get("/me")
async def get_me(current_user: dict = Depends(get_current_user)) -> dict:
    async with async_session_maker() as session:
        result = await session.execute(select(User).where(User.id == current_user["id"]))
        user = result.scalar_one_or_none()
        if not user:
            raise HTTPException(status_code=404, detail={"error": "NOT_FOUND", "message": "User not found"})
        return {
            "id": user.id,
            "email": user.email,
            "name": user.name,
            "age_range": user.age_range,
            "email_verified": user.email_verified,
            "email_notifications": user.email_notifications,
            "parental_consent": user.parental_consent,
            "parent_email": user.parent_email,
            "parent_phone": user.parent_phone,
        }


import time as _time_mod
from collections import defaultdict as _defaultdict
_forgot_pw_limits: dict = _defaultdict(list)
_resend_limits: dict = _defaultdict(list)


@router.post("/forgot-password")
async def forgot_password(body: ForgotPasswordRequest) -> dict:
    # Rate limit: 3 per hour per email
    email = body.email.lower()
    now = _time_mod.time()
    _forgot_pw_limits[email] = [t for t in _forgot_pw_limits[email] if now - t < 3600]
    if len(_forgot_pw_limits[email]) >= 3:
        raise HTTPException(status_code=429, detail={"error": "RATE_LIMITED", "message": "Too many requests"})
    _forgot_pw_limits[email].append(now)

    # Create reset token and send email (anti-enumeration: always return success)
    async with async_session_maker() as session:
        result = await session.execute(select(User).where(User.email == email))
        user = result.scalar_one_or_none()
        if user:
            import secrets, hashlib
            raw_token = secrets.token_urlsafe(32)
            token_hash = hashlib.sha256(raw_token.encode()).hexdigest()
            reset_token = PasswordResetToken(
                id=str(uuid.uuid4()),
                user_id=user.id,
                token_hash=token_hash,
                expires_at=datetime.utcnow() + timedelta(hours=1),
            )
            session.add(reset_token)
            await session.commit()

            try:
                from app.services.email import send_password_reset
                from app.config import get_settings
                settings = get_settings()
                base_url = settings.nextauth_url or "http://localhost:5173"
                reset_url = f"{base_url}/reset-password?token={raw_token}"
                send_password_reset(user.email, user.name, reset_url)
            except Exception:
                pass

    return {"message": "Check your email for a reset link"}


@router.post("/reset-password")
async def reset_password(body: ResetPasswordRequest) -> dict:
    pw_validation = validate_password(body.new_password)
    if not pw_validation["valid"]:
        raise HTTPException(status_code=400, detail={"error": "VALIDATION_ERROR", "message": pw_validation["reason"]})

    async with async_session_maker() as session:
        import hashlib
        token_hash = hashlib.sha256(body.token.encode()).hexdigest()
        result = await session.execute(select(PasswordResetToken).where(PasswordResetToken.token_hash == token_hash))
        reset_token = result.scalar_one_or_none()

        if not reset_token:
            raise HTTPException(status_code=400, detail={"error": "VALIDATION_ERROR", "message": "Invalid or expired reset token"})
        if reset_token.expires_at < datetime.utcnow():
            raise HTTPException(status_code=400, detail={"error": "VALIDATION_ERROR", "message": "Reset link has expired"})

        result = await session.execute(select(User).where(User.id == reset_token.user_id))
        user = result.scalar_one_or_none()
        if user:
            user.password_hash = hash_password(body.new_password)
            user.token_version += 1
        await session.delete(reset_token)
        await session.commit()
        return {"message": "Password reset successful"}


@router.post("/verify-email")
async def verify_email(body: VerifyEmailRequest) -> dict:
    async with async_session_maker() as session:
        import hashlib
        token_hash = hashlib.sha256(body.token.encode()).hexdigest()
        result = await session.execute(select(EmailVerificationToken).where(EmailVerificationToken.token_hash == token_hash))
        verify_token = result.scalar_one_or_none()

        if not verify_token:
            raise HTTPException(status_code=400, detail={"error": "VALIDATION_ERROR", "message": "Invalid or expired verification token"})
        if verify_token.expires_at < datetime.utcnow():
            raise HTTPException(status_code=400, detail={"error": "VALIDATION_ERROR", "message": "Verification link has expired"})

        result = await session.execute(select(User).where(User.id == verify_token.user_id))
        user = result.scalar_one_or_none()
        if user:
            user.email_verified = True
        await session.delete(verify_token)
        await session.commit()
        return {"message": "Email verified successfully"}


@router.post("/resend-verification")
async def resend_verification(body: ResendVerificationRequest) -> dict:
    # Rate limit: 3 per hour per email
    email = body.email.lower()
    now = _time_mod.time()
    _resend_limits[email] = [t for t in _resend_limits[email] if now - t < 3600]
    if len(_resend_limits[email]) >= 3:
        raise HTTPException(status_code=429, detail={"error": "RATE_LIMITED", "message": "Too many requests"})
    _resend_limits[email].append(now)

    async with async_session_maker() as session:
        result = await session.execute(select(User).where(User.email == email))
        user = result.scalar_one_or_none()
        if user and not user.email_verified:
            import secrets, hashlib
            raw_token = secrets.token_urlsafe(32)
            token_hash = hashlib.sha256(raw_token.encode()).hexdigest()
            token = EmailVerificationToken(
                id=str(uuid.uuid4()),
                user_id=user.id,
                token_hash=token_hash,
                expires_at=datetime.utcnow() + timedelta(hours=24),
            )
            session.add(token)
            await session.commit()
            try:
                from app.services.email import send_email_verification
                from app.config import get_settings
                settings = get_settings()
                base_url = settings.nextauth_url or "http://localhost:5173"
                verify_url = f"{base_url}/verify-email?token={raw_token}"
                send_email_verification(user.email, user.name, verify_url)
            except Exception:
                pass

    return {"message": "Verification email sent"}


@router.post("/complete-profile")
async def complete_profile(body: CompleteProfileRequest, current_user: dict = Depends(get_current_user)) -> dict:
    try:
        dob = date.fromisoformat(body.date_of_birth)
    except ValueError:
        raise HTTPException(status_code=400, detail={"error": "VALIDATION_ERROR", "message": "Invalid date format"})

    age_check = check_age_gate(dob, date.today())
    if not age_check["allowed"]:
        raise HTTPException(status_code=400, detail={"error": "VALIDATION_ERROR", "message": "You must be at least 13 years old"})

    age_range = derive_age_range(dob, date.today())

    async with async_session_maker() as session:
        result = await session.execute(select(User).where(User.id == current_user["id"]))
        user = result.scalar_one_or_none()
        if user:
            user.age_range = age_range
            await session.commit()
        return {"age_range": age_range}


@router.patch("/account")
async def update_account(body: dict, current_user: dict = Depends(get_current_user)) -> dict:
    """Update user profile fields."""
    from app.services.audit import log_action, ACTIONS

    async with async_session_maker() as session:
        result = await session.execute(select(User).where(User.id == current_user["id"]))
        user = result.scalar_one_or_none()
        if not user:
            raise HTTPException(status_code=404, detail={"error": "NOT_FOUND", "message": "User not found"})

        if "name" in body:
            if not body["name"] or len(body["name"]) > 200:
                raise HTTPException(status_code=400, detail={"error": "VALIDATION_ERROR", "message": "Invalid name"})
            user.name = body["name"].strip()

        if "email_notifications" in body:
            user.email_notifications = bool(body["email_notifications"])
            await log_action(ACTIONS["email_pref_change"], "user", user.id, user_id=user.id, actor_id=user.id,
                           details=f"email_notifications={user.email_notifications}")

        if "parent_email" in body:
            user.parent_email = body["parent_email"]
            await log_action(ACTIONS["parent_email_set"], "user", user.id, user_id=user.id, actor_id=user.id)

        if "parent_phone" in body:
            user.parent_phone = body["parent_phone"]

        if "parental_consent" in body and body["parental_consent"]:
            user.parental_consent = True
            await log_action(ACTIONS["parental_consent"], "user", user.id, user_id=user.id, actor_id=user.id)

        await session.commit()
        await log_action(ACTIONS["profile_update"], "user", user.id, user_id=user.id, actor_id=user.id)

        return {
            "name": user.name,
            "email": user.email,
            "email_notifications": user.email_notifications,
            "age_range": user.age_range,
            "parental_consent": user.parental_consent,
            "parent_email": user.parent_email,
            "parent_phone": user.parent_phone,
        }


@router.post("/change-password")
async def change_password(body: dict, current_user: dict = Depends(get_current_user)) -> dict:
    """Change password with current password verification."""
    from app.services.audit import log_action, ACTIONS

    current_password = body.get("current_password")
    new_password = body.get("new_password")

    if not current_password or not new_password:
        raise HTTPException(status_code=400, detail={"error": "VALIDATION_ERROR", "message": "Both passwords required"})

    pw_check = validate_password(new_password)
    if not pw_check["valid"]:
        raise HTTPException(status_code=400, detail={"error": "VALIDATION_ERROR", "message": pw_check["reason"]})

    async with async_session_maker() as session:
        result = await session.execute(select(User).where(User.id == current_user["id"]))
        user = result.scalar_one_or_none()
        if not user or not user.password_hash:
            raise HTTPException(status_code=400, detail={"error": "INVALID", "message": "Cannot change password for this account"})

        if not pwd_context.verify(current_password, user.password_hash):
            raise HTTPException(status_code=400, detail={"error": "INVALID", "message": "Current password is incorrect"})

        user.password_hash = pwd_context.hash(new_password)
        await session.commit()
        await log_action(ACTIONS["password_change"], "user", user.id, user_id=user.id, actor_id=user.id)
        return {"message": "Password changed"}


@router.get("/emergency-contacts")
async def get_emergency_contacts(current_user: dict = Depends(get_current_user)) -> list[dict]:
    """Get user's emergency contacts."""
    from app.models import EmergencyContact
    async with async_session_maker() as session:
        stmt = select(EmergencyContact).where(
            EmergencyContact.user_id == current_user["id"]
        ).order_by(EmergencyContact.contact_order)
        result = await session.execute(stmt)
        contacts = result.scalars().all()
        return [
            {"id": c.id, "contact_order": c.contact_order, "name": c.name,
             "email": c.email, "phone": c.phone, "relationship": c.relationship}
            for c in contacts
        ]


@router.put("/emergency-contacts")
async def save_emergency_contacts(body: dict, current_user: dict = Depends(get_current_user)) -> list[dict]:
    """Save emergency contacts (replaces all). Expects { contacts: [{name, email, phone, relationship}] }."""
    from app.models import EmergencyContact
    from app.services.audit import log_action, ACTIONS
    import uuid as _uuid

    contacts_data = body.get("contacts", [])
    if not contacts_data or not isinstance(contacts_data, list):
        raise HTTPException(status_code=400, detail={"error": "VALIDATION_ERROR", "message": "At least one emergency contact is required"})
    if len(contacts_data) > 2:
        raise HTTPException(status_code=400, detail={"error": "VALIDATION_ERROR", "message": "Maximum 2 emergency contacts"})

    # Validate first contact is complete
    first = contacts_data[0]
    if not first.get("name") or not first.get("relationship"):
        raise HTTPException(status_code=400, detail={"error": "VALIDATION_ERROR", "message": "First emergency contact requires name and relationship"})
    if not first.get("email") and not first.get("phone"):
        raise HTTPException(status_code=400, detail={"error": "VALIDATION_ERROR", "message": "First emergency contact requires email or phone"})

    async with async_session_maker() as session:
        # Delete existing
        stmt = select(EmergencyContact).where(EmergencyContact.user_id == current_user["id"])
        result = await session.execute(stmt)
        for old in result.scalars().all():
            await session.delete(old)

        # Create new
        saved = []
        for i, c in enumerate(contacts_data):
            if not c.get("name"):
                continue
            ec = EmergencyContact(
                id=str(_uuid.uuid4()),
                user_id=current_user["id"],
                contact_order=i + 1,
                name=c["name"][:200],
                email=c.get("email", "")[:320] if c.get("email") else None,
                phone=c.get("phone", "")[:20] if c.get("phone") else None,
                relationship=c.get("relationship", "other")[:50],
            )
            session.add(ec)
            saved.append({"id": ec.id, "contact_order": ec.contact_order, "name": ec.name,
                         "email": ec.email, "phone": ec.phone, "relationship": ec.relationship})

        await session.commit()
        await log_action(ACTIONS["profile_update"], "emergency_contacts", current_user["id"],
                        user_id=current_user["id"], actor_id=current_user["id"])
        return saved


@router.delete("/account")
async def delete_account(current_user: dict = Depends(get_current_user)) -> dict:
    from app.services.audit import log_action, ACTIONS
    await log_action(ACTIONS["account_delete"], "user", current_user["id"], user_id=current_user["id"], actor_id=current_user["id"])
    async with async_session_maker() as session:
        result = await session.execute(select(User).where(User.id == current_user["id"]))
        user = result.scalar_one_or_none()
        if user:
            await session.delete(user)
            await session.commit()
        return {"message": "Account deleted"}
