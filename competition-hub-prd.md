# Competition Hub — Product Requirements Document

**Version:** 1.0
**Author:** Danuartha (Danu)
**Date:** August 2, 2026
**Status:** Draft for review

---

## 1. Overview

Competition Hub is a personal Progressive Web App for tracking every student competition Danu joins — from first research through submission, judging, and results. It replaces scattered notes, chat threads, and folders with one place that holds each competition's links, documents, status, and rundown, and pushes WhatsApp reminders so nothing gets missed while traveling between Bali and event cities like Solo.

## 2. Problem Statement

Right now competition information is spread across Google Docs, Instagram bookmarks, WhatsApp groups, and local folders. There is no single view of:

- Which competitions are active, upcoming, or closed
- What stage each one is at (registration, submission, finalist, done)
- What the guidebook actually requires, without re-reading a 20-page PDF every time
- When the next deadline or rundown item is happening

This causes duplicated effort re-reading guidebooks, missed deadlines, and no clean history to reuse for future proposals.

## 3. Goals

- One dashboard listing every competition with its current status and next deadline
- Store Instagram link, website link, and guidebook file per competition
- AI-generated summary and advice for each competition, derived from its guidebook
- WhatsApp reminders for rundown events and deadlines, sent through Fonnte
- Installable PWA that works offline for previously loaded data
- Clean, fast, uncluttered interface with a small reusable component set

### Non-Goals (v1)

- Multi-user collaboration / team accounts for REGEX (schema allows it later, UI does not expose it yet)
- Public sharing of competition pages
- Automatic scraping of competition websites (links are added manually)
- Payment or budget tracking (separate from the RAB spreadsheets Danu already keeps)

## 4. Primary User

Danu — a solo user, sole account holder. Occasionally shares screenshots or exported summaries with teammates (e.g., I Ketut Yogi), but does not need them logged into the system in v1.

## 5. Feature Requirements

### 5.1 Competition Tracker (Core)

Each competition is a record with:

| Field | Notes |
|---|---|
| Name | e.g., "BYTESFEST 2026" |
| Organizer | e.g., university, company |
| Theme / category | free text |
| Status | Researching → Registered → In Progress → Submitted → Finalist → Completed → Not Selected |
| Registration deadline | date |
| Submission deadline | date |
| Event start / end date | date range |
| Location | city, or "Online" |
| Team name | e.g., "REGEX" |
| Tags | competition type (hackathon, UI/UX, business plan, proposal-only) — used for filtering, see 5.9 |
| Notes | free text, markdown-friendly |

The dashboard is a filterable list/board (status columns or a table with a status filter — see 5.4) showing name, status badge, tags, and the nearest upcoming date. Clicking a competition opens its detail page. A **Duplicate** action on any competition (see 5.9) clones the structural fields into a new draft for annual repeats.

### 5.2 Resource Links & Documents

On each competition's detail page:

- **Instagram link** field — validated as an Instagram URL, rendered as a tappable link with an Instagram-style icon (Lucide `instagram` icon, no emoji)
- **Website link** field — same pattern with a `globe` icon
- **Guidebook upload** — PDF only (v1 accepts no other format), uploaded to Cloudinary, shown as a file card with name, size, and a `download`/`file-text` icon. Multiple documents are supported per competition (guidebook, addenda, template files), listed newest-first, all PDF.

### 5.3 AI Summary & Advice

When a guidebook is uploaded (or replaced), a background job:

1. Extracts text from the PDF
2. Sends it to an LLM with a structured prompt asking for:
   - **Summary** — what the competition is about, in a few sentences
   - **Key requirements** — eligibility, team size, submission format, page/slide limits
   - **Important dates** — extracted deadlines, cross-checked against what Danu entered manually
   - **Judging criteria** — what's being scored, if stated
   - **Theme & sub-theme** — extracted explicitly, since this drives the project idea suggestions below
   - **Project idea suggestions** — 2 to 4 concrete project concepts that fit the extracted theme and sub-theme, each with a one-line rationale tied to the judging criteria (this is the "advice": not generic tips, but actual project directions worth building)
3. Cross-checks the suggested ideas against Danu's **Project Portfolio** (see 7.3): if an existing project's theme overlaps with this competition, the card surfaces it as "Possible fit: reuse/adapt [project]" along with a reminder to check the competition's originality/IP rules before resubmitting the same work elsewhere
4. Stores the structured result and renders it as a card on the detail page, with a "Regenerate" action if the guidebook is updated

