# AUDIT-006: Hybrid Infrastructure Migration Consistency Audit

**Auditor:** GAN Round 6 (Senior Engineer)
**Date:** 2026-03-21
**Scope:** All specs reviewed for consistency with the hybrid model (Supabase + Vercel prod, Docker PostgreSQL dev)
**Trigger:** SPEC-007 rewritten for hybrid infrastructure; cross-spec consistency verification required

---

## Files Reviewed

| File | Scope of Review |
|------|-----------------|
| AGENT.md | Full |
| SPEC-MANIFEST.xml | Full |
| SPEC-001-product-overview.md | Scope and NFR sections |
| SPEC-002-auth.md | Email delivery, env vars, security section |
| SPEC-004-cast-flow.md | Section 3.1 (uploads) |
| SPEC-005-chat.md | Section 4 (realtime), moderation |
| SPEC-007-infrastructure.md | Full (rewritten) |
| SPEC-008-tdd.md | CI integration section |
| SPEC-009-frontend-architecture.md | Tech stack table |

---

## Findings

### 1. CONTRADICTIONS WITH OLD MODEL

| # | Severity | Spec Affected | Finding | Recommended Fix |
|---|----------|---------------|---------|-----------------|
| C-01 | **HIGH** | SPEC-001-product-overview.md:133-134 | Scope section still says "Docker containerized deployment" and "Cloudflare Tunnel to custom domain" as in-scope features. These describe the OLD self-hosted model, not the hybrid model. | Replace lines 133-134 with: "- Supabase + Vercel production deployment" and "- Docker PostgreSQL for local development". Optionally add "- Custom domain via Cloudflare DNS to Vercel". |
| C-02 | **HIGH** | SPEC-001-product-overview.md:148 | Non-functional requirements state "Hosted 24/7 via Cloudflare Tunnel". Production is now hosted via Vercel, not Cloudflare Tunnel. | Replace with: "Hosted 24/7 via Vercel (auto-deploy from main branch)". |
| C-03 | **HIGH** | SPEC-002-auth.md:293 | Security section states "All auth endpoints over HTTPS (enforced by Cloudflare Tunnel)". HTTPS is now enforced by Vercel's edge network, not Cloudflare Tunnel. | Replace with: "All auth endpoints over HTTPS (enforced by Vercel edge network + HSTS header)". |
| C-04 | **MEDIUM** | SPEC-008-tdd.md:193 | Implementation Order Phase 1 says "Infrastructure (Docker, DB, Cloudflare)". The hybrid model has no Cloudflare Tunnel setup phase. | Replace with: "Infrastructure (Supabase project, Vercel project, local dev DB, env config)" to match AGENT.md Phase 1. |
| C-05 | **MEDIUM** | SPEC-MANIFEST.xml:242 | The SPEC-007 section index still lists `<section name="Cloudflare Tunnel Setup" line="207" end="225" load="when-implementing-tunnel" />`. This section no longer exists in the rewritten SPEC-007. | Remove the Cloudflare Tunnel Setup section entry. Update ALL SPEC-007 section line numbers to match the rewritten file. Current manifest line numbers are entirely wrong for SPEC-007. See finding C-06. |
| C-06 | **HIGH** | SPEC-MANIFEST.xml:237-251 | Every SPEC-007 section line number in the manifest is stale. The rewritten SPEC-007 has completely different structure and line numbers. For example, manifest says "Docker Compose" is at lines 96-205 but the actual file has it at lines 96-119. "Cloudflare Tunnel Setup" at 207-225 does not exist. "Database Migrations + Encrypted Backups" at 227-242 is now at 225-238. "Dockerfile (multi-stage)" at 292-333 does not exist (replaced by "Self-Hosted Fallback" at 313-324). | Re-index all SPEC-007 sections in the manifest against the actual rewritten file. Every section entry needs updated line numbers and several sections need to be removed or replaced. |
| C-07 | **LOW** | AGENT.md:117 | Directory stewardship says `Dockerfile` references "SPEC-007 Sec 7.4". The rewritten SPEC-007 does not have a Section 7.4. The self-hosted fallback section is Section 11. | Update the cross-reference to "SPEC-007 Sec 11". |

### 2. COMPLETENESS OF SPEC-007

