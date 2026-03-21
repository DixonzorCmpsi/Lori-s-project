# SPEC-002: Authentication & Authorization

**Status:** Draft
**Last Updated:** 2026-03-21
**Depends On:** SPEC-001

---

## Goals (Immutable)

- Implement Google OAuth 2.0 (Authorization Code + PKCE) as primary auth method
- Implement email/password auth with bcrypt hashing as fallback auth method
- Implement invite link system with 30-day expiry and configurable max uses per token
- Generate 256-bit cryptographically random session tokens stored server-side in PostgreSQL
- Implement password reset flow with 1-hour expiry, single-use hashed tokens, and full session invalidation
- Implement account lockout after 10 failed attempts within 15 minutes (30-minute lock duration)
- Implement anti-enumeration: login and registration endpoints return identical responses regardless of email existence
- Implement age gate at registration blocking users under 13 and discarding raw DOB after deriving age range
- Enforce RBAC middleware on every protected route: authenticate session, verify production membership, verify role permission

## Non-Goals (Explicit Exclusions)

- Magic link (passwordless email) auth: adds complexity without clear benefit for v1
- SMS/phone auth: requires telephony provider, not justified for v1 user base
- Social login other than Google: no Facebook, Apple, GitHub, or other OAuth providers
- 2FA/MFA: not implemented in v1
- SSO/SAML: enterprise feature, out of scope for high school theater use case
- Admin panel for user management: Director manages members via the production roster, no separate admin UI

## Success Metric

No unauthenticated request can access protected data. No user can perform an action their role does not permit. No timing difference or response variation reveals whether an email exists in the system.

## Immutable Constraints

- bcrypt cost factor 12 for all password hashing. No lower cost factor permitted
- Session tokens are 256-bit cryptographically random (32 bytes, hex-encoded)
- Invite tokens are minimum 32 characters, cryptographically random, URL-safe
- Rate limit: 5 login attempts per minute per IP. Returns 429
- Account lockout: 10 failed attempts within 15 minutes triggers 30-minute lock
- CSRF protection on all state-changing POST/PUT/DELETE requests
- HTTP security headers (CSP, X-Frame-Options, HSTS, etc.) on all responses

---

## 1. Overview

The Digital Call Board supports two authentication methods:
1. **Google OAuth 2.0** — primary, recommended
2. **Email + Password** — fallback for users without Google accounts

All user sessions are stored server-side in PostgreSQL. Auth state is managed via secure HTTP-only cookies.

## 2. Auth Flows

### 2.1 Google OAuth Flow

```
User clicks "Sign in with Google"
  -> Redirect to Google OAuth consent screen
  -> Google redirects back with auth code
  -> Server exchanges code for tokens
  -> Server looks up or creates user in DB
  -> Server creates session, sets cookie
  -> Redirect to dashboard
```

**Requirements:**
- Use Authorization Code flow (not implicit)
- Request scopes: `openid`, `email`, `profile`
- Store Google `sub` (subject ID) in `users.google_id` for account linking
- **CSRF protection:** OAuth flow MUST include a cryptographically random `state` parameter tied to the user's session. The callback MUST validate `state` before processing. Without this, an attacker can CSRF the callback to link their Google account to a victim's session
- **PKCE:** OAuth flow MUST use Proof Key for Code Exchange (PKCE) with S256 challenge method to prevent authorization code interception. If using NextAuth.js, verify PKCE is enabled — do not disable it
- **Safe account linking:** Only auto-link Google OAuth to an existing email/password account if the existing account has `email_verified = true` AND the Google ID token's `email_verified` claim is `true`. If either is unverified, create a separate account and prompt the user to verify and link manually. This prevents account takeover via a Google account registered with a victim's email address

### 2.2 Email + Password Flow

```
User enters email + password
  -> Server validates credentials
  -> bcrypt compare against stored hash
  -> Server creates session, sets cookie
  -> Redirect to dashboard
```

