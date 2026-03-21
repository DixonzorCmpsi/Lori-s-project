# Digital Call Board — Agent Rules (`AGENT.md`)

This document defines the strict operational rules for any AI agent (Claude, Codex, Cursor, Copilot) contributing to this repository. **Adherence is non-negotiable.**

---

## 0. Product Vision

**Digital Call Board** is a web app replacing the physical backstage call board for theater productions. A Director creates a production, builds a rehearsal schedule, and shares an invite link. Cast members join, submit conflicts, and view announcements. The app feels like you're backstage at a theater — warm dark wood, cork bulletin boards, amber work lights.

**Stack:** Next.js 14+ App Router, TypeScript strict, Drizzle ORM, PostgreSQL 16, Tailwind CSS, shadcn/ui, ws (WebSocket), NextAuth.js, Supabase (prod DB + Storage + Realtime), Vercel (prod hosting), Docker (dev only).

**Three roles, no more:** Director (owner), Staff (elevated Cast), Cast (joined via link).

---

## 1. How to Read the Specs (Progressive Disclosure)

**DO NOT load all specs into context.** Use the manifest.

### The Workflow

1. **ALWAYS read first:** `spec/SPEC-MANIFEST.xml` (~300 lines). It contains the project summary, all database tables, per-spec section index with line numbers, task routing, and implementation phases.
2. **Identify your task** in the `<task-routing>` section. It tells you exactly which spec sections to read.
3. **Read ONLY the sections you need** using `Read(file, offset=line, limit=N)`. The manifest gives you the line numbers.
4. **Check `<immutable>` constraints** for every spec you touch. These are hard rules you CANNOT violate.
5. **Check `<non-goals>`** — if your task drifts into a non-goal, STOP.

### What NOT to do

- Do NOT read a full spec file unless doing a cross-cutting change
- Do NOT guess what a spec says — read it
- Do NOT add features not in the specs. The specs are the ceiling, not the floor
- Do NOT change the tech stack. It is decided: Drizzle (not Prisma), ws (not Socket.io), shadcn/ui (not Material/Chakra), Tailwind (not CSS-in-JS)

---

## 2. WWDD Gates (Anti-Hallucination Guardrails)

Before committing any code or proposing changes, you MUST pass these gates:

- [ ] **Does it stay local?** Avoid unnecessary external dependencies. Favor Node built-ins.
- [ ] **Is it spec-sourced?** Read the relevant spec section BEFORE implementing. Never implement from memory.
- [ ] **Does it respect immutable constraints?** Check the spec's Immutable Constraints section. If your change would violate one, STOP and flag it.
- [ ] **Is the security model intact?** Does your change handle untrusted input safely? All user input is untrusted. All text fields have max lengths. All file uploads are validated by magic bytes.
- [ ] **Did you VERIFY, not just claim?** Re-read the file after editing. See Section 3.

---

## 3. Verification Integrity (Anti-Lying Rules)

**NEVER claim a fix or task is "done" without physically verifying the result.**

### The Rules

1. **Re-read after every edit.** After modifying a file, re-read the relevant lines to confirm your change actually landed. Do NOT assume "I wrote it, so it's there."
2. **Per-item proof, not summary claims.** When fixing a list of issues, verify EACH item individually. Provide per-item status:
   - VERIFIED — Re-read `file:line` and confirmed change is present
   - NOT DONE — Unable to apply because [reason]
3. **No "Non-Goal" avoidance.** If a security audit identifies a flaw, you CANNOT "fix" it by adding it to Non-Goals. A vulnerability marked as non-goal is STILL a vulnerability.
4. **Cross-reference integrity.** If your change in one file affects behavior another file depends on, check the other file for contradictions.

### Reporting Template

When reporting on a set of fixes or tasks, use this format:

| # | Item | Status | Evidence |
|---|------|--------|----------|
| 1 | Add cast_profiles table | VERIFIED | Re-read SPEC-004:137-172, table present |
| 2 | Fix schedule color mismatch | VERIFIED | SPEC-006:54 now says Amber, matches SPEC-009:201 |
| 3 | Add password reset flow | NOT DONE | Requires email provider decision |

**NEVER replace this table with "all items fixed."**

---

## 4. TDD — Non-Negotiable

