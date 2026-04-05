# SPEC-011: New Features (April 2026)

Features added after the initial 10 spec documents. These supplement the existing specs.

## 1. Teams System (supplements SPEC-003, SPEC-005)

### Data Model
- `Team`: id, production_id, name, created_at
- `TeamMember`: id, team_id, user_id, created_at

### Director/Staff Flow
- Create/delete teams from Members → Manage tab
- Assign cast via click-to-cycle pattern (optimistic local state + batch save)
- 8 distinct team colors for visual differentiation
- Send messages or post announcements to specific teams
- Team-based bulk assignment in schedule (collapsed groups with assign/remove all)

### Cast Impact
- Cast in the same team can message each other (relaxes cast-to-cast block)
- Team tab appears in right panel when user belongs to a team
- Chat contacts include teammates

### API Endpoints
- `GET /productions/{id}/teams` — list teams
- `POST /productions/{id}/teams` — create team
- `DELETE /productions/{id}/teams/{team_id}` — delete team
- `POST /productions/{id}/teams/{team_id}/members` — set members
- `POST /productions/{id}/teams/cycle-member` — cycle assignment
- `GET /productions/{id}/teams/my-team` — current user's team

---

## 2. Conflict Windows (supplements SPEC-006)

### Concept
Cast get 1 initial conflict submission + N extra windows (configurable by director).

### Data Model
- `Production.extra_conflict_windows` — global default (integer, default 0)
- `ProductionMember.extra_conflict_windows` — per-member override (nullable)
- `ProductionMember.conflicts_used` — tracks extra windows consumed
- `ConflictSubmission.window_index` — which window (0=initial, 1+=extra)
- Unique constraint on `conflict_submissions` REMOVED (allows multiple)

### Director Settings
- Global setting in Production Settings page
- Per-member override via PUT `/members/{user_id}/conflict-windows`

### Cast Flow
- Dashboard "My Info" card shows "Conflict Windows: X / Y"
- Submit button: "Submit Conflicts" → "Submit New Conflicts (N)" → greyed out at 0
- After initial submission: existing conflicts shown + new submission form

### API
- `GET /productions/{id}/conflicts/status` — returns remaining_windows, total_windows, has_initial_submission

---

## 3. Email Notifications (new)

### Provider
Resend SDK (Python). Free tier: 3,000 emails/month.

### Templates
- Invite: join a production via link
- Announcement: bulletin post notification
- Team message: broadcast notification
- Conflict reminder: nudge to submit
- Email verification: registration flow
- Password reset: forgot password flow
- Direct email: director → cast

### Configuration
- `RESEND_API_KEY` env var activates real sending
- Without it, emails are logged to console (dev mode)
- `email_from`: noreply@callboard.deetalk.win
- Users toggle `email_notifications` in Account settings
- Only opted-in users receive notification emails

### Wired Flows
- Bulletin posts with `notify_members=true` send to all opted-in members
- Registration creates EmailVerificationToken + sends verification email
- Forgot password creates PasswordResetToken + sends reset email

---

## 4. COPPA Compliance (supplements SPEC-002)

### Age Gating
- Registration: DOB required, must be 13+
- Only `age_range` stored ("13-17" or "18+"), never raw DOB
- Google OAuth users prompted for DOB on Account page

### Emergency Contacts
- `EmergencyContact` model: name, email, phone, relationship, contact_order
- 2 slots per user (1 required for minors, 1 optional)
- Relationship options: Parent, Guardian, Spouse, Sibling, Other
- GET/PUT `/auth/emergency-contacts`

### Parental Consent
- Minors (13-17) see consent section in Account page
- `User.parental_consent` boolean recorded on emergency contact save

### Audit Logging
- `AuditLog` model: user_id, actor_id, action, resource_type, resource_id, details, ip_address, created_at
- Logged actions: register, login, login_failed, password_change, password_reset, account_delete, profile_update, email_pref_change, parental_consent, parent_email_set, age_verified, data_export, data_deletion, member_blocked, member_removed, conflicts_submitted, email_sent

