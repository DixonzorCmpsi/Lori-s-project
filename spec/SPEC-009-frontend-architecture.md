# SPEC-009: Frontend Architecture & UI Design System

**Status:** Draft
**Last Updated:** 2026-03-21
**Depends On:** SPEC-001, SPEC-007

---

## Goals (Immutable)

- Next.js 14+ App Router with TypeScript strict mode as the sole frontend framework.
- Theater backstage visual identity: warm dark wood, cork boards, amber work lights, serif headings.
- Fully responsive across mobile (375px+), tablet (768px+), and desktop (1024px+).
- shadcn/ui component primitives for all base UI elements.
- Dark theme only — no light mode toggle, no light mode variant.
- Skeleton loading states on every async boundary; zero spinners anywhere in the app.
- WCAG AA accessible: every interactive element keyboard-navigable, minimum 4.5:1 contrast ratio.
- Zod validation on every form (client-side and server-side schemas shared).

## Non-Goals (Explicit Exclusions)

- Light mode or any theme-switching capability.
- CSS-in-JS solutions (use Tailwind CSS only).
- Custom component library built from scratch (use shadcn/ui exclusively).
- Animations or transitions beyond subtle hover states (no page transitions, no loading animations).
- Image-based textures (all textures achieved via CSS gradients and shadows only).
- PWA capabilities or service workers.
- Offline mode or offline-first data storage.
- Native mobile app (iOS/Android).

## Success Metric

A user opening the app for the first time should feel like they are backstage at a theater, not using a generic SaaS tool. The app is fully usable on a 375px-wide phone screen. Every interactive element is keyboard-navigable.

## Immutable Constraints

- Tailwind CSS only — no CSS-in-JS, no external CSS frameworks, no vanilla CSS files beyond globals.css.
- shadcn/ui for all base components — no other component libraries permitted.
- Playfair Display serif for headings, Libre Franklin for body text — no substitutions.
- Color palette uses warm HSL values (hue 25-40 range for backgrounds) — no cold blue or gray tones.
- No light mode toggle — dark theme is the only theme.
- No image textures — CSS gradients and shadows only for all surface treatments.
- Minimum 4.5:1 contrast ratio on all text (WCAG AA).
- Touch targets minimum 44x44px on all interactive elements.

---

## 1. Overview

Next.js 14+ App Router application using React Server Components, Tailwind CSS, and a dark-only design system. Mobile-first responsive, web-only.

## 2. Tech Stack (Frontend)

| Layer | Technology | Rationale |
|-------|-----------|-----------|
| Framework | Next.js 14+ (App Router) | Server components, file-based routing, API routes co-located |
| Language | TypeScript (strict mode) | Type safety across frontend and API |
| Styling | Tailwind CSS | Utility-first, dark theme built-in, fast iteration |
| Component Library | shadcn/ui | Accessible, unstyled primitives built on Radix UI. Copy-paste components, fully customizable |
| Forms | React Hook Form + Zod | Type-safe validation, works with server actions |
| State Management | React Server Components + `useContext` for client state | Minimal client JS, server-first data fetching |
| Calendar | react-day-picker | Schedule display and conflict selection (MUST use react-day-picker, not a custom implementation) |
| Markdown Rendering | react-markdown + rehype-sanitize | Safe Markdown rendering on the client (server pre-sanitized) |
| Icons | Lucide React | Consistent icon set, tree-shakeable |
| Toast/Notifications | sonner | Lightweight toast library |
| Real-time | Supabase Realtime (prod) / ws (dev) | Chat delivery, environment-aware via NEXT_PUBLIC_REALTIME_PROVIDER |

## 3. Project Structure