Every feature follows this cycle. No exceptions.

```
1. READ the spec section      — Know what to build
2. WRITE the test             — Define expected behavior in code
3. RUN tests -> RED           — Confirm the test fails (feature doesn't exist)
4. WRITE minimum code         — Just enough to make the test pass
5. RUN tests -> GREEN         — All tests pass (not just the new one)
6. REFACTOR                   — Clean up, keep tests green
7. COMMIT                     — Feature complete
```

**Never skip RED.** If the test passes before you implement, the test is wrong.

**Test placement:**
- Unit tests: `tests/unit/`
- Integration tests: `tests/integration/` (real PostgreSQL, not mocks)
- Security tests: `tests/security/` (mandatory, not optional)

**Test database:** `callboard_test` — separate from dev. Each suite wraps in a transaction that rolls back.

---

## 5. Directory Stewardship

| Directory | What It Contains | Read Before Touching |
|-----------|-----------------|---------------------|
| `src/app/(auth)/` | Auth pages (login, register, reset) | SPEC-002, SPEC-010 Sec 3.1-3.2 |
| `src/app/(dashboard)/` | Authenticated pages | SPEC-010 (relevant page section) |
| `src/app/api/` | API routes | SPEC-002 Sec 3.4 (error format), relevant spec |
| `src/components/ui/` | shadcn/ui primitives | SPEC-009 (don't add non-shadcn components) |
| `src/components/production/` | Production-specific components | SPEC-009 Sec 3, SPEC-010 wireframes |
| `src/components/chat/` | Chat components | SPEC-005, SPEC-010 Sec 3.9 |
| `src/lib/` | Shared utilities | SPEC-002 (auth), SPEC-009 (validators) |
| `src/styles/` | Global CSS + theme tokens | SPEC-009 Sec 4 (theater design system) |
| `tests/` | All tests | SPEC-008 Sec 4 (organization) |
| `spec/` | THE SOURCE OF TRUTH | Never modify without an audit |
| `docker-compose.yml` | Local dev database (PostgreSQL) | SPEC-007 Sec 4.3 |
| `Dockerfile` | Self-hosted fallback only (not used in Vercel production) | SPEC-007 Sec 7.4 |

---

## 6. Security Rules

These are non-negotiable. Violating any of these is a blocking issue.

### Input Validation
- All text fields have max lengths enforced at BOTH the API (Zod) and database (CHECK constraint) levels
- All file uploads validated by magic bytes, not file extension. JPEG/PNG only. 5MB max. EXIF stripped. UUID filenames
- All Markdown sanitized server-side BEFORE storage (strip raw HTML). Sanitization is NOT just on render
- Chat messages are plain text. HTML-escape on render to prevent XSS

### Authentication
- bcrypt cost 12 for password hashing. No lower
- Session tokens: 256-bit random. Cookie carries the token, not the UUID primary key
- OAuth: PKCE + state parameter required. Safe account linking only when both sides email_verified
- Invite tokens: 30-day expiry, max 100 uses, passed as query param (not URL path)
- Anti-enumeration: identical responses for "email not found" vs "wrong password"

### Authorization
- RBAC middleware on EVERY protected route: authenticate -> verify membership -> verify role
- Cast-to-cast messaging blocked at API level, not just UI
- Theater ownership verified on all theater/production modifications
- WebSocket connections authenticated on upgrade and re-validated every 5 minutes

### Infrastructure
- Supabase service role key NEVER exposed to client-side code (server-side only)
- All production env vars set in Vercel dashboard, never in code
- Supabase handles automated backups (daily, PITR on Pro)
- Database queries use Drizzle ORM ONLY — no supabase-js for data access
- Security headers (CSP, HSTS, X-Frame-Options) on all responses
- .env NEVER committed to git

---

## 7. Theme Rules

The app has a **theater backstage** visual identity. This is NOT a generic dark-mode SaaS app.

### Immutable Design Tokens
- **Backgrounds:** Warm dark tones (HSL hue 25-40), NOT cold blue-gray
- **Surfaces:** Wood-panel feel via CSS gradients (no image textures)
- **Bulletin posts:** Paper-pinned cards on cork board (slight rotation, drop shadow, pin dot)
- **Primary accent:** Amber work light (`hsl(38, 75%, 55%)`)
- **Headings:** Playfair Display serif (theater program feel)
- **Body text:** Libre Franklin sans-serif
- **Schedule dates:** Monospace (call sheet feel)

### What You Cannot Do
- Add a light mode or theme toggle
- Use cold blue or gray for backgrounds
- Use image files for textures (CSS-only)
- Replace Playfair Display or Libre Franklin fonts
- Use any component library other than shadcn/ui
- Use any CSS approach other than Tailwind

---

## 8. Implementation Phases

Build in this order. Do not skip ahead.

| Phase | Feature | Spec(s) |
|-------|---------|---------|
| 1 | Infrastructure (Supabase project, Vercel project, local dev DB, env config) | SPEC-007 |
| 2 | Auth (OAuth, email/password, sessions) | SPEC-002 |
| 3 | Director: Theater + Production CRUD | SPEC-003 |
| 4 | Director: Schedule Builder | SPEC-003, SPEC-006 |
| 5 | Invite Link + Cast Onboarding | SPEC-002, SPEC-004 |
| 6 | Cast: Conflict Submission | SPEC-004, SPEC-006 |
| 7 | Bulletin Board | SPEC-003, SPEC-004 |
| 8 | Chat System | SPEC-005 |
| 9 | Aggregated Conflict View | SPEC-006 |
| 10 | Polish (theme, responsive, a11y) | SPEC-009, SPEC-010 |

---

## 9. Spec Change Protocol

**Specs are the source of truth.** If the code contradicts the spec, fix the code, not the spec.

If you genuinely believe a spec is wrong:
1. Identify the exact section and quote the current text
2. Explain why it is wrong (bug, contradiction, impossible to implement)
3. Propose the exact new text
4. Check which other specs reference this section (use `<task-routing>` in the manifest)
5. **Do NOT change the spec yourself.** Flag it for human review.

---

## 10. Autoresearch Protocol

Inspired by [Karpathy's autoresearch](https://github.com/karpathy/autoresearch). Before implementing any feature, the agent runs a self-directed research loop to verify the spec is implementable.

### The Loop

```text
1. READ the spec section for the feature
2. IDENTIFY unknowns: any term, behavior, or edge case not fully defined
3. SEARCH the codebase and other specs to resolve unknowns
4. If unresolvable: FLAG to human (do NOT guess)
5. WRITE a test that encodes the spec's success metric
6. RUN test -> confirm RED (feature doesn't exist)
7. IMPLEMENT minimum code
8. RUN test -> confirm GREEN
9. VERIFY against immutable constraints (re-read the spec's constraints section)
10. If any constraint is violated: REVERT and redesign
```

### When to Trigger Autoresearch

- Before starting ANY implementation phase
- When a test fails unexpectedly (research why, don't just retry)
- When two specs seem to contradict each other
- When the manifest's line numbers don't match the file (re-index)

### What Autoresearch Produces

For each feature, the agent should be able to answer:

1. **What tables are touched?** (list from manifest `<database>` section)
2. **What API routes are needed?** (derive from spec behavior + SPEC-002 error format)
3. **What test scenarios apply?** (list IDs from the spec's test table)
4. **What immutable constraints apply?** (list from the spec header)
5. **What cross-spec dependencies exist?** (list from manifest `<task-routing>`)

If the agent cannot answer all 5 questions, it has not done enough research to start coding.

### Spec Quality Check (Run Periodically)

When modifying specs or after major implementation milestones, run this checklist:

| Criterion | Check |
|-----------|-------|
| Deterministic | Can two builders produce identical output from this spec? |
| Measurable | Does the success metric have a concrete pass/fail condition? |
| Constrained | Are immutable constraints specific enough to prevent drift? |
| Complete | Does every user action have a defined behavior + error case? |
| Cross-referenced | Do all specs that reference this section agree with it? |
| Testable | Does every behavior have a test scenario ID? |

If any criterion fails, the spec needs revision before implementation continues.

---

## 11. Commit Rules

- Write tests BEFORE implementation (TDD)
- One feature per commit. Do not bundle unrelated changes
- Commit message format: `feat|fix|test|infra|docs: short description`
- Never commit `.env`, `node_modules/`, `uploads/`, or backup files
- Never force-push to main
- Never skip pre-commit hooks
