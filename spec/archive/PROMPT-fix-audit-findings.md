# PROMPT: Fix All AUDIT-001 Findings

Copy everything below the line and paste it as your next prompt.

---

Read the audit report at `spec/AUDIT-001-spec-review.md` in full. Then apply ALL 35 findings to the corresponding spec files. Here are your exact instructions:

## Rules

1. **Edit the existing spec files in-place** — do NOT create new spec files unless explicitly needed.
2. **After editing each spec, re-read it** to verify your changes landed and the document is internally consistent.
3. **Do not remove existing content** — add to it, refine it, or add new sections. If a finding contradicts existing text, update the existing text.
4. **Every schema change must update the SQL** in the spec where it appears.
5. **Every new behavior must have a test scenario** added to the spec's test table.
6. When done, produce a verification table (per AGENT.md §1.1 format) showing each finding and its status.

## Findings to Apply

### SPEC-001 (Product Overview)

- **FINDING-02**: Add a new **Section 7: Data Privacy & Compliance**. Include: age gate (must be 13+ to register, recommended 16+ to avoid COPPA), data retention policy (PII deleted 90 days after production closes), right to deletion, privacy policy requirement, note that DOB could be replaced with "grade level" to reduce PII exposure. State that headshots are optional and users must consent to image storage.

### SPEC-002 (Auth)

- **FINDING-01**: In Section 2.1, change the account linking rule: "Only auto-link Google OAuth to an existing email/password account if the existing account has `email_verified = true` AND the Google ID token's `email_verified` claim is `true`. Otherwise, create a separate account and prompt the user to verify and link manually." Add test scenario AUTH-13.

- **FINDING-05**: In Section 2.1, add requirements: "OAuth flow MUST include a cryptographically random `state` parameter tied to the user's session to prevent CSRF on the callback. OAuth flow MUST use PKCE with S256 challenge method. If using NextAuth.js, verify these are enabled by default — do not disable them."

- **FINDING-06**: In Section 4 and Section 6, change session token strategy: Add a `token TEXT UNIQUE NOT NULL DEFAULT encode(gen_random_bytes(32), 'hex')` column to the sessions table. The cookie carries this `token`, NOT the UUID `id`. The UUID is the internal primary key only. Update the session management description accordingly.

- **FINDING-07**: Add a new **Section 2.5: Password Reset Flow**. Flow: user enters email -> server sends reset link with a single-use token (256-bit random, hashed in DB with SHA-256, expires in 1 hour) -> user clicks link, enters new password -> server validates token, updates password hash, deletes token, invalidates all existing sessions for that user. Add `password_reset_tokens` table to schema. Add test scenarios AUTH-14 (happy path) and AUTH-15 (expired token).

- **FINDING-12**: In Section 2.2, add: "Per-account lockout: after 10 failed login attempts within 15 minutes, lock the account for 30 minutes. Send an email notification on lockout." Add `failed_login_attempts INTEGER DEFAULT 0` and `locked_until TIMESTAMPTZ` columns to users table. Add test scenario AUTH-16.

- **FINDING-13**: In Section 2.2, add: "Login endpoint MUST return identical error responses for 'email not found' and 'wrong password': `401 — Invalid email or password`. Registration endpoint MUST NOT reveal whether an email is already registered: respond with `Check your email for a verification link` regardless."

- **FINDING-14**: In Section 2.2, update password policy: "Minimum 8 characters. Server MUST check password against a bundled list of the top 10,000 breached passwords and reject matches with error: `This password is too common. Choose a different one.` No complexity rules (uppercase/number requirements do not improve security)."

- **FINDING-15**: In Section 4, add: "Users can 'Log out of all devices' which deletes all rows from `sessions` where `user_id` matches. This action is available on the user's account settings page." Add test scenario AUTH-17.

- **FINDING-16**: In Section 2.4, change invite link handling: "Invite tokens are passed as a query parameter (`/join?token=xxx`), NOT in the URL path. The server validates the token, stores the production ID in the user's session, then immediately redirects to `/join` (clean URL). This prevents the token from persisting in browser history, Referer headers, and server access logs. The token is consumed from the URL on first load."

- **FINDING-17**: Add a new **Section 6: Security Headers** (renumber existing Section 6 to Section 7). Specify: `Content-Security-Policy: default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' blob: data:; connect-src 'self' wss:`, `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`, `Strict-Transport-Security: max-age=31536000; includeSubDomains`, `Permissions-Policy: camera=(), microphone=(), geolocation=()`. Note: these go in `next.config.js` `headers()`.

- **FINDING-18**: In the database schema section, add a note: "All tables with `updated_at` columns MUST have either a PostgreSQL trigger (`CREATE TRIGGER set_updated_at BEFORE UPDATE ... SET NEW.updated_at = NOW()`) or use the ORM's built-in auto-update annotation (Prisma `@updatedAt`, Drizzle `.$onUpdate()`). Specify the trigger SQL."

### SPEC-003 (Director Flow)