This is not a chatbot — it is a one-shot structured extraction shown as a readable card, with a "Regenerate summary" button rather than a chat window, matching the "simple, not AI-slop" direction. A "Copy as text" action lets Danu paste the summary or idea list into a proposal doc or Notion.

### 5.4 Progress & Status View

- Board view: columns per status, drag (or tap-to-move) card between columns
- List view: sortable table, filterable by status, deadline range, or team
- Each competition shows a lightweight progress indicator (e.g., 3 of 6 stages complete) based on status order, not a separate manually-maintained percentage

### 5.5 Rundown & WhatsApp Notifications (Fonnte)

Each competition can have **rundown items** — scheduled events like "Technical briefing," "Submission deadline," "Pitching day," "Finalist announcement" — each with a date/time and optional short description.

- Danu sets **one** WhatsApp number and default reminder offsets once in Settings (e.g., "1 day before" and "3 hours before"). One number is enough for v1 — no group broadcast.
- Rundown items inherit the defaults but can override them per item
- A scheduled job checks upcoming rundown items and sends a WhatsApp message through the Fonnte API when a reminder threshold is reached
- Each notification includes the competition name, the rundown item title, and the time remaining
- A **Notification Log** on the competition page shows what was sent and when, so reminders are auditable and not duplicated

**Rundown generation mode (Auto / Manual):**

- A Settings toggle controls this globally, **default: Auto**.
- **Auto** — whenever a competition's `registration_deadline`, `submission_deadline`, `event_start_at`, or `event_end_at` is set or edited, the system creates/updates a matching rundown item automatically (e.g., "Registration deadline," "Submission deadline," "Event starts," "Event ends"). These are flagged `is_auto_generated = true` so they're recognizable and safe to regenerate without creating duplicates.
- **Manual** — auto-generation stops; Danu adds every rundown item by hand. Existing auto-generated items are not deleted when switching modes, only frozen.
- Custom rundown items Danu adds by hand (briefings, pitching slots, announcements) are unaffected by this toggle either way — the toggle only governs items derived from the four deadline fields.