### Profile Completion
- "No age" badge on member cards in Roster
- "Complete your profile" banner on Account page when age_range is null
- `profile_complete` field returned from members API

---

## 5. Block/Ban (supplements SPEC-003)

### Data Model
- `BlockedMember`: id, production_id, user_id, blocked_by, reason, blocked_at

### Rules
- Director only
- Cannot block yourself or another director
- Blocked = removed from production + cannot rejoin via invite
- Join endpoint checks BlockedMember before allowing entry

### API
- `POST /members/{user_id}/block` — block (with optional reason)
- `POST /members/{user_id}/unblock` — unblock
- `GET /members/blocked` — list blocked (director only)

### UI
- "Ban" button on member cards in Roster
- Blocked members section at bottom of Roster with unblock buttons

---

## 6. Production Lifecycle (supplements SPEC-003)

### Expiry Detection
- When `closing_night < today`, dashboard shows banner
- Director options: extend (PATCH closing_night) or archive
- Cast/staff see "closing night passed" notice

### Extension
- PATCH `/productions/{id}` accepts `closing_night` field
- Must be on or after opening_night

---

## 7. Dark/Light Mode (supplements SPEC-009)

### Architecture
- `ThemeProvider` context with localStorage persistence (`dcb-theme` key)
- 60+ CSS custom properties in `:root` (dark) and `.light`
- `[data-chalkboard]` CSS scope forces light-on-dark inside chalkboard in light mode

### Dark Mode
- Green chalkboard, dark flight-case panels, gold accents
- Default theme

### Light Mode
- Brushed silver/steel panels (same flight-case aesthetic under stage lights)
- Blackboard stays dark (bright room aesthetic)
- Deep bronze gold accent for contrast
- Toggle in sidebar

---

## 8. Avatar System (supplements SPEC-002)

### Options
12 presets: Initials (default) + Theater Mask, Star, Music, Spotlight, Microphone, Ticket, Rose, Crown, Drama, Film, Palette

### Storage
`User.avatar_url` field stores avatar ID (e.g., "theater-mask") or null for initials

### Components
- `AvatarPicker` — grid of options, auto-saves on click
- `AvatarDisplay` — renders icon or 2-letter initials, 3 sizes

---

## 9. Responsive Design (supplements SPEC-009)

### Breakpoints
- Mobile: <768px — bottom nav, drawer, compact calendar
- Tablet: 768-1023px — left panel + drawer
- Desktop: ≥1024px — full 3-column with draggable panels

### Key Adaptations
- Calendar: hide time in notes, smaller font on mobile
- Dialog: viewport-width on mobile, max-w-md on desktop
- Tour tooltips: responsive padding/font/maxWidth on <640px
- Content area: pb-20 on mobile for bottom nav clearance
- Productions grid: sm:grid-cols-2
- Emergency contacts: sm:grid-cols-2 for email/phone fields

---

## 10. Chat Enhancements (supplements SPEC-005)

### Team Grouping
- Conversations grouped by team in chat list
- Collapsed by default, click to expand
- Unread badge per team group

### New Message Dialog
- Teams section (bulk send) for director/staff
- Staff & Direction section
- Individual Cast section
- "All Cast" broadcast option

### Message vs Announcement
- Toggle in team Manage tab
- Message: DMs each team member
- Announcement: posts to bulletin

### Timestamps
- Actual time (2:30 PM) instead of relative ("4 hours ago")

### No Message Deletion
- Removed for audit trail compliance

---

## 11. Navigation Improvements

### Back Buttons
- ChatConversation → chat list
- NewTheater → dashboard
- NewProduction → dashboard
- CastProfile → production dashboard
- ForgotPassword → login
- ResetPassword → login

### Account Page
- Accessible within production context (`/production/:id/account`)
- Side nav stays visible

### Productions Button
- "← Productions" in sidebar bottom
- Always visible when inside a production

### Members Page
- Renamed: "Production Roster"
- Tabs: Roster | Manage
- Member count persists across tabs

---

## 12. Notification Auto-Prompt

On first production entry, browser notification permission dialog appears after 3-second delay. Once per session (sessionStorage).