- **FINDING-08**: In Section 6.2, replace "rich text" with: "Posts use **Markdown** format. The server renders Markdown to HTML using a safe renderer that strips all raw HTML tags. Allowed formatting: bold, italic, headings, lists, links (with `rel=noopener noreferrer`), and line breaks. No embedded images, iframes, or scripts. Sanitization happens server-side before storage."

- **FINDING-19**: Add a new **Section 8.1: Input Validation Constraints** (before the existing Section 9). Define max lengths for ALL text fields: theater name (200 chars), city (100 chars), state (100 chars), production name (200 chars), bulletin post title (200 chars), bulletin post body (10,000 chars), rehearsal note (1,000 chars). Add CHECK constraints to all SQL CREATE TABLE statements. Add test scenario DIR-14: "Input exceeding max length is rejected with 400."

- **FINDING-20**: In Section 4, add validation rules: "`first_rehearsal` MUST be on or before `opening_night`. `opening_night` MUST be on or before `closing_night`. All dates must be in the future (at time of creation). Add CHECK constraints to the `productions` table: `CHECK (first_rehearsal <= opening_night)`, `CHECK (opening_night <= closing_night)`." Add test scenario DIR-15: "Production with first_rehearsal after opening_night is rejected."

- **FINDING-21**: In Section 5, add a new subsection **5.1: Edge Cases & Precedence Rules**: "Tech week overrides the day-of-week filter (rehearsals happen every day during tech week regardless of selected days). Blocked dates override tech week (if a blocked date falls within tech week, that date is skipped and a warning is surfaced to the Director). Dress rehearsal is the last N days of tech week (subset, not additional). If no valid rehearsal dates remain after filtering, show an error: 'No rehearsal dates could be generated. Please adjust your settings.' If tech week would extend before the first rehearsal date, clamp it to start at first_rehearsal." Add test scenarios DIR-16, DIR-17, DIR-18.

- **FINDING-30**: In Section 8 (database schema), add to the `theaters` table section: "All API endpoints that modify a theater or its child resources MUST verify `theaters.owner_id = authenticated_user.id`. This check is enforced in middleware, not just at the query level." Add test scenario DIR-19: "Non-owner attempts to modify theater → 403."

### SPEC-004 (Cast Flow)

- **FINDING-09**: In Section 3, update the headshot/photo field: "**Image Upload Requirements:** Max file size 5MB. Allowed types: JPEG and PNG only (validated by checking file magic bytes, not just extension). Server MUST strip EXIF metadata (may contain GPS coordinates). Server generates a random filename (UUID) — original filename is discarded. SVG and GIF are NOT allowed. Images are stored in a dedicated upload directory, served with `Content-Disposition: inline` and `X-Content-Type-Options: nosniff`. Content-Type is set based on detected magic bytes, not the upload's claimed type."

- **FINDING-22**: In Section 4.2, add: "**Race Condition Handling:** The `INSERT INTO conflict_submissions` is the authoritative guard against double submission, not the pre-check SELECT. If the INSERT raises a unique constraint violation (duplicate `production_id, user_id`), the API returns `409 Conflict` with message `Conflicts already submitted.` The entire conflict submission (both `conflict_submissions` insert and all `cast_conflicts` inserts) MUST be wrapped in a single database transaction. If any insert fails, the entire submission rolls back."

- **FINDING-23**: Add a new **Section 4.4: Director Conflict Reset**. "The Director can reset a cast member's conflict submission, allowing them to re-submit. This action deletes the cast member's row from `conflict_submissions` and all their rows from `cast_conflicts` for that production. The cast member is notified (via bulletin board system post or in-app notification) that their conflicts have been reset and they should re-submit. This is irreversible for the Director — the old conflict data is gone." Add test scenarios CAST-13 and CAST-14.

### SPEC-005 (Chat)

- **FINDING-10**: In Section 4, add a new subsection **4.1: WebSocket Authentication**. "WebSocket upgrade requests MUST be authenticated. On connection, the server validates the session cookie (or a short-lived WebSocket ticket obtained via an authenticated HTTP endpoint). If authentication fails, the server rejects the upgrade with HTTP 401. Sessions are re-validated every 5 minutes during an active WebSocket connection. If a session expires or is revoked mid-connection, the server closes the WebSocket with code 4401 and the client must re-authenticate."

- **FINDING-24**: In Section 4, add: "**Rate Limiting:** Max 30 messages per minute per user across all conversations. Exceeding the limit returns a WebSocket error frame or HTTP 429. Rate limit state is tracked server-side (in-memory or Redis)." Add test scenario CHAT-11.

- **FINDING-25**: In Section 3.1, add: "**Conversation Deduplication:** Before creating a new conversation, the server MUST check if a conversation already exists between the same two participants in the same production. Use a `SELECT` with a lock (`FOR UPDATE`) wrapped in a transaction. If found, return the existing conversation. The application MUST handle the race condition where two requests simultaneously try to create a conversation between the same pair." Add a composite unique constraint or a lookup function to the schema section.