| # | Severity | Spec Affected | Finding | Recommended Fix |
|---|----------|---------------|---------|-----------------|
| P-01 | **MEDIUM** | SPEC-007 | No `.env.example` template is provided. Section 4.3 mentions `.env.example` should be committed to git but does not show its contents. A developer would have to manually assemble the variable list from Sections 6.1-6.4. | Add a complete `.env.example` template showing all variables with placeholder values and comments. |
| P-02 | **MEDIUM** | SPEC-007 | Supabase Realtime auth mechanism is underspecified. Section 5.3 says "Authentication is handled via Supabase Realtime's built-in auth (using the user's session token to verify channel access)" but does not explain HOW the app's NextAuth session token maps to Supabase Realtime auth. Supabase Realtime normally uses Supabase Auth JWTs, not custom session tokens. | Clarify the auth bridge: either (a) the API route generates a short-lived Supabase-compatible JWT for the client to use with Realtime, or (b) the server-side publishes to channels and the client uses a custom token exchange endpoint. Specify which pattern is used. |
| P-03 | **LOW** | SPEC-007 | The `SUPABASE_ANON_KEY` is listed under "Production Only" (Section 6.3) but would also be needed in dev if a developer chooses `NEXT_PUBLIC_REALTIME_PROVIDER=supabase`. | Note in Section 6.4 that `SUPABASE_URL`, `SUPABASE_ANON_KEY`, and `SUPABASE_SERVICE_ROLE_KEY` are optional in dev (only needed if `STORAGE_PROVIDER=supabase` or `NEXT_PUBLIC_REALTIME_PROVIDER=supabase`). |
| P-04 | **LOW** | SPEC-007 | Section 5.1 step 3 shows the direct connection URL using port 5432 for migrations, but does not specify which `DATABASE_URL` value the developer should set in Vercel for the application (pooler on 6543) vs. for migrations (direct on 5432). This could confuse a first-time Supabase user. | Add explicit guidance: "Set `DATABASE_URL` in Vercel to the pooler URL (port 6543). For running migrations, use the direct URL (port 5432) via a separate env var or local CLI." |

### 3. PORTABILITY (NO SUPABASE-JS FOR DB ACCESS)

| # | Severity | Spec Affected | Finding | Recommended Fix |
|---|----------|---------------|---------|-----------------|
| D-01 | **OK** | AGENT.md:148 | States "Database queries use Drizzle ORM ONLY -- no supabase-js for data access". Correct. | No action. |
| D-02 | **OK** | SPEC-007:34 | States "Database queries MUST use Drizzle ORM only. No `supabase.from('table')` calls in application code". Correct. | No action. |
| D-03 | **OK** | SPEC-MANIFEST.xml:232 | States "Database queries use Drizzle ORM only -- no supabase-js for data access". Correct. | No action. |
| D-04 | **OK** | SPEC-007:23 | Non-goals explicitly exclude "Supabase JS client (`@supabase/supabase-js`) for database queries -- Drizzle ORM only". Correct. | No action. |
| D-05 | **MEDIUM** | SPEC-009:127 | Project structure comment says `db.ts -- Database client (Prisma/Drizzle)`. The parenthetical "Prisma/Drizzle" is ambiguous and contradicts the decided tech stack (Drizzle only, Prisma explicitly excluded in AGENT.md:34). | Change to `db.ts -- Database client (Drizzle)`. Remove Prisma reference. |
| D-06 | **INFO** | SPEC-007:176 | Supabase Storage uploads use the "REST API using the service role key (NOT the anon key, NOT the JS client)". This is consistent with the no-supabase-js rule. However, this means raw HTTP calls to `https://[ref].supabase.co/storage/v1/object/headshots/...`. The spec should clarify whether a lightweight fetch wrapper or the `@supabase/storage-js` package (separate from `@supabase/supabase-js`) is acceptable. | Clarify: either "use native `fetch()` against the Storage REST API" or "a minimal Storage-only client is acceptable but `@supabase/supabase-js` is still prohibited". |

### 4. REALTIME MIGRATION (SPEC-005)

