# SPEC-012: Rehearsal Operations Features (October 2026)

Supplements SPEC-003 (director flow), SPEC-004 (cast flow) and SPEC-006 (schedule). These features
came from research on physical and digital call boards: stage managers need to know who has seen a
change, who is here, who is late, and where everyone is meant to be.

SMS and push notifications are out of scope for now. Notifications are email (Resend) and the
existing browser notifications.

## 1. Acknowledgement tracking

- `BulletinPost.requires_ack` (bool). Posts that ask for it show "I've read this" to members.
- `Acknowledgement` (kind `bulletin` or `report`, target id, user, time). One per member per target.
- `POST /productions/{id}/bulletin/{post_id}/ack` — member confirms (idempotent).
- `GET  /productions/{id}/bulletin/{post_id}/acks` — staff: confirmed and pending lists. The author is never pending.
- `POST /productions/{id}/bulletin/{post_id}/acks/remind` — staff: email everyone pending. One reminder per post per 5 minutes (429 `RATE_LIMITED`).
- `GET  /productions/{id}/acks/pending` — the caller's unconfirmed items.

## 2. Call sheet and attendance

A date with explicit `CastAssignment` rows calls only those people. A date with none calls the full cast.
Staff and directors are always available.

- `GET  /productions/{id}/call-sheet/{date_id}` — details, who is called, who is here, notices, conflicts, summary and double-booking warnings (staff). Cast see names plus their own status.
- `POST /productions/{id}/attendance/check-in`, `PUT|DELETE /attendance/{date_id}/status/{user_id}` (present, late, absent, excused; DELETE clears).
- `GET  /productions/{id}/attendance/by-member` — per-person totals. Rate = (present + late) / (called − excused).
- `GET  /productions/{id}/attendance` — per-date summary.
- Fixed: attendance and scenes routers read `user["sub"]`, which `get_current_user` never sets (every call was a 500). They use `user["id"]`.

## 3. Personal calendar feed

- `ProductionMember.calendar_token` (secret, unique). `GET /productions/{id}/calendar-link` creates it on first use; `POST .../calendar-link/reset` replaces it.
- `GET /api/calendar/{token}.ics` — public, secured by the token (calendar apps cannot send headers). Cast get only calls they are in plus sign-ups they joined; staff get every call. Cancelled calls are included as `STATUS:CANCELLED`; blocked dates are left out. Times are floating local time.
- The link is a secret. The UI says so and offers a reset.

## 4. Rehearsal reports

- `RehearsalReport`: title, report date, optional rehearsal, 12 department sections (general, scenic, props, costumes, hair and makeup, sound, lighting, projection, fight, publicity, cast notes, follow-up), distribution list (user ids), status `draft` or `sent`.
- Staff create, edit, delete (author or director), send. Sending emails the list (respecting `email_notifications`).
- Recipients read sent reports and confirm (`POST .../reports/{id}/ack`). Staff see who has read.
- `GET .../reports/snapshot/{date_id}` and the report detail include the rehearsal's attendance (late, absent, excused).

## 5. Late and absent notices

- `AttendanceNotice` (one per person per call). Cast: `POST /attendance/notice` (`late` needs 1–240 minutes), `DELETE /attendance/notice/{date_id}`.
- Staff are emailed. Notices show on the call sheet and the staff dashboard. Past rehearsals cannot take notices.

## 6. Scenes

Existing scene and casting API, now with names in responses, `PATCH` for scenes and character names, 409 on duplicate casting, and
`GET /scenes/availability?rehearsal_date_id=` (green, yellow, red per scene from submitted conflicts). Cast can read scenes; staff manage them.

## 7. Open calls and double-booking

- `SignupSlot` / `SignupEntry`: title, date, times, location, capacity. Staff manage; any member joins or withdraws.
- Joining a slot that overlaps another sign-up or the member's own call returns 409 `DOUBLE_BOOKED`; `?force=true` overrides. A full slot returns 409 `FULL`.
- `RehearsalDate.location`. `GET /productions/{id}/double-bookings` (staff) reports: same room at overlapping times, people called to overlapping calls, two full-company calls overlapping, sign-ups that clash with a call.

## 8. Documents and forms

- `Document`: stored in the database (10 MB limit, extension allow-list, no HTML or SVG). Content type comes from the extension and downloads are always attachments.
- `FormTemplate` / `FormSignature`: members e-sign by typing their account name and ticking a box. Members aged 13–17 also give a guardian name and email when the form asks for it. One signature per form per member, immutable; a signed form's text cannot change (archive and publish a new one). Signing is audit-logged with the IP.
- Staff see signed and pending lists and can remind (5 minute limit).

## Dashboard

`GET /productions/{id}/attention` powers the dashboard panel: the member's next call and check-in, unconfirmed posts, forms to sign;
for staff also unconfirmed posts, incomplete forms, upcoming late/absent notices and the double-booking count.

## Navigation

Director/staff: Dashboard; Rehearse (Schedule, Call Sheet, Scenes, Reports); Communicate (Bulletin, Chat); Company (Members, Sign-ups, Documents); Production (Settings).
Cast: Dashboard, Bulletin, Schedule, Call Sheet, Chat, Sign-ups, Documents. On phones the bar shows four pages plus **More**.

## Migrations

`run_light_migrations()` in `database.py` adds `rehearsal_dates.location`, `bulletin_posts.requires_ack` and `production_members.calendar_token`; new tables come from `create_all`. The test fixtures call it too.

## Documents viewer, help and tours (added later)

- **Viewer:** "View" opens a pop-up. PDF in the browser's viewer, Word via `mammoth` (output sanitized with DOMPurify), Excel via `read-excel-file`, CSV as a table, Markdown through a small renderer that never emits raw HTML, plus text, images, audio and video. `.md` and `.markdown` uploads are accepted. Old `.doc`, `.xls`, PowerPoint and RTF download instead.
- **Help:** `PageGuide` on every page ("how this page works": what the page is for, what the person can do, what they can't), a `/production/:id/help` page with a role summary, permission table and glossary. Content is in `frontend/src/content/guides.ts`.
- **Tours:** production tours (director, staff, cast) follow the new navigation; page tours exist for the new pages; steps whose target is not on screen are skipped (phone menus). `TOUR_VERSION` makes updated tours play once more for existing users.
- **Members page words:** "Make staff", "Make cast", "Remove", "Block", "Conflicts submitted", "Conflicts not in yet", "Age not given", each with a tooltip.

