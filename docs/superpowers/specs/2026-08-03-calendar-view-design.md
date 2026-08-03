# Calendar View — Design Spec

Date: 2026-08-03

## Purpose

Users track many competition deadlines/events (registration, submission, event start/end, plus manual rundown items). The existing "Next 7 Days" widget only shows a short rolling window, so users can't see the full month at a glance or spot bunching/overlap beyond a week out. A dedicated calendar page gives a month-level view of all rundown events across competitions.

## Scope

- New route: `/calendar`.
- Shows all `rundown_items` for the logged-in user's competitions, across a month grid, with day-level detail on click.
- No filtering (status/tag/team) in this iteration — all events for all (non-cancelled or all, see Data below) competitions show. Filtering can be added later if needed.
- Desktop nav gets a new entry. Mobile bottom nav is unchanged (3 slots stay as-is); calendar is reachable via desktop nav / direct URL on mobile too (page itself is responsive, just not in the bottom tab bar).

## Data

Source table: `rundown_items` (see `supabase/migrations/0001_init.sql`):
- `id`, `competition_id`, `title`, `description`, `event_at`, `reminder_offsets_minutes`, `is_auto_generated`, `auto_source`, `created_at`.
- `auto_source` values set by `supabase/migrations/0002_auto_rundown.sql`: `registration_deadline`, `submission_deadline`, `event_start_at`, `event_end_at`. Manually-created items have `auto_source = null`.

New hook: `hooks/useCalendarRundownItems.ts`

```ts
useCalendarRundownItems(monthStart: Date, monthEnd: Date)
```

- React Query, query key `['calendar-rundown-items', monthStart.toISOString(), monthEnd.toISOString()]`.
- Supabase query: `rundown_items` select `id, title, event_at, competition_id, auto_source, competitions(name, status)` filtered `event_at >= monthStart` and `event_at <= monthEnd`, ordered by `event_at` ascending.
- Range passed in should cover the full visible grid (including the leading/trailing days from adjacent months shown to fill the 7-col grid), not just the 1st–last of the month, so events on those spillover cells still show.
- RLS already scopes `rundown_items` to competitions owned by the current user (existing policy), no extra filtering needed client-side.

## Route & Navigation

- `app/(app)/calendar/page.tsx` — client component (`'use client'`), same layout container pattern as `dashboard/page.tsx` (`mx-auto max-w-5xl space-y-6 py-6`).
- `components/layout/AppShell.tsx`: add a `Link` to `/calendar` in the desktop `<nav>` (between Dashboard and "Tanya AI" button), using `CalendarDays` icon from `lucide-react` (already imported elsewhere in the codebase, e.g. `Next7DaysWidget.tsx`). Active state follows the same `cn(...)` pattern keyed off `pathname === '/calendar'`.
- No changes to the mobile fixed bottom nav in this iteration.

## Components

All new, under `components/calendar/`:

### `CalendarPage` (the page itself, `app/(app)/calendar/page.tsx`)
- Owns state: `currentMonth: Date` (defaults to today, first-of-month), `selectedDay: Date | null` (defaults to today if today falls within the initially-shown month, else `null`).
- Computes the visible grid range (leading/trailing days to fill weeks) and month display range, passes both to `useCalendarRundownItems`.
- Renders: month nav header, `CalendarLegend`, `CalendarGrid`, `CalendarDayList`.

### `CalendarGrid`
- Props: `month: Date`, `events: CalendarEvent[]`, `selectedDay: Date | null`, `onSelectDay: (day: Date) => void`.
- Custom-built 7-column CSS grid (Tailwind `grid grid-cols-7`), no external calendar library — matches project convention of hand-rolled components over deps for UI (e.g. `CompetitionBoard`, `CompetitionTable`).
- Each day cell shows the date number, and up to 3 colored dots (one per event that day, colored by category — see below); a 4th+ event shows as `+N` text instead of a 4th dot.
- Today's cell gets a subtle highlight ring; selected day gets a solid highlight (same visual language as the view-switcher toggle: `bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900` for the strong state).
- Days outside the current month (grid spillover) render dimmed/muted text.
- Clicking a cell calls `onSelectDay(day)`.

### `CalendarDayList`
- Props: `day: Date | null`, `events: CalendarEvent[]`.
- Lists events for the selected day: title, competition name (as a `Link` to `/competitions/[competition_id]`), formatted time (`formatDateTime` from `lib/date-format`, matching `Next7DaysWidget`), and a small colored category badge.
- Empty state ("No events on this day") when `day` is set but no events match, matching the empty-state style already used in `Next7DaysWidget` (muted icon + text).
- If `day` is `null` (e.g., grid loaded but nothing selected), show a neutral prompt ("Select a day to see details").

### `CalendarLegend`
- Small inline row of colored dot + label pairs for the 5 categories (4 auto-sources + manual), shown once above or beside the grid.

### Category → color mapping (shared util, e.g. `lib/calendar-categories.ts`)
```ts
registration_deadline → sky
submission_deadline   → rose
event_start_at        → emerald
event_end_at          → amber
null (manual)         → violet
```
Exposed as a function `getCategoryColor(autoSource: string | null)` returning Tailwind class names (dot bg, badge bg/text) for light+dark, following the existing dual-class dark-mode pattern used throughout (e.g. `bg-sky-100 dark:bg-sky-950/80 text-sky-700 dark:text-sky-300`).

## Interactions

- Prev / Next / Today buttons in the header change `currentMonth` (Today also resets `selectedDay` to today).
- Clicking a day cell in `CalendarGrid` sets `selectedDay` and updates `CalendarDayList`.
- Clicking an event row in `CalendarDayList` navigates to `/competitions/[competition_id]`.

## Loading / Error / Empty states

- Loading: skeleton grid (pulse blocks in place of the month grid), same visual language as `dashboard/page.tsx`'s loading skeleton (`h-40`/`h-64` pulse blocks — here sized to a 6-row×7-col grid).
- Error: inline message with a retry action, sourced from React Query's `error`/`refetch`, consistent with how other hooks surface Supabase errors (thrown in `queryFn`, surfaced via `error` in the consuming component).
- Empty month (no events at all): grid still renders (all cells empty), `CalendarDayList` shows its own empty state per selected day.

## Testing

- `hooks/useCalendarRundownItems.test.ts` — mocks Supabase client, asserts the date-range filter is applied and the query key changes per month.
- `components/calendar/CalendarGrid.test.tsx` — renders a month, asserts correct number of dots and colors per day, asserts click calls `onSelectDay`.
- `components/calendar/CalendarDayList.test.tsx` — renders event list for a day, renders empty state, renders link hrefs correctly.
- `components/layout/AppShell.test.tsx` (if one exists) or a light smoke check — new nav link renders and marks active on `/calendar`.

## Out of scope (this iteration)

- Status/tag/team filtering on the calendar page.
- Mobile bottom-nav slot for Calendar.
- Week/day view modes (month only).
- Drag-to-reschedule or inline event editing from the calendar (all edits still happen via the competition detail page / rundown tab).