| # | Severity | Spec Affected | Finding | Recommended Fix |
|---|----------|---------------|---------|-----------------|
| R-01 | **HIGH** | SPEC-005:105-116 | WebSocket auth section 4.1 still describes ws-specific auth rules (upgrade handshake, session cookie validation, 5-minute re-validation, close code 4401). The opening note at line 107 correctly says "In production with Supabase Realtime, authentication is handled by Supabase's built-in channel auth" but then the REQUIREMENTS bullets do not distinguish which rules apply in which mode. The 5-minute re-validation (line 114) is a custom ws behavior -- Supabase Realtime uses JWT expiry instead. | Split Section 4.1 into two clearly labeled subsections: (a) "Production (Supabase Realtime)" describing JWT-based channel auth, and (b) "Development / Self-Hosted (ws library)" preserving the current handshake/revalidation rules. State explicitly how the 5-minute revalidation maps to Supabase (e.g., short-lived JWTs with 5-minute expiry, or server-side presence tracking). |
| R-02 | **MEDIUM** | SPEC-005:120-122 | Rate limiting is tracked "in-memory counter per user, reset every 60 seconds". On Vercel serverless, there is no persistent in-memory state between invocations. Rate limiting would need to use the database, Supabase Edge Functions, or a Vercel KV store. | Specify the rate limiting backend for production: either (a) database-backed counter (simple but adds latency), (b) Supabase Edge Function with in-memory state, or (c) Vercel KV/Upstash Redis. Note: Redis is listed as a non-goal in SPEC-007, so option (c) may conflict. |
| R-03 | **MEDIUM** | SPEC-005:177-191 | Message moderation flow (Director deletes message, body replaced) works fine with Supabase Realtime since messages are persisted via Drizzle and broadcast via Realtime channels. However, the spec does not describe how a deletion event is propagated in real-time. When the Director deletes a message, both participants should see the replacement text immediately, not on next poll. | Add: "When a message is deleted via the API, the server broadcasts a `message:deleted` event on the conversation's Realtime channel with the message ID and replacement text. The client updates the local message in place." |
| R-04 | **LOW** | SPEC-005:101 | Fallback behavior says "client polls GET /api/conversations/:id/messages every 10 seconds until reconnected". This is fine but should be noted as applying to ALL environments (not just dev). Supabase Realtime can also drop connections. | No change needed; the fallback is already environment-agnostic. |

### 5. STORAGE MIGRATION (SPEC-004)

| # | Severity | Spec Affected | Finding | Recommended Fix |
|---|----------|---------------|---------|-----------------|
| S-01 | **OK** | SPEC-004:80-87 | Image upload requirements correctly specify: EXIF stripping happens server-side BEFORE storage, magic byte validation on upload, UUID filenames, `STORAGE_PROVIDER` env var controls backend. The serving endpoint `GET /api/uploads/[filename]` works identically in both environments. Correct and complete. | No action. |
| S-02 | **OK** | SPEC-007:179 | Confirms "EXIF stripping and magic byte validation happen server-side BEFORE uploading to Supabase Storage". Consistent with SPEC-004. | No action. |
| S-03 | **MEDIUM** | SPEC-007:240-272 | PII cleanup SQL deletes cast_profiles, cast_conflicts, conflict_submissions, messages, conversation_participants, conversations, bulletin_posts, and invite_tokens. However, it does NOT delete the headshot files from Supabase Storage. Line 272 mentions "A separate Supabase Edge Function runs after the SQL cleanup, listing and deleting orphaned files in the `headshots` bucket" but this Edge Function is not specified anywhere. | Add a subsection defining the Edge Function: trigger mechanism (after pg_cron job via database webhook or separate cron schedule), logic (list files in bucket whose UUIDs no longer appear in cast_profiles.headshot_url), error handling (log failures, retry next day). |
| S-04 | **LOW** | SPEC-004:87 | "Photos are also deleted when the user is removed from a production or deletes their account." With Supabase Storage, this deletion must happen via the Storage REST API, not just a database DELETE. The spec does not clarify that the API route handling member removal or account deletion must also call the Storage API. | Add a note: "When deleting a headshot (user removal, account deletion, or photo replacement), the API route MUST delete the file from the storage backend (Supabase Storage REST API in prod, local filesystem in dev) in addition to clearing the `headshot_url` column." |

### 6. CI/CD (SPEC-008 vs VERCEL)

| # | Severity | Spec Affected | Finding | Recommended Fix |
|---|----------|---------------|---------|-----------------|
| I-01 | **MEDIUM** | SPEC-008:176-185, SPEC-007:26,68 | SPEC-008 Section 10 says tests run via "GitHub Actions (see `.github/workflows/ci.yml`)" and specifies spinning up a PostgreSQL service in CI. SPEC-007 Section 2 (tech stack) says "CI/CD: Vercel + GitHub integration" and non-goals say "Custom CI/CD pipeline beyond Vercel's built-in GitHub integration". These conflict: Vercel's built-in CI only runs `npm run build`, not test suites. GitHub Actions is a separate CI system. | Resolve the ambiguity. Recommended: Keep GitHub Actions for test execution (unit + integration + security with Docker PostgreSQL). Vercel handles only the build + deploy. Update SPEC-007 non-goals to say "Custom CI/CD pipeline beyond Vercel's built-in deployment integration + GitHub Actions for tests" or similar. |
| I-02 | **OK** | SPEC-008:128-133 | Test database is Docker PostgreSQL (`callboard_test`). This remains correct for both local dev testing and CI (GitHub Actions can spin up a PostgreSQL service container). The test database is not Supabase. | No action. CI test database strategy is sound. |

### 7. SPEC-009 TECH STACK TABLE

