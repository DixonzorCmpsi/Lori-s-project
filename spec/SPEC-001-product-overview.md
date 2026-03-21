# SPEC-001: Product Overview & User Roles

**Status:** Draft
**Last Updated:** 2026-03-21

---

## Goals (Immutable)

- Define exactly 3 user roles (Director, Staff, Cast) with explicit permission boundaries such that every possible user action maps to exactly one allow/deny per role
- Define a single invite link model: one link per production, all joiners enter as Cast, no secondary invite paths
- Define data privacy requirements for minors: age gate at 13+, no raw DOB storage, PII minimization
- Define the complete production lifecycle: create -> active -> archive -> PII deletion (90 days post-archive)

## Non-Goals (Explicit Exclusions)

- Multi-tenant SaaS: v1 is single-director focus; no org-level admin, no cross-director features
- Native mobile apps: v1 is web-only (responsive), no iOS/Android builds
- Audience-facing features: no public pages, no ticket buyers, no front-of-house users
- Payment or ticketing: no transactions, no Stripe, no box office integration
- Parent accounts: no parent/guardian role or linked accounts for minors
- Automated content moderation: no AI/ML filtering of posts or chat messages

## Success Metric

An AI reading only this spec can correctly answer "who can do what" for any action in the system without ambiguity — every action has a deterministic allow/deny for each of the 3 roles.

## Immutable Constraints

- Exactly 3 roles: director, staff, cast. No additional roles may be added
- Single invite link per production. No per-role or per-user invite links
- Age gate at 13+ (COPPA). Users under 13 are blocked at registration with no override
- 90-day PII deletion after production archive. No extension, no opt-out
- Cast cannot message cast. Chat is cast <-> director/staff only

---

## 1. Problem Statement

Theater productions rely on a physical "call board" backstage for schedules, announcements, and cast lists. This system is unreliable (members miss updates) and does not scale. Digital Call Board replaces the physical call board with a web application.

## 2. Product Name

**Digital Call Board**

## 3. Target Users

### 3.1 Primary User: Director (Owner)

The director is the **owner** of a production. They are the first person to create an account and set up the production.

**Capabilities:**
- Create and manage their account
- Add a theater/school (the venue)
- Create a production within that theater
- Build and manage the production schedule
- Post announcements to the bulletin board
- Chat with anyone in the production (cast, staff)
- Generate a single invite link to onboard cast and potential staff
- Elevate Cast members to Staff role (and demote back)
- Remove members from the production
- View all cast conflicts aggregated against the schedule
- Manipulate the schedule (change dates, add rehearsals)

### 3.2 Secondary User: Production Staff (Elevated Cast)

Staff members are **not a separate onboarding path**. There is **one invite link** for everyone. All users who join via the invite link enter as Cast. The Director can then **elevate** a Cast member to Staff, granting them admin-level privileges. Staff is not a separate account type — it is a role promotion within a production.

**How elevation works:**
- Director selects a cast member from the roster and promotes them to Staff
- The cast member's role changes from `cast` to `staff` in `production_members`
- The Director can demote a Staff member back to Cast at any time
- Elevation is per-production (a user can be Staff in one production and Cast in another)

**Capabilities (once elevated):**
- Same posting rights as Director on the bulletin board
- Can chat with anyone in the production
- Can view schedule and all cast conflicts
- Can generate invite links
- Cannot delete the production or theater
- Cannot remove the Director
- Cannot elevate and cannot demote other users (only Director can)

### 3.3 Tertiary User: Cast

Cast members join via an **invite link** shared by the Director. A production MUST support up to **100 cast members**.

**Capabilities:**
- Create a profile (name, phone, role/character, headshot — phone/role/headshot are not required)
- Submit conflicts **one time only** (cannot edit after submission)
- View the bulletin board (posters/announcements and schedule)
- View their personal schedule (general schedule + their conflicts overlaid)
- Chat with Staff and Director **only** (cannot chat with other cast members)

**Restrictions:**
- Cannot modify the schedule
- Cannot change submitted conflicts
- Cannot message other cast members
- No access code, no QR code required — just the invite link URL

## 4. User Hierarchy & Lifecycle

```
Everyone joins via the same invite link -> Cast (default role)
                                              |
                              Director promotes -> Staff (admin privileges)
                              Director demotes  -> Cast (back to default)

Director (Owner)
  |
  +-- Staff (elevated from Cast by Director)
  |
  +-- Cast (joined via invite link, default role)
```

There is only ONE invite link per production. Everyone enters as Cast. Staff is a promotion, not a separate entry point.

## 5. Scope

### In Scope (v1)
- Director account creation and production setup
- Schedule builder with smart questions
- Cast onboarding via invite link
- One-time conflict submission for cast
- Bulletin board with poster and schedule tabs
- Role-based chat (Director/Staff <-> Cast, no cast-to-cast)
- Dark-themed UI
- PostgreSQL database
- Supabase + Vercel production deployment
- Docker PostgreSQL for local development
- Custom domain via Cloudflare DNS (pointing to Vercel)

### Out of Scope (v1)
- Parent accounts
- Multiple simultaneous productions per director (future)
- Mobile native app (web-first, responsive)
- Payment/ticketing
- Audience-facing features
- Remind app API integration (future consideration)

## 6. Non-Functional Requirements

- **Target:** High school theater and above
- **Scale:** MUST support 100 cast members per production with no degradation in page load times (all pages MUST load within 2 seconds at 100 members)
- **Availability:** Hosted 24/7 via Vercel (auto-deploy from GitHub, edge network)
- **Theme:** Dark UI throughout the app (all backgrounds MUST use dark palette; no light mode in v1)
- **Security:** Auth via SPEC-002, role-based access per SPEC-002 Section 3.2, production data isolation per Section 7.5

## 7. Data Privacy & Compliance

### 7.1 Age Requirements

- Users MUST be **at minimum 13 years of age** to create an account (COPPA threshold)
- Registration flow includes a date-of-birth age gate that blocks users under 13
- The app does NOT collect data from children under 13 under any circumstance

### 7.2 Minimizing PII Collection

- **Date of birth** is collected ONLY for the age gate at registration. The app stores only the user's **age range** ("13-17" or "18+"), NOT the exact date of birth. The raw DOB is used for the age check and then discarded — it MUST NOT be persisted in the database
- **Phone number** is not required and stored only if the user provides it
- **Headshot/photo** is not required. Users MUST explicitly consent to image storage via a checkbox before upload. Images MUST be deletable by the user at any time
- The app does NOT collect: SSN, home address, financial information, or government ID

### 7.3 Data Retention & Deletion

- **Active productions:** All data is retained while a production is active
- **Closed productions:** When a Director archives a production, all associated PII (profiles, conflicts, chat messages) MUST be permanently deleted exactly **90 days** after `archived_at`. The Director MUST be shown a confirmation dialog before archival (see SPEC-003 Section 6.5)
- **Account deletion:** Any user can delete their account at any time. This MUST remove all their data across all productions (cascade delete via `ON DELETE CASCADE`). A confirmation dialog with the text "This will permanently delete your account and all associated data. This cannot be undone." MUST be shown before proceeding

### 7.4 Privacy Policy

- The app MUST display a privacy policy at registration (link, not full text)
- The privacy policy MUST disclose: what data is collected, how it is used, how long it is retained, and how users can request deletion
- The privacy policy MUST state that data is not sold to third parties

### 7.5 Data Isolation

- Production data is strictly isolated. A user in Production A cannot see any data from Production B
- Chat messages are scoped to a production and never cross production boundaries
- Invite links only grant access to the specific production they were created for