**Requirements:**
- Passwords hashed with **bcrypt** (cost factor 12)
- Minimum password length: 8 characters
- Password MUST be checked against a bundled list of the top 10,000 breached passwords. Reject matches with: "This password is too common. Choose a different one." No uppercase/number complexity rules (they don't improve security and frustrate users)

**Breached password list:** A static text file at `src/lib/data/breached-passwords.txt` containing the 10,000 most common passwords (one per line, lowercase). Source: NCSC/Have I Been Pwned top passwords list. Loaded into a `Set<string>` at application startup. Check is case-insensitive (`breachedSet.has(password.toLowerCase())`). The file is committed to git (it contains no secrets).
- Email must be verified before full access (send verification email)
- **Per-IP rate limit:** 5 login attempts per minute per IP. Returns `429 Too Many Requests`
- **Per-account lockout:** After 10 failed login attempts within 15 minutes, lock the account for 30 minutes. Send an email notification to the user on lockout. Lockout is tracked via `failed_login_attempts` and `locked_until` columns on the users table
- **Anti-enumeration:** Login endpoint MUST return identical error responses for "email not found" and "wrong password": `401 — Invalid email or password`. Registration endpoint MUST NOT reveal whether an email is already registered — respond with "Check your email for a verification link" regardless of whether the email exists

### 2.3 Registration Flow

```text
User clicks "Create Account"
  -> Enter: name, email, date of birth, password (or Google OAuth)
  -> Age gate: if DOB indicates under 13, block registration immediately
  -> If 13+: derive age_range ("13-17" or "18+"), discard raw DOB
  -> Server creates user record (with age_range, NOT raw DOB)
  -> If email/password: send verification email
  -> If Google OAuth: auto-verified
  -> Redirect to onboarding (add theater/school)
```

### 2.3.1 Email Verification Token

When a user registers with email/password, a verification email is sent with a token.

**Requirements:**
- Verification token: 256-bit cryptographically random, URL-safe encoded
- Token is hashed with SHA-256 before storage in DB (same pattern as password reset)
- Token expires after **24 hours**
- Token is single-use — deleted on successful verification
- Verification link format: `/verify-email?token=xxx` (query param, same cleanup pattern as invite links)
- If token is expired: "This verification link has expired. Request a new one."
- Users can request a new verification email from the login page (rate limited: 3 per hour per email)
- Until verified, the user can log in but sees a banner: "Please verify your email to access all features." They cannot create a theater or production until verified

**Unverified users and invite links:** If a user registers via email/password after clicking an invite link, the production_id is preserved in their session. The user is auto-joined to the production immediately — joining does NOT require email verification. Unverified Cast members CAN: view the bulletin board, view the schedule, set up their profile, and submit conflicts. Unverified Cast members CANNOT: create a theater, create a production, post to the bulletin board, or send chat messages. A verification banner is shown on all pages until the user verifies their email.

**Schema:** Reuses the same token pattern. Add `email_verification_tokens` table:

```sql
CREATE TABLE email_verification_tokens (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash TEXT UNIQUE NOT NULL,  -- SHA-256 hash of raw token
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '24 hours'),
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

### 2.4 Invite Link Flow

There is a **single invite link** per production. Everyone who joins via this link enters as **Cast** by default. The Director can later elevate any Cast member to Staff from the roster. There are no separate Staff invite links.

```
Director copies invite link from production page
  -> Sends link via email/text to cast and potential staff
  -> User clicks link: /join?token=abc123def
  -> Server validates token, stores production_id in session, redirects to /join (clean URL)
  -> If not logged in: shown login/register page
  -> After auth: auto-joined to the production as Cast role
  -> Redirected to cast profile setup (if first time) then bulletin board
```

**Requirements:**
- Invite tokens are unique, random, URL-safe strings (min 32 chars)
- Tokens are tied to a specific production
- **Token passed as query parameter** (`/join?token=xxx`), NOT in the URL path. Server validates and redirects to clean URL immediately. This prevents tokens from persisting in browser history, Referer headers, and server access logs
- **Token expiry:** Tokens expire **30 days** after creation by default. Director can regenerate to create a fresh 30-day token. Expired tokens return: "This invite link has expired. Ask your director for a new link."
- **Usage cap:** Tokens have a `max_uses` limit (default: 100, configurable by Director). Once reached, the token is deactivated. This prevents leaked links from being used indefinitely
- One token per production (not per-user). All users enter as Cast role regardless of intended final role
- Director elevates Cast to Staff after they join — see SPEC-001 Section 3.2

### 2.5 Password Reset Flow

```
User clicks "Forgot password?"
  -> Enters their email address
  -> Server sends a password reset email (regardless of whether the email exists — anti-enumeration)
  -> Email contains a reset link with a single-use token
  -> User clicks link, enters new password
  -> Server validates token, updates password hash, invalidates ALL existing sessions for that user
  -> Redirect to login page
```

**Requirements:**
- Reset token: 256-bit cryptographically random, URL-safe encoded
- Token is hashed with SHA-256 before storage in DB (raw token is never stored)
- Token expires after **1 hour**
- Token is single-use — deleted immediately after successful password reset
- All existing sessions for the user are deleted on reset (forces re-login on all devices)
- Rate limit: max 3 reset requests per email per hour

### 2.6 Email Delivery

All transactional emails (verification, password reset, lockout notification) are sent via **Nodemailer** using SMTP.

**Requirements:**
- Transport: SMTP with TLS (port 587)
- From address: configured via `EMAIL_FROM` environment variable
- Emails are plain text + HTML (dual format for compatibility)
- Email sending failures MUST be logged at `error` level but MUST NOT block the user action (registration succeeds even if the verification email fails to send — user can request a resend)
- Rate limit: max 5 emails per hour per email address
- No email content is logged (PII scrubbing applies)

**Provider:** Configure via `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD` environment variables. The application MUST work with any standard SMTP provider.

**Templates (minimal — no complex HTML):**
- **Verification:** "Click this link to verify your email: {url}. This link expires in 24 hours."
- **Password reset:** "Click this link to reset your password: {url}. This link expires in 1 hour. If you did not request this, ignore this email."
- **Lockout notification:** "Your account has been temporarily locked due to too many failed login attempts. It will automatically unlock in 30 minutes. If this wasn't you, reset your password."

## 3. Authorization (Role-Based Access Control)

### 3.1 Roles

| Role | Level | Assigned By | Entry Path |
|------|-------|-------------|------------|
| Director | Owner | Self (account creator) | Registers directly |
| Staff | Admin | Director elevates a Cast member | Invite link -> Cast -> Elevated |
| Cast | Member | Joins via invite link | Invite link (default role) |

Everyone who joins via invite link starts as Cast. Director promotes Cast to Staff and can demote back to Cast at any time. See SPEC-001 Section 3.2.

### 3.2 Permission Matrix

| Action | Director | Staff | Cast |
|--------|----------|-------|------|
| Create theater/school | Yes | No | No |
| Create production | Yes | No | No |
| Edit production details | Yes | Yes | No |
| Edit schedule | Yes | Yes | No |
| Post to bulletin board | Yes | Yes | No |
| View bulletin board | Yes | Yes | Yes |
| View full cast conflicts | Yes | Yes | No |
| Submit personal conflicts | No | No | Yes (once) |
| View personal schedule | Yes | Yes | Yes |
| Chat with anyone | Yes | Yes | No |
| Chat with Staff/Director | Yes | Yes | Yes |
| Chat with other Cast | No | No | No |
| Elevate Cast to Staff | Yes | No | No |
| Demote Staff to Cast | Yes | No | No |
| Remove member from production | Yes | No | No |
| Reset cast member's conflicts | Yes | No | No |
| Generate invite link | Yes | Yes | No |
| Delete production | Yes | No | No |

### 3.3 Middleware

Every protected route checks:
1. Is the user authenticated? (valid session cookie)
2. Does the user belong to this production?
3. Does the user's role permit this action?

If step 1 fails, return `401 Unauthorized`. If step 2 fails, return `403 Forbidden`. If step 3 fails, return `403 Forbidden`.

### 3.4 API Error Response Format

All API endpoints MUST return errors in a consistent JSON format:

```json
{
  "error": "ERROR_CODE",
  "message": "Human-readable description"
}
```

**Standard error codes:**

| HTTP Status | Error Code | When |
|-------------|------------|------|
| 400 | `VALIDATION_ERROR` | Invalid input (missing fields, wrong types, exceeds max length) |
| 401 | `UNAUTHORIZED` | No valid session, expired session, invalid credentials |
| 403 | `FORBIDDEN` | Valid session but insufficient role/permission |
| 404 | `NOT_FOUND` | Resource does not exist |
| 409 | `CONFLICT` | Duplicate resource (e.g., conflicts already submitted) |
| 413 | `PAYLOAD_TOO_LARGE` | File upload exceeds size limit |
| 429 | `RATE_LIMITED` | Too many requests (login, chat, registration) |
| 500 | `INTERNAL_ERROR` | Unhandled server error (never expose stack traces to client) |

For validation errors, include a `fields` array with per-field details:

```json
{
  "error": "VALIDATION_ERROR",
  "message": "Invalid input",
  "fields": [
    { "field": "name", "message": "Must be 200 characters or fewer" },
    { "field": "opening_night", "message": "Must be on or after first rehearsal date" }
  ]
}
```

## 4. Session Management

- Sessions stored in PostgreSQL `sessions` table
- **Session token** (not the UUID primary key) is sent in the cookie. The token is a 256-bit cryptographically random string (`encode(gen_random_bytes(32), 'hex')`), stored in a `token` column on the sessions table. The UUID `id` is the internal primary key only and is never exposed to the client
- Cookie flags: `HttpOnly`, `Secure`, `SameSite=Lax`
- Session expiry: 30 days (rolling — refreshed on activity)
- **Rolling refresh:** On every authenticated API request, the server checks if the session expires within the next 7 days. If so, the `expires_at` is extended to `NOW() + 30 days`. This ensures active users are never unexpectedly logged out. "Activity" means any authenticated HTTP request — not WebSocket frames, not page loads without API calls.
- On logout: delete session row from DB and clear cookie
- **Log out all devices:** Users can trigger deletion of ALL their sessions from account settings. This invalidates every active session for that user across all browsers/devices

## 5. Security Requirements

- All auth endpoints over HTTPS (enforced by Vercel edge network + HSTS header)
- CSRF protection on all state-changing POST requests
- Passwords MUST NOT be logged. Passwords MUST NOT be exposed in API responses
- Google OAuth client secret stored in environment variable, never in code
- Rate limiting on login and registration endpoints
- Invite links do not reveal production details until authenticated

### 5.1 HTTP Security Headers

All responses MUST include the following headers (configured in `next.config.js` `headers()`):

| Header | Value | Purpose |
|--------|-------|---------|
| `Content-Security-Policy` | `default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' blob: data:; connect-src 'self' wss:` | Prevent XSS, restrict resource loading |
| `X-Frame-Options` | `DENY` | Prevent clickjacking |
| `X-Content-Type-Options` | `nosniff` | Prevent MIME sniffing |
| `Referrer-Policy` | `strict-origin-when-cross-origin` | Limit referrer leakage |
| `Strict-Transport-Security` | `max-age=31536000; includeSubDomains` | Force HTTPS |
| `Permissions-Policy` | `camera=(), microphone=(), geolocation=()` | Disable unnecessary browser APIs |

## 6. Database Schema (Auth-Related)

```sql
-- Cross-reference: full schema in SPEC-003
CREATE TABLE productions (id UUID PRIMARY KEY);

CREATE TABLE users (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email                 TEXT UNIQUE NOT NULL CHECK (char_length(email) <= 320),
  name                  TEXT NOT NULL CHECK (char_length(name) <= 200),
  password_hash         TEXT,                    -- NULL if Google-only auth
  google_id             TEXT UNIQUE,             -- NULL if email-only auth
  email_verified        BOOLEAN DEFAULT FALSE,
  avatar_url            TEXT,
  age_range             TEXT CHECK (age_range IN ('13-17', '18+')),  -- derived from DOB at registration, raw DOB discarded
  failed_login_attempts INTEGER DEFAULT 0,
  locked_until          TIMESTAMPTZ,             -- NULL if not locked
  created_at            TIMESTAMPTZ DEFAULT NOW(),
  updated_at            TIMESTAMPTZ DEFAULT NOW()
);

-- Auto-update updated_at on any row modification
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_users_updated_at
  BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE sessions (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  token      TEXT UNIQUE NOT NULL DEFAULT encode(gen_random_bytes(32), 'hex'),  -- 256-bit, this goes in the cookie
  user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_sessions_token ON sessions(token);

CREATE TABLE password_reset_tokens (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash   TEXT UNIQUE NOT NULL,             -- SHA-256 hash of the raw token (raw token never stored)
  expires_at   TIMESTAMPTZ NOT NULL,
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE production_members (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  production_id UUID NOT NULL REFERENCES productions(id) ON DELETE CASCADE,
  user_id       UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role          TEXT NOT NULL DEFAULT 'cast' CHECK (role IN ('director', 'staff', 'cast')),
  joined_at     TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(production_id, user_id)
);

CREATE TABLE invite_tokens (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  production_id UUID NOT NULL REFERENCES productions(id) ON DELETE CASCADE,
  token         TEXT UNIQUE NOT NULL,
  expires_at    TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '30 days'),
  max_uses      INTEGER NOT NULL DEFAULT 100,
  use_count     INTEGER NOT NULL DEFAULT 0,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);
```

### 6.1 Schema Notes

- **Session token vs ID:** The `sessions.token` column is the value stored in the cookie. The `sessions.id` UUID is internal only, never exposed to the client. Token lookups use `idx_sessions_token`
- **Password reset tokens:** The raw token is sent in the email link. Only the SHA-256 hash is stored in the DB. On reset, the server hashes the incoming token and compares against `token_hash`
- **Director auto-join:** When a Director creates a production, the server MUST automatically insert a `production_members` row with `role = 'director'` for that user and production. This ensures the Director passes the same membership checks as all other users. Without this row, the Director would fail their own production access middleware.
- **Invite token expiry:** `expires_at` defaults to 30 days. `use_count` is incremented on each join. Token is invalid when `expires_at < NOW()` OR `use_count >= max_uses`
- **Account lockout:** `locked_until` is set to `NOW() + 30 minutes` after 10 failed attempts. `failed_login_attempts` resets to 0 on successful login. Login endpoint checks `locked_until > NOW()` before validating credentials
- **Age range:** Raw date of birth is used only for the age gate check at registration. Only the derived `age_range` is persisted. The raw DOB is never stored
- **updated_at trigger:** The `set_updated_at()` function is reused across all tables with `updated_at` columns (users, productions, bulletin_posts)

## 7. Test Scenarios

| ID | Scenario | Expected Result |
|----|----------|-----------------|
| AUTH-01 | Register with email/password | User created, verification email sent |
| AUTH-02 | Register with Google OAuth | User created, auto-verified |
| AUTH-03 | Login with correct password | Session created, token cookie set, redirect to dashboard |
| AUTH-04 | Login with wrong password | 401 "Invalid email or password", no session |
| AUTH-05 | Login rate limit exceeded (5/min/IP) | 429 Too Many Requests |
| AUTH-06 | Access protected route without session | 401 redirect to login |
| AUTH-07 | User clicks invite link, not logged in | Redirect to login, then auto-join as Cast |
| AUTH-08 | User clicks invite link, already logged in | Auto-join as Cast, redirect to profile setup |
| AUTH-09 | Director generates new invite link | Old token invalidated, new token active |
| AUTH-10 | Cast tries to access Director-only route | 403 Forbidden |
| AUTH-11 | Google OAuth with existing verified email | Accounts linked |
| AUTH-12 | Session expired | Redirect to login |
| AUTH-13 | Google OAuth with existing UNVERIFIED email | Separate account created, no auto-link |
| AUTH-14 | Password reset happy path | Token emailed, new password set, all sessions invalidated |
| AUTH-15 | Password reset with expired token | 400 "Reset link has expired" |
| AUTH-16 | Account lockout after 10 failed attempts | Account locked 30 min, email notification sent |
| AUTH-17 | Log out all devices | All sessions deleted, all other browsers require re-login |
| AUTH-18 | Login with non-existent email | 401 "Invalid email or password" (same as AUTH-04) |
| AUTH-19 | Register with email that already exists | "Check your email for verification" (no leak) |
| AUTH-20 | Login with common breached password at registration | Rejected: "This password is too common" |
| AUTH-21 | Invite link expired (30+ days) | Error: "This invite link has expired" |
| AUTH-22 | Invite link max uses reached | Error: "This invite link is no longer available" |
| AUTH-23 | Director elevates Cast to Staff | Role updated in production_members |
| AUTH-24 | Director demotes Staff to Cast | Role updated back to cast |
| AUTH-25 | Director removes member from production | Member row deleted, user loses access |
| AUTH-26 | User under 13 tries to register | Blocked at age gate, no account created |
| AUTH-27 | Token in URL is cleaned on redirect | /join?token=xxx redirects to /join, token not in browser history |
| AUTH-28 | Email verification happy path — user clicks link | email_verified set to true, full access granted |
| AUTH-29 | Unverified cast member joins production via invite link | Auto-joined, can view bulletin/schedule, cannot chat or post |