| # | Severity | Spec Affected | Finding | Recommended Fix |
|---|----------|---------------|---------|-----------------|
| T-01 | **MEDIUM** | SPEC-009:66 | The frontend tech stack table row for Real-time still says: `| Real-time | Native WebSocket (client) | Chat delivery, reconnection logic |`. This does not reflect the hybrid model where production uses Supabase Realtime (which has its own client library `@supabase/realtime-js`) and dev uses native WebSocket / ws. | Update to: `| Real-time | Supabase Realtime client (prod) / Native WebSocket (dev) | Chat delivery, reconnection logic |`. |
| T-02 | **LOW** | SPEC-009:130 | Project structure lists `websocket.ts -- WebSocket client utilities`. In the hybrid model, this file would need to abstract over both Supabase Realtime and native WebSocket. The filename is fine but the comment is narrow. | Update comment to: `websocket.ts -- Realtime client utilities (Supabase Realtime or native WebSocket based on env)`. |

### 8. IMMUTABLE CONSTRAINTS CROSS-CHECK

| # | Severity | Spec Affected | Finding | Recommended Fix |
|---|----------|---------------|---------|-----------------|
| X-01 | **OK** | AGENT.md:145-151, SPEC-007:34-40, MANIFEST:229-235 | All three locations consistently state: no supabase-js for DB access, service role key never on client, .env never committed, NEXTAUTH_SECRET min 32 bytes. The MANIFEST adds `STORAGE_PROVIDER` and `NEXT_PUBLIC_REALTIME_PROVIDER` env vars as constraints, which are defined in SPEC-007 and referenced in SPEC-004 and SPEC-005. Consistent. | No action. |
| X-02 | **MEDIUM** | AGENT.md:34 | Tech stack lock-in rule says "ws (not Socket.io)" but does not mention Supabase Realtime as the production transport. A literal reading could make an agent think it must use `ws` everywhere. | Amend to: "ws (not Socket.io) for dev/self-hosted; Supabase Realtime for prod. See SPEC-007 for hybrid realtime model." |
| X-03 | **LOW** | SPEC-007:17 | Goals state code "can fall back to fully self-hosted Docker + Cloudflare Tunnel without code changes (only env vars change)". This is a portability goal, not a contradiction, but it references Cloudflare Tunnel as the self-hosted fallback. This is acceptable if understood as a fallback scenario documented in Section 11. | No change needed, but ensure Section 11 is clearly labeled as a fallback/escape-hatch, not the primary deployment model. |

---

## Summary of Findings by Severity

| Severity | Count | Findings |
|----------|-------|----------|
| HIGH | 4 | C-01, C-02, C-03, C-06 |
| MEDIUM | 10 | C-04, C-05, P-01, P-02, D-05, R-02, R-03, S-03, I-01, T-01, X-02 |
| LOW | 6 | C-07, P-03, P-04, D-06, S-04, T-02 |
| OK/INFO | 8 | D-01, D-02, D-03, D-04, S-01, S-02, I-02, X-01 |

---

## Verdict

**The specs are NOT ready for implementation under the hybrid model.**

The rewritten SPEC-007 is solid and internally consistent. The problems are in the surrounding specs that were not updated to match:

1. **Three HIGH-severity stale references** in SPEC-001 and SPEC-002 still describe the old Cloudflare Tunnel model as if it were the production deployment. A developer reading SPEC-001 or SPEC-002 without reading SPEC-007 would build for the wrong infrastructure.

2. **The SPEC-MANIFEST.xml line numbers for SPEC-007 are entirely wrong.** This is a blocking issue because the manifest is the primary navigation tool for agents. Every SPEC-007 section reference will send the reader to the wrong lines.

3. **The Supabase Realtime auth bridge is unspecified.** SPEC-005 and SPEC-007 both mention Supabase Realtime for chat but neither explains how the app's NextAuth sessions map to Supabase Realtime channel authorization. This is a design gap, not just a documentation gap.

4. **Serverless rate limiting is unresolved.** The chat rate limit (30 msg/min) uses in-memory counters, which do not persist across Vercel serverless invocations. Without a solution, rate limiting will not work in production.

**Recommended remediation order:**

1. Fix SPEC-MANIFEST.xml line numbers for SPEC-007 (C-06) -- blocks all agent navigation
2. Fix stale Cloudflare Tunnel references in SPEC-001 and SPEC-002 (C-01, C-02, C-03)
3. Specify the Supabase Realtime auth bridge (P-02, R-01)
4. Specify the serverless rate limiting strategy (R-02)
5. Fix SPEC-008 Phase 1 description (C-04) and CI/CD ambiguity (I-01)
6. Fix SPEC-009 tech stack table (T-01) and Prisma reference (D-05)
7. Define the Supabase Storage orphan cleanup Edge Function (S-03)
8. Address remaining LOW findings at convenience

Once items 1-4 are resolved, the specs will be implementable under the hybrid model.