```text
src/
  app/
    (auth)/
      login/page.tsx              -- Login page (Google OAuth + email/password)
      register/page.tsx           -- Registration page (with age gate)
      forgot-password/page.tsx    -- Password reset request
      reset-password/page.tsx     -- New password form (from email link)
      verify-email/page.tsx       -- Email verification handler
    (join)/
      join/page.tsx               -- Invite link handler (token validation + redirect)
    (dashboard)/
      layout.tsx                  -- Authenticated layout (sidebar/nav)
      page.tsx                    -- Dashboard home (theater list or empty state)
      theater/
        new/page.tsx              -- Add theater form
      production/
        new/page.tsx              -- Create production + schedule wizard
        [productionId]/
          layout.tsx              -- Production layout (tabs/nav)
          page.tsx                -- Production dashboard (Director view)
          schedule/page.tsx       -- Schedule view (Director: edit, Cast: read-only)
          bulletin/page.tsx       -- Bulletin board (poster + schedule tabs)
          roster/page.tsx         -- Member roster (Director only)
          chat/page.tsx           -- Chat interface
          chat/[conversationId]/page.tsx -- Conversation view
          settings/page.tsx       -- Production settings (Director only)
          conflicts/page.tsx      -- Cast conflict submission
          profile/page.tsx        -- Cast profile setup
    api/
      health/route.ts             -- Health check endpoint
      auth/[...nextauth]/route.ts -- NextAuth.js handler
      (all other API routes)
  components/
    ui/                           -- shadcn/ui primitives (button, input, dialog, etc.)
    layout/
      sidebar.tsx                 -- Main navigation sidebar
      header.tsx                  -- Page header with breadcrumbs
      mobile-nav.tsx              -- Mobile bottom navigation
    auth/
      login-form.tsx              -- Email/password login form
      google-button.tsx           -- Google OAuth button
      age-gate.tsx                -- DOB age check component
    production/
      schedule-calendar.tsx       -- Calendar grid component
      conflict-picker.tsx         -- Date selection for conflicts
      bulletin-post.tsx           -- Single post card
      bulletin-editor.tsx         -- Markdown post editor
      member-row.tsx              -- Roster row with actions
      invite-link-card.tsx        -- Invite link display + copy
    chat/
      conversation-list.tsx       -- Chat sidebar with conversations
      message-bubble.tsx          -- Single message
      message-input.tsx           -- Text input + send button
      chat-provider.tsx           -- WebSocket context provider
  lib/
    auth.ts                       -- NextAuth config
    db.ts                         -- Database client (Drizzle)
    validators.ts                 -- Zod schemas for all forms
    permissions.ts                -- Role check helpers
    websocket.ts                  -- Realtime client (Supabase Realtime or ws based on env)
    markdown.ts                   -- Markdown sanitizer config
  styles/
    globals.css                   -- Tailwind base + dark theme tokens
```

## 4. Theater Backstage Design System

The visual identity is "backstage at a theater." Dark wood panels, cork bulletin boards, stage lighting warmth. Dark theme only — no light mode.

### 4.1 Design Language