**Fonnte integration specifics** (confirmed against Fonnte's documentation):

- Endpoint: `POST https://api.fonnte.com/send`
- Auth: `Authorization` header set to the Fonnte device token (stored server-side only, never in client code)
- Body fields used: `target` (WhatsApp number, e.g. `62xxxxxxxxxx`), `message` (text), `countryCode` (`62`)
- Called from a Supabase Edge Function, never from the browser, since the token must not be exposed client-side

### 5.6 PWA Behavior

- Installable on Android/desktop (Web App Manifest with icons, name, theme color)
- Works offline for already-loaded competitions (cached via service worker)
- Shows a small offline indicator when there's no connection, rather than failing silently
- New/edited data queues locally and syncs once back online (guidebook uploads require connectivity and are queued with a clear "will upload when online" state, not silently dropped)

### 5.7 Project Portfolio (Reuse & IP Awareness)

A dedicated page listing every existing project/concept Danu has built, independent of any single competition:

- Fields: name, description, themes (tags), tech stack, and which competitions it's already been submitted to (`used_in_competitions`)
- Manually maintained — added or edited from the Portfolio page, not auto-populated
- Feeds the AI Summary pipeline (5.3): when a new competition's extracted theme/sub-theme overlaps a portfolio entry's tags, the AI card surfaces it as a possible reuse fit and flags the existing submission history so Danu can check originality rules before resubmitting

### 5.8 Dashboard Overview Widgets

Two small panels sit above the main competition list/board:

- **Next 7 Days** — every rundown item and deadline across all competitions falling within the next 7 days, sorted chronologically, each linking straight to its competition. This is the daily-glance view, so it sits above the full list rather than requiring a click into each competition.
- **Deadline Overlap Warning** — a banner that appears only when two or more active competitions have a submission or registration deadline within 3 days of each other, naming the competitions involved. Dismissible per pair of competitions, reappears if a new overlap is introduced.

### 5.9 Tagging, Filtering & Duplicate Competition

- Competitions carry **tags** (competition type: hackathon, UI/UX, business plan, proposal-only) alongside the existing `team_name` field
- Dashboard filters combine status, tags, and team, stacking together (e.g., "REGEX + hackathon + in progress")
- **Duplicate** action on any competition (from its detail page menu) creates a new draft competition copying name (suffixed "— Copy"), organizer, theme, tags, team name, and description — deadlines, event dates, rundown items, links, documents, and the AI summary are intentionally **not** copied, since those are specific to the run being cloned and need fresh values

### 5.10 Data Export

A single "Export all data" action in Settings that downloads a JSON file containing every competition, its documents' metadata (not the PDF bytes themselves, which stay on Cloudinary), rundown items, AI summaries, and portfolio entries scoped to the user's account. This is the backup path once the app becomes the single source of truth for competition history — no automated backup schedule in v1, it's a manual, on-demand action.

## 6. Design Principles

- **Simple over decorative.** No gradients-for-the-sake-of-it, no glassmorphism, no illustration filler. Content and status are the interface.
- **No emoji anywhere in the UI or notifications.** Icons come exclusively from **Lucide Icons**, used consistently (one icon per meaning, not mixed styles).
- **Skeleton loading**, not spinners, for every data-fetching surface (dashboard list, detail page, AI summary card) so layout doesn't jump.
- **Calm color system**: a neutral base (white/near-black text on light background, dark mode optional in v2) with status colors used only for badges — e.g., muted blue (researching), amber (in progress), green (submitted/completed), red (deadline soon / not selected). Colors carry meaning; they are not decoration.
- **Typography**: one clear heading font and one body font, consistent sizing scale, generous line height for guidebook-derived text.
- **Density**: dashboard favors scannability (compact rows) over big cards; detail pages favor readability (wider line length, clear section breaks).
- **Light / dark mode toggle**: a manual toggle in the app shell (sun/moon Lucide icon), **default: light mode** on first visit. Preference is saved (synced via `user_settings.theme_preference` so it persists across devices, not just local storage) and applied without a flash of the wrong theme on load.

## 7. Technical Architecture

### 7.1 Stack

| Layer | Choice |
|---|---|
| Frontend | Next.js (App Router), TypeScript |
| Styling | Tailwind CSS |
| Icons | lucide-react |
| Data fetching / caching | TanStack Query (SWR-style caching, background refetch) |
| Backend / DB | Supabase (Postgres, Auth, Edge Functions, `pg_cron`) |
| File storage | Cloudinary (guidebook PDFs, `raw` resource type), signed uploads only |
| AI | Gemini 2.5 Flash or Claude, called from a Supabase Edge Function (never client-side, so no API key exposure) |
| Notifications | Fonnte WhatsApp API, triggered by Supabase Edge Function on a `pg_cron` schedule |
| PWA | `next-pwa` (Workbox under the hood) or a hand-rolled service worker if finer control is needed |

### 7.2 Frontend Component Structure (clean & reusable)

```
/components
  /ui              -> primitive, style-only components (Button, Badge, Card, Skeleton, Input, FileDropzone)
  /competitions
    CompetitionCard.tsx
    CompetitionBoard.tsx
    CompetitionTable.tsx
    StatusBadge.tsx
    ProgressStages.tsx
    TagFilterBar.tsx
    DuplicateCompetitionAction.tsx
  /dashboard
    Next7DaysWidget.tsx
    DeadlineOverlapBanner.tsx
  /portfolio
    PortfolioList.tsx
    PortfolioForm.tsx
    PortfolioMatchBadge.tsx     -> shown inside AiSummaryCard when a match exists
  /detail
    LinksSection.tsx        -> Instagram + website link rows
    DocumentsSection.tsx    -> guidebook list + upload
    AiSummaryCard.tsx
    RundownList.tsx
    RundownItemForm.tsx
    NotificationLog.tsx
  /settings
    ExportDataButton.tsx
    RundownModeToggle.tsx
    ThemeToggle.tsx
  /layout
    AppShell.tsx
    OfflineBanner.tsx
    InstallPrompt.tsx
/hooks
  useCompetitions.ts
  useCompetitionDetail.ts
  useUploadGuidebook.ts
  useAiSummary.ts
  useRundown.ts
  usePortfolio.ts
  useUpcomingDeadlines.ts     -> powers Next7DaysWidget + DeadlineOverlapBanner
  useDuplicateCompetition.ts
  useDataExport.ts
/lib
  supabase-client.ts
  supabase-server.ts
  fonnte.ts          -> server-only, used inside Edge Functions
  ai-summary.ts       -> prompt template + response parsing
  date-format.ts
```

Rule of thumb: `ui/` components know nothing about competitions; `competitions/` and `detail/` components know nothing about Supabase directly (they call hooks); hooks are the only place that talk to Supabase or API routes. This keeps any single file small and testable.

### 7.3 Data Model (Supabase / Postgres)

**`competitions`**

| Column | Type | Notes |
|---|---|---|
| id | uuid, PK | |
| name | text | |
| organizer | text | |
| theme | text | nullable |
| status | enum | researching, registered, in_progress, submitted, finalist, completed, not_selected |
| team_name | text | nullable, e.g. "REGEX" |
| instagram_url | text | nullable |
| website_url | text | nullable |
| registration_deadline | timestamptz | nullable |
| submission_deadline | timestamptz | nullable |
| event_start_at | timestamptz | nullable |
| event_end_at | timestamptz | nullable |
| location | text | nullable |
| tags | text[] | competition type tags, e.g. {hackathon, ui_ux} |
| cloned_from_id | uuid, FK, nullable | set when created via Duplicate, points to the source competition |
| notes | text | nullable |
| created_at | timestamptz | default now() |
| updated_at | timestamptz | |

**`competition_documents`**

| Column | Type | Notes |
|---|---|---|
| id | uuid, PK | |
| competition_id | uuid, FK | |
| file_name | text | |
| cloudinary_public_id | text | returned from Cloudinary on upload |
| cloudinary_url | text | secure delivery URL, resource_type `raw` |
| doc_type | enum | guidebook, addendum, template, other — all PDF only |
| extracted_text | text | nullable, cached extraction for AI reuse |
| uploaded_at | timestamptz | |

**`ai_summaries`**

| Column | Type | Notes |
|---|---|---|
| id | uuid, PK | |
| competition_id | uuid, FK | |
| document_id | uuid, FK | source document |
| summary | text | |
| key_requirements | jsonb | array of strings |
| judging_criteria | jsonb | array of strings |
| extracted_dates | jsonb | array of {label, date} |
| theme | text | nullable |
| sub_theme | text | nullable |
| project_ideas | jsonb | array of {idea, rationale} |
| portfolio_matches | jsonb | array of {portfolio_id, note}, nullable |
| model_used | text | |
| generated_at | timestamptz | |

**`project_portfolio`**

| Column | Type | Notes |
|---|---|---|
| id | uuid, PK | |
| name | text | e.g. an existing app/concept Danu has built |
| description | text | |
| themes | text[] | tags used to match against new competitions' extracted theme/sub-theme |
| used_in_competitions | uuid[] | competition ids this concept has already been submitted to, for IP-conflict checks |
| tech_stack | text | nullable |
| created_at | timestamptz | |

**`rundown_items`**

| Column | Type | Notes |
|---|---|---|
| id | uuid, PK | |
| competition_id | uuid, FK | |
| title | text | |
| description | text | nullable |
| event_at | timestamptz | |
| reminder_offsets_minutes | int[] | overrides default settings if set |

**`notification_logs`**

| Column | Type | Notes |
|---|---|---|
| id | uuid, PK | |
| rundown_item_id | uuid, FK | |
| channel | text | "whatsapp" |
| message | text | |
| status | enum | sent, failed |
| sent_at | timestamptz | |

**`user_settings`**

| Column | Type | Notes |
|---|---|---|
| id | uuid, PK | |
| whatsapp_number | text | single number, v1 |
| default_reminder_offsets_minutes | int[] | e.g. [1440, 180] |
| timezone | text | default "Asia/Makassar" |
| rundown_generation_mode | enum | auto, manual — default "auto" |
| theme_preference | enum | light, dark — default "light" |

Row Level Security is enabled on every table, scoped to the authenticated user's `auth.uid()`, even though v1 is single-user — this keeps the schema safe to extend to team accounts later without a rewrite.

### 7.4 AI Summary Pipeline

1. Client requests a signed upload from an Edge Function, then uploads the PDF directly to Cloudinary using the signed params → the Edge Function stores the returned `cloudinary_public_id`/`cloudinary_url` in `competition_documents`
2. A second Edge Function (triggered by upload completion or a manual "Generate summary" button) fetches the PDF from Cloudinary and extracts text (PDF parsing only — no other formats)
3. Text sent to the AI model with a fixed structured-JSON prompt matching the `ai_summaries` columns, including the theme/sub-theme extraction and project idea generation
4. Before returning the advice, the function queries `project_portfolio` for rows whose `themes` overlap the extracted theme/sub-theme and attaches any matches as `portfolio_matches`
5. Response parsed and validated before insert; on parse failure, the raw response is stored with a `needs_review` flag rather than silently failing
6. Frontend reads via `useAiSummary`, cached with TanStack Query, shown with a skeleton while generating

### 7.5 WhatsApp Notification Pipeline

1. `pg_cron` triggers an Edge Function every 15 minutes
2. Function queries `rundown_items` joined with `user_settings`, finds items whose `event_at minus offset` falls within the last 15 minutes and hasn't already logged a matching `notification_logs` row
3. For each match, calls the Fonnte `send` endpoint server-side with the device token from environment secrets
4. Logs result (success/failure) to `notification_logs`
5. Failed sends are retried on the next cron tick, up to a small max-attempt count, and surfaced in the Notification Log UI with a `failed` badge rather than retried silently forever

### 7.6 Caching Strategy

- **Data layer**: TanStack Query caches all Supabase reads client-side, with background revalidation on window focus and a short stale time for the dashboard list, longer for static things like a finalized guidebook's AI summary
- **Static assets & app shell**: cached by the service worker (Workbox `staleWhileRevalidate` for the shell, `cacheFirst` for icons/fonts, `networkFirst` for API calls that fall back to cache when offline)
- **Guidebook files**: not force-cached offline by default (can be large); only the AI-generated summary is cached for offline reading, since that's what's actually needed on the go

### 7.7 Cloudinary Integration Notes

- Uploads are **signed**, never unsigned/open — an Edge Function generates a short-lived signature using the Cloudinary API secret (kept server-side only) and returns it to the client along with the API key and timestamp
- The client uploads the PDF directly to Cloudinary's REST endpoint using those signed params, so the file never passes through Supabase, and the API secret never reaches the browser
- Resource type is set to `raw` (Cloudinary's non-image file handling) with a folder convention like `competition-hub/{competition_id}/` for organization
- Only the `cloudinary_public_id` and `secure_url` come back into the app's database — Cloudinary itself is the source of truth for the file bytes

### 7.8 PWA Implementation Notes

- Web App Manifest: app name "Competition Hub", short name, theme color matching the design system, icons at 192/512px, `display: standalone`
- Service worker registers on first load; install prompt shown via a dismissible banner component (`InstallPrompt.tsx`), not a popup
- Offline state detected via `navigator.onLine` + a lightweight ping, surfaced through `OfflineBanner.tsx`

## 8. Non-Functional Requirements

- Dashboard initial load under ~1.5s on a typical mobile connection after first cache warm-up
- All list/detail views must render a skeleton within 100ms of navigation, never a blank screen
- File uploads limited to a sane size (e.g., 20MB) with clear progress and error states
- WhatsApp (Fonnte) token, AI API keys, and the Cloudinary API secret all live only in Supabase Edge Function secrets, never in the client bundle. Only Cloudinary's public API key (needed to construct signed upload requests) is exposed client-side, which is standard for signed-upload flows.

## 9. Success Metrics (personal, informal)

- Every active competition has an entry within a day of deciding to join
- Zero missed deadlines that had a rundown item entered
- AI summary is actually read before writing a proposal, instead of re-reading the full guidebook

## 10. Phased Roadmap

**Phase 1 — MVP**
Competition CRUD with tags, status board/list with filtering, links + guidebook upload (PDF via Cloudinary), auto-generated rundown items from deadline fields with a manual-mode toggle, one WhatsApp reminder offset, light/dark toggle (default light), Duplicate competition action, Next 7 Days widget, Deadline Overlap Warning, PWA installable shell, skeleton loading throughout.

**Phase 2**
AI summary + theme-based project idea suggestions, Project Portfolio page with reuse/IP-conflict matching, notification log with retry/failure visibility, offline caching of summaries, multiple reminder offsets per item.

**Phase 3**
Full data export, shareable export of a competition/summary as text (for handing to Yogi or REGEX teammates), optional team member field surfaced in UI.

## 11. Decisions Log

| Question | Decision |
|---|---|
| Auto vs manual rundown generation | Default **Auto**; a Settings toggle allows switching to **Manual**. See 5.5. |
| One WhatsApp number or a group number too | **One number only** for v1. |
| Guidebook file formats | **PDF only**. No DOCX, no other formats, in v1. |
| File storage provider | **Cloudinary**, signed uploads, `raw` resource type — not Supabase Storage. |
| Theme | Manual **light/dark toggle**, default **light**, preference synced via `user_settings`. |
| What "advice" means | Not generic tips — **concrete project idea suggestions** matched to the competition's extracted theme/sub-theme, cross-checked against a personal Project Portfolio for reuse and IP-conflict awareness. |
| Recommended additions (Portfolio, Next 7 Days, tagging, duplicate, export, overlap warning) | **All accepted** — folded into committed scope as sections 5.7–5.10, with schema in 7.3 and phased into the roadmap in Section 10. |