### SPEC-006 (Schedule)

- **FINDING-26**: In Section 5, change the "Remove rehearsal date" row: "**Soft-delete instead of hard-delete.** Add `is_deleted BOOLEAN DEFAULT FALSE` and `deleted_at TIMESTAMPTZ` to `rehearsal_dates`. Removing a date sets `is_deleted = TRUE`. Deleted dates are hidden from cast schedule views but conflicts remain queryable by the Director for historical reference. The Director can also hard-delete (permanently remove) if explicitly confirmed. Update the `rehearsal_dates` CREATE TABLE statement."

### SPEC-007 (Infrastructure)

- **FINDING-03 + FINDING-11**: In Section 4.3, update the docker-compose.yml: Remove `ports` from the `db` service entirely. Change `app` service ports to `"127.0.0.1:3000:3000"` (localhost only, for dev access). Add a comment: "# In production, app is accessed only via Cloudflare Tunnel through Docker internal network. No ports exposed to 0.0.0.0."

- **FINDING-27**: Add `restart: unless-stopped` to all three services in the docker-compose.yml.

- **FINDING-28**: Change `cloudflare/cloudflared:latest` to a pinned version `cloudflare/cloudflared:2024.12.2`. Change `postgres:16-alpine` to `postgres:16.6-alpine`. Add a note: "Pin all Docker image tags to specific versions. Update deliberately, not automatically."

- **FINDING-29**: In Section 6.2, update backups: "Backups MUST be encrypted before writing to disk: `pg_dump -U callboard callboard | gpg --symmetric --cipher-algo AES256 --batch --passphrase-file /path/to/backup-key > backup-$(date +%Y%m%d).sql.gpg`. The backup passphrase is stored in a separate location from the backups. Unencrypted backups MUST NOT exist on disk."

- **FINDING-32**: Add a new **Section 9: Logging**. "Application logs are structured JSON. Log levels: `info` (requests, auth events), `warn` (rate limits hit, validation failures), `error` (unhandled exceptions, DB connection failures). PII scrubbing: email addresses are masked (`d***@example.com`), session tokens and invite tokens are redacted entirely. Docker log driver: `json-file` with `max-size: 10m` and `max-file: 3` on all services. Never log: passwords, full tokens, request bodies containing PII."

- **FINDING-33**: In Section 4.3, add a note after the docker-compose.yml: "**App-to-DB TLS:** Not configured in v1. Accepted risk for single-host Docker deployment where app and db share a Docker bridge network. If services are ever split across hosts or networks, add `?sslmode=require` to DATABASE_URL and configure PostgreSQL TLS certificates."

- **FINDING-34**: Add a `healthcheck` block to the db service in the docker-compose.yml:
```yaml
healthcheck:
  test: ["CMD-SHELL", "pg_isready -U callboard"]
  interval: 10s
  timeout: 5s
  retries: 5
```

### SPEC-008 (TDD)

- **FINDING-35**: In Section 4 (Test Organization), add a new directory:
```
tests/
  security/
    injection.test.ts       — SQL injection attempts on all endpoints
    xss.test.ts             — XSS payloads in bulletin posts, profiles, chat messages
    idor.test.ts            — Accessing other productions' data via direct API calls
    csrf.test.ts            — State-changing requests without CSRF token
    upload.test.ts          — Malicious file uploads (SVG with script, oversized, wrong type)
    auth-bypass.test.ts     — Expired sessions, tampered cookies, missing auth
    rate-limit.test.ts      — Exceeding rate limits on login, chat, registration
    enum.test.ts            — Email enumeration via login/register response differences
```
Add to the Test-to-Spec Mapping table:
```
| Security | tests/security/*.test.ts | SEC-01 through SEC-10 |
```
Add these test scenario IDs to a new **Section 11: Security Test Scenarios** table:
| SEC-01 | SQL injection in production name field | Input sanitized, no DB error |
| SEC-02 | XSS script tag in bulletin post body | Script stripped by sanitizer |
| SEC-03 | Cast accesses Director's production endpoint (IDOR) | 403 Forbidden |
| SEC-04 | State-changing POST without CSRF token | 403 Forbidden |
| SEC-05 | Upload SVG with embedded JavaScript | Rejected — JPEG/PNG only |
| SEC-06 | Upload file exceeding 5MB | Rejected with 413 |
| SEC-07 | Expired session token used for API call | 401, redirect to login |
| SEC-08 | Tampered session cookie | 401, session not found |
| SEC-09 | 100 login attempts in 1 minute | Rate limited after 5, locked after 10 |
| SEC-10 | Login with non-existent email vs wrong password | Identical 401 response |

## Verification

After all edits, produce a verification table:

| # | Finding | Spec | Status | Evidence |
|---|---------|------|--------|----------|
| 1 | ... | SPEC-002 | VERIFIED / NOT DONE | Re-read file:line, confirmed change present |
| ... | ... | ... | ... | ... |
| 35 | ... | SPEC-008 | VERIFIED / NOT DONE | ... |