| Element | Metaphor | How It Manifests |
|---------|----------|-----------------|
| Page background | Dark theater wings | Deep warm black, not cold blue-black |
| Cards/panels | Wooden bulletin boards | Warm brown tinted backgrounds with subtle wood grain texture (CSS gradient, not image) |
| Bulletin posts | Pinned paper on a board | Slightly rotated cards (1-2deg), warm white `--board-paper` background on dark board, `box-shadow: 2px 3px 8px rgba(0,0,0,0.4)` drop shadow |
| Navigation sidebar | Stage left wing | Dark panel with warm amber `--accent` highlight for active items |
| Buttons (primary) | Stage spotlight | Warm amber/gold glow, `--accent` color (#D4A853) |
| Buttons (destructive) | Exit sign | Red, unmistakable |
| Schedule calendar | Rehearsal call sheet | Monospaced dates in `JetBrains Mono`, structured grid layout |
| Chat | Backstage whisper | Compact, minimal chrome, feels intimate and private |
| Empty states | Dark empty stage | Centered text with a subtle spotlight gradient behind it |

### 4.2 Color Palette

| Token | Value | Usage | Theater Metaphor |
|-------|-------|-------|-----------------|
| `--background` | `hsl(25, 15%, 7%)` | Page background | Dark theater wings (warm black, not cold) |
| `--surface` | `hsl(25, 12%, 11%)` | Card/panel backgrounds | Stained wood panel |
| `--surface-raised` | `hsl(25, 12%, 15%)` | Hover states, elevated panels | Raised wood |
| `--board` | `hsl(30, 20%, 18%)` | Bulletin board background | Cork board |
| `--board-paper` | `hsl(40, 30%, 92%)` | Bulletin post cards | Warm paper pinned to board |
| `--board-paper-text` | `hsl(25, 15%, 15%)` | Text on paper cards | Ink on paper |
| `--border` | `hsl(25, 10%, 20%)` | Borders, dividers | Wood grain edges |
| `--foreground` | `hsl(35, 20%, 90%)` | Primary text | Warm white (not pure white) |
| `--muted` | `hsl(25, 10%, 55%)` | Secondary text | Faded stage directions |
| `--accent` | `hsl(38, 75%, 55%)` | Primary actions, active nav | Amber work light / spotlight |
| `--accent-hover` | `hsl(38, 75%, 45%)` | Primary hover | Dimmed work light |
| `--destructive` | `hsl(0, 65%, 50%)` | Destructive actions, errors | Exit sign red |
| `--success` | `hsl(142, 50%, 40%)` | Success, confirmed | Green room |
| `--warning` | `hsl(38, 90%, 55%)` | Warnings | Caution tape |
| `--curtain` | `hsl(350, 50%, 25%)` | Accent decorative element | Deep velvet curtain red |

### 4.3 Texture & Surface Treatment

These are **CSS-only** effects, no image assets required:

- **Wood grain panels:** Repeating linear-gradient with 3 warm dark browns (`hsl(25, 12%, 11%)`, `hsl(25, 12%, 12%)`, `hsl(25, 12%, 11.5%)`) at 170deg. Applied to sidebar and card backgrounds.
- **Cork board:** Bulletin board background uses an inline SVG noise pattern (`background-image: url("data:image/svg+xml,...")`) at 8% opacity over `--board` color. The SVG MUST be a 100x100 feTurbulence noise pattern.
- **Paper cards on board:** Bulletin posts use `--board-paper` background with `box-shadow: 2px 3px 8px rgba(0,0,0,0.4)`. Rotation alternates by index: even posts `transform: rotate(-0.5deg)`, odd posts `transform: rotate(0.8deg)`. A 10px diameter circle in `--accent` color is centered at the top of each card as a "pin."
- **Spotlight empty states:** Radial gradient `radial-gradient(ellipse at center, hsl(38 75% 55% / 0.05), transparent 70%)` centered behind empty state text.
- **Stage curtain accent:** `--curtain` colored `border-left: 3px solid` on the sidebar. No gradient at top of page.

### 4.4 Schedule Color Codes

| Rehearsal Type | Color | Tailwind Class | Metaphor |
|----------------|-------|---------------|----------|
| Regular | Amber | `bg-amber-600/20 text-amber-400` | Standard call |
| Tech | Blue | `bg-blue-600/20 text-blue-400` | Technical (lighting/sound) |
| Dress | Purple | `bg-purple-600/20 text-purple-400` | Costume/dress |
| Performance | Red/Gold | `bg-red-600/20 text-red-400 ring-1 ring-amber-500/30` | Show night |
| Cancelled | Gray + strikethrough | `bg-gray-600/20 text-gray-500 line-through` | Struck from call sheet |
| Conflict (cast view) | Red badge | `bg-red-500` dot/badge on date | Flagged |

### 4.5 Typography

| Element | Font | Size | Weight | Notes |
|---------|------|------|--------|-------|
| Body | `"Libre Franklin", system-ui, sans-serif` | 14px / 0.875rem | 400 | Clean, readable, slight theater playbill feel |
| Heading 1 | `"Playfair Display", serif` | 28px / 1.75rem | 700 | Elegant serif for production titles — evokes theater programs |
| Heading 2 | `"Playfair Display", serif` | 22px / 1.375rem | 600 | Section headers |
| Heading 3 | `"Libre Franklin", system-ui, sans-serif` | 16px / 1rem | 600 | Subsection headers |
| Small/caption | Same as body | 12px / 0.75rem | 400 | Metadata, timestamps |
| Schedule dates | `"JetBrains Mono", monospace` | 13px | 400 | Call sheet feel — monospaced dates align cleanly. Loaded via `next/font/google` with `display: swap` alongside Playfair Display and Libre Franklin. Fallback: `ui-monospace, 'Cascadia Code', 'Fira Code', monospace` |

**Font loading:** Playfair Display and Libre Franklin loaded via `next/font/google` with `display: swap`. System fallbacks ensure no FOIT.

### 4.6 Spacing & Layout

- Base spacing unit: 4px (Tailwind default)
- Max content width: 1200px (centered)
- Sidebar width: 260px (desktop), hidden on mobile (bottom nav instead)
- Card border radius: 6px (`rounded-md`) — less rounded to match the paper/wood aesthetic
- Standard padding: 16px on cards, 24px on page sections
- Bulletin post cards: 20px padding, slight rotation, pin decoration at top

## 5. Responsive Breakpoints

| Breakpoint | Width | Layout |
|------------|-------|--------|
| Mobile | < 768px | Single column, bottom nav, stacked cards |
| Tablet | 768px - 1024px | Sidebar collapsible, 2-column where appropriate |
| Desktop | > 1024px | Full sidebar, multi-column layouts |

### 5.1 Mobile Considerations

- Bottom navigation bar with 3 items: Bulletin Board, Schedule, Chat
- Calendar switches to list view on mobile (dates stacked vertically)
- Chat is full-screen on mobile (conversation list -> conversation detail)
- Forms are single-column, full-width inputs
- Touch targets minimum 44x44px

## 6. Navigation Structure

### 6.1 Director Navigation (Desktop Sidebar)

```text
[Production Name]
  |-- Dashboard (overview)
  |-- Schedule (calendar + conflicts)
  |-- Bulletin Board
  |-- Members (roster + invite link)
  |-- Chat
  |-- Settings (archive, delete)
```

### 6.2 Cast Navigation (Simplified)

```text
[Production Name]
  |-- Bulletin Board (poster tab default)
  |   |-- [Posters tab]
  |   |-- [Schedule tab]
  |-- Chat
```

Cast members do NOT see: Dashboard, Members, Settings.

### 6.3 Staff Navigation

Same as Director except: no Settings (no archive/delete), no member removal.

## 7. Accessibility Requirements

- All interactive elements MUST be keyboard-navigable
- Focus indicators MUST be visible on all focusable elements (2px ring in `--accent` color)
- Icon-only buttons MUST have an ARIA label describing the action
- Color MUST NOT be the sole indicator — every color-coded element MUST also have a text label and an icon
- Form errors MUST be announced to screen readers via `aria-live="polite"`
- All text MUST meet minimum contrast ratio of 4.5:1 (WCAG AA)
- All images MUST have alt text (headshots: "Photo of [name]")

## 8. Loading & Empty States

Every page/component MUST handle these states:

| State | Behavior |
|-------|----------|
| Loading | Skeleton placeholders matching content shape. MUST NOT use spinners anywhere. Skeleton uses `animate-pulse` with `--surface-raised` color. |
| Empty | Centered text with CTA button. Exact text per page defined in SPEC-010. |
| Error | Red-bordered card with human-readable message and a "Try Again" button that re-fetches. MUST NOT show raw error objects, stack traces, or status codes. |
| Offline (chat) | Fixed banner at top of chat area: "Connection lost. Reconnecting..." in `--warning` color. Auto-retry with exponential backoff: 1s, 2s, 4s, 8s, max 30s. After 5 failed retries, show "Unable to connect. [Retry Now]" button. |

## 9. Client-Side Validation

All forms validate on the client using **Zod schemas** (same schemas used server-side):

- MUST validate on blur (per-field) and on submit (full form)
- MUST show inline error messages below the field in `--destructive` color
- MUST disable submit button while form is invalid and while submitting
- MUST show loading indicator on submit button during server requests
- When the server returns 400 VALIDATION_ERROR, the client MUST map the `fields` array from the response to inline errors
- When the server returns 401 UNAUTHORIZED, the client MUST redirect to the login page
- When the server returns 403 FORBIDDEN, the client MUST display a toast with the message "You do not have permission to perform this action"
- When the server returns 500 INTERNAL_ERROR, the client MUST display a toast with the message "Something went wrong. Please try again."

## 10. Test Scenarios

| ID | Scenario | Expected Result |
|----|----------|-----------------|
| FE-01 | Page loads on mobile (<768px) | Bottom nav visible, sidebar hidden |
| FE-02 | Page loads on desktop (>1024px) | Sidebar visible, bottom nav hidden |
| FE-03 | Dark theme renders correctly | All backgrounds/text match design tokens |
| FE-04 | Form validation on empty submit | Inline errors shown on required fields |
| FE-05 | Loading state for schedule page | Skeleton calendar rendered while fetching |
| FE-06 | Empty bulletin board | "No posts yet" message with CTA |
| FE-07 | Keyboard navigation through sidebar | All items focusable, Enter activates |
| FE-08 | Cast user sees simplified nav | No Dashboard, Members, or Settings links |
| FE-09 | API error response displayed | Toast with human-readable message, no raw JSON |
| FE-10 | WebSocket disconnect and reconnect | Banner shown, auto-reconnect, messages resume |
