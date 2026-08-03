# Calendar View Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a `/calendar` page that shows every `rundown_items` event across the user's competitions in a month grid, color-coded by category, with a day-detail panel and desktop nav entry.

**Architecture:** Client-side page (`'use client'`) following the existing Next.js 16 App Router + TanStack Query + Supabase pattern used by `dashboard/page.tsx`. A new query hook fetches `rundown_items` (joined to `competitions(name, status)`) for the visible grid's date range. Two new presentational components (`CalendarGrid`, `CalendarDayList`) render the grid and the selected day's events; a small color-mapping util drives category coloring. No new dependencies, no server routes, no schema changes — this is spec: `docs/superpowers/specs/2026-08-03-calendar-view-design.md`.

**Tech Stack:** Next.js 16 (App Router, TypeScript), Tailwind CSS 4, lucide-react, @tanstack/react-query, @supabase/supabase-js (browser client via `lib/supabase/client.ts`), Vitest + @testing-library/react.

## Global Constraints

- No emoji anywhere in UI — icons from `lucide-react` only.
- Skeleton loading (pulse blocks), not spinners, for the data-fetching surface (matches `dashboard/page.tsx`).
- No new filtering (status/tag/team) on this page — out of scope per spec.
- No changes to the mobile bottom nav — desktop nav only.
- Month view only — no week/day view, no drag-to-reschedule.
- Follow existing dual light/dark Tailwind class pattern (e.g. `bg-sky-100 dark:bg-sky-950/80 text-sky-700 dark:text-sky-300`) for every new colored element.
- Hooks are the only layer allowed to call Supabase directly (`lib/supabase/client.ts`); components consume hooks only.

---

## File Structure

```
lib/
  calendar-categories.ts       -> auto_source -> Tailwind color classes + label mapping
  calendar-categories.test.ts
hooks/
  useCalendarRundownItems.ts   -> React Query hook, fetches rundown_items in a date range
components/
  calendar/
    CalendarDayList.tsx        -> event list + empty state for the selected day
    CalendarDayList.test.tsx
    CalendarGrid.tsx           -> month grid, day cells, event dots, day selection
    CalendarGrid.test.tsx
  layout/
    AppShell.tsx               -> MODIFY: add "Calendar" link to desktop nav
app/
  (app)/
    calendar/
      page.tsx                 -> page: month/day state, data fetching, composition
      page.test.tsx
```

## Interfaces (cross-task contract)

```ts
// lib/calendar-categories.ts
export type CalendarCategory = 'registration_deadline' | 'submission_deadline' | 'event_start_at' | 'event_end_at' | 'manual'
export function getCalendarCategory(autoSource: string | null): CalendarCategory
export function getCategoryColorClasses(category: CalendarCategory): { dot: string; badgeBg: string; badgeText: string }
export function getCategoryLabel(category: CalendarCategory): string
export const ALL_CALENDAR_CATEGORIES: CalendarCategory[]

// hooks/useCalendarRundownItems.ts
export interface CalendarRundownItem {
  id: string
  title: string
  event_at: string
  competition_id: string
  auto_source: string | null
  competitions: { name: string; status: string } | null
}
export function useCalendarRundownItems(rangeStart: Date, rangeEnd: Date): UseQueryResult<CalendarRundownItem[]>

// components/calendar/CalendarGrid.tsx
export interface CalendarGridProps {
  month: Date // any date within the displayed month
  events: CalendarRundownItem[]
  selectedDay: Date | null
  onSelectDay: (day: Date) => void
}
export function CalendarGrid(props: CalendarGridProps): JSX.Element

// components/calendar/CalendarDayList.tsx
export interface CalendarDayListProps {
  day: Date | null
  events: CalendarRundownItem[]
}
export function CalendarDayList(props: CalendarDayListProps): JSX.Element
```

---

### Task 1: Category color mapping util

**Files:**
- Create: `lib/calendar-categories.ts`
- Test: `lib/calendar-categories.test.ts`

**Interfaces:**
- Produces: `CalendarCategory`, `getCalendarCategory`, `getCategoryColorClasses`, `getCategoryLabel`, `ALL_CALENDAR_CATEGORIES` (see contract above). Consumed by Tasks 3, 4, 5.

- [ ] **Step 1: Write the failing test**

```ts
// lib/calendar-categories.test.ts
import { describe, it, expect } from 'vitest'
import {
  getCalendarCategory,
  getCategoryColorClasses,
  getCategoryLabel,
  ALL_CALENDAR_CATEGORIES,
} from './calendar-categories'

describe('getCalendarCategory', () => {
  it('maps known auto_source values to their category', () => {
    expect(getCalendarCategory('registration_deadline')).toBe('registration_deadline')
    expect(getCalendarCategory('submission_deadline')).toBe('submission_deadline')
    expect(getCalendarCategory('event_start_at')).toBe('event_start_at')
    expect(getCalendarCategory('event_end_at')).toBe('event_end_at')
  })

  it('maps null (manual items) to manual', () => {
    expect(getCalendarCategory(null)).toBe('manual')
  })

  it('maps unrecognized values to manual as a safe fallback', () => {
    expect(getCalendarCategory('something_new')).toBe('manual')
  })
})

describe('getCategoryColorClasses', () => {
  it('returns dot/badge classes for every category', () => {
    for (const category of ALL_CALENDAR_CATEGORIES) {
      const classes = getCategoryColorClasses(category)
      expect(classes.dot).toBeTruthy()
      expect(classes.badgeBg).toBeTruthy()
      expect(classes.badgeText).toBeTruthy()
    }
  })

  it('gives each category a visually distinct dot color', () => {
    const dots = ALL_CALENDAR_CATEGORIES.map((c) => getCategoryColorClasses(c).dot)
    expect(new Set(dots).size).toBe(ALL_CALENDAR_CATEGORIES.length)
  })
})

describe('getCategoryLabel', () => {
  it('returns a human-readable label for every category', () => {
    expect(getCategoryLabel('registration_deadline')).toBe('Registration deadline')
    expect(getCategoryLabel('submission_deadline')).toBe('Submission deadline')
    expect(getCategoryLabel('event_start_at')).toBe('Event starts')
    expect(getCategoryLabel('event_end_at')).toBe('Event ends')
    expect(getCategoryLabel('manual')).toBe('Manual / custom')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run lib/calendar-categories.test.ts`
Expected: FAIL with "Cannot find module './calendar-categories'"

- [ ] **Step 3: Write minimal implementation**

```ts
// lib/calendar-categories.ts
export type CalendarCategory =
  | 'registration_deadline'
  | 'submission_deadline'
  | 'event_start_at'
  | 'event_end_at'
  | 'manual'

export const ALL_CALENDAR_CATEGORIES: CalendarCategory[] = [
  'registration_deadline',
  'submission_deadline',
  'event_start_at',
  'event_end_at',
  'manual',
]

const KNOWN_SOURCES: Record<string, CalendarCategory> = {
  registration_deadline: 'registration_deadline',
  submission_deadline: 'submission_deadline',
  event_start_at: 'event_start_at',
  event_end_at: 'event_end_at',
}

export function getCalendarCategory(autoSource: string | null): CalendarCategory {
  if (!autoSource) return 'manual'
  return KNOWN_SOURCES[autoSource] ?? 'manual'
}

const COLOR_CLASSES: Record<CalendarCategory, { dot: string; badgeBg: string; badgeText: string }> = {
  registration_deadline: {
    dot: 'bg-sky-500',
    badgeBg: 'bg-sky-100 dark:bg-sky-950/80',
    badgeText: 'text-sky-700 dark:text-sky-300',
  },
  submission_deadline: {
    dot: 'bg-rose-500',
    badgeBg: 'bg-rose-100 dark:bg-rose-950/80',
    badgeText: 'text-rose-700 dark:text-rose-300',
  },
  event_start_at: {
    dot: 'bg-emerald-500',
    badgeBg: 'bg-emerald-100 dark:bg-emerald-950/80',
    badgeText: 'text-emerald-700 dark:text-emerald-300',
  },
  event_end_at: {
    dot: 'bg-amber-500',
    badgeBg: 'bg-amber-100 dark:bg-amber-950/80',
    badgeText: 'text-amber-700 dark:text-amber-300',
  },
  manual: {
    dot: 'bg-violet-500',
    badgeBg: 'bg-violet-100 dark:bg-violet-950/80',
    badgeText: 'text-violet-700 dark:text-violet-300',
  },
}

export function getCategoryColorClasses(category: CalendarCategory) {
  return COLOR_CLASSES[category]
}

const LABELS: Record<CalendarCategory, string> = {
  registration_deadline: 'Registration deadline',
  submission_deadline: 'Submission deadline',
  event_start_at: 'Event starts',
  event_end_at: 'Event ends',
  manual: 'Manual / custom',
}

export function getCategoryLabel(category: CalendarCategory): string {
  return LABELS[category]
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run lib/calendar-categories.test.ts`
Expected: PASS (7 tests)

- [ ] **Step 5: Commit**

```bash
git add lib/calendar-categories.ts lib/calendar-categories.test.ts
git commit -m "feat: add calendar category color mapping util"
```

---

### Task 2: `useCalendarRundownItems` data hook

**Files:**
- Create: `hooks/useCalendarRundownItems.ts`

**Interfaces:**
- Consumes: `createClient` from `@/lib/supabase/client` (existing, used identically in `hooks/useRundown.ts` and `hooks/useUpcomingDeadlines.ts`).
- Produces: `CalendarRundownItem` type and `useCalendarRundownItems(rangeStart: Date, rangeEnd: Date)` (see contract above). Consumed by Task 5 (`app/(app)/calendar/page.tsx`).

No dedicated hook test file: this codebase has no `hooks/*.test.ts` files anywhere (hook data-fetching is verified indirectly through component tests that mock the hook, e.g. `components/dashboard/Next7DaysWidget.test.tsx` mocks `useUpcomingDeadlines`). Task 5's page test follows the same pattern for this hook.

- [ ] **Step 1: Write the implementation**

```ts
// hooks/useCalendarRundownItems.ts
'use client'

import { useQuery } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'

export interface CalendarRundownItem {
  id: string
  title: string
  event_at: string
  competition_id: string
  auto_source: string | null
  competitions: { name: string; status: string } | null
}

export function useCalendarRundownItems(rangeStart: Date, rangeEnd: Date) {
  return useQuery({
    queryKey: ['calendar-rundown-items', rangeStart.toISOString(), rangeEnd.toISOString()],
    queryFn: async (): Promise<CalendarRundownItem[]> => {
      const supabase = createClient()
      const { data, error } = await supabase
        .from('rundown_items')
        .select('id, title, event_at, competition_id, auto_source, competitions(name, status)')
        .gte('event_at', rangeStart.toISOString())
        .lte('event_at', rangeEnd.toISOString())
        .order('event_at', { ascending: true })
      if (error) throw error
      return data as unknown as CalendarRundownItem[]
    },
  })
}
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: no new errors from this file.

- [ ] **Step 3: Commit**

```bash
git add hooks/useCalendarRundownItems.ts
git commit -m "feat: add useCalendarRundownItems hook"
```

---

### Task 3: `CalendarDayList` component

**Files:**
- Create: `components/calendar/CalendarDayList.tsx`
- Test: `components/calendar/CalendarDayList.test.tsx`

**Interfaces:**
- Consumes: `CalendarRundownItem` (Task 2), `getCalendarCategory` / `getCategoryColorClasses` / `getCategoryLabel` (Task 1), `formatDateTime` from `@/lib/date-format` (existing).
- Produces: `CalendarDayListProps`, `CalendarDayList` (see contract above). Consumed by Task 5.

- [ ] **Step 1: Write the failing test**

```tsx
// components/calendar/CalendarDayList.test.tsx
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { CalendarDayList } from './CalendarDayList'
import type { CalendarRundownItem } from '@/hooks/useCalendarRundownItems'

const event: CalendarRundownItem = {
  id: '1',
  title: 'Submission deadline',
  event_at: '2026-08-10T15:00:00Z',
  competition_id: 'c1',
  auto_source: 'submission_deadline',
  competitions: { name: 'BYTESFEST', status: 'in_progress' },
}

describe('CalendarDayList', () => {
  it('renders events for the given day, linking to the competition', () => {
    render(<CalendarDayList day={new Date('2026-08-10T00:00:00Z')} events={[event]} />)
    expect(screen.getByText('Submission deadline')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /BYTESFEST/i })).toHaveAttribute('href', '/competitions/c1')
    expect(screen.getByText('Submission deadline', { selector: 'span' }) || screen.getAllByText(/Submission deadline/i).length).toBeTruthy()
  })

  it('shows an empty state when a day has no events', () => {
    render(<CalendarDayList day={new Date('2026-08-11T00:00:00Z')} events={[]} />)
    expect(screen.getByText(/no events on this day/i)).toBeInTheDocument()
  })

  it('prompts to select a day when none is selected', () => {
    render(<CalendarDayList day={null} events={[]} />)
    expect(screen.getByText(/select a day/i)).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run components/calendar/CalendarDayList.test.tsx`
Expected: FAIL with "Cannot find module './CalendarDayList'"

- [ ] **Step 3: Write minimal implementation**

```tsx
// components/calendar/CalendarDayList.tsx
'use client'

import Link from 'next/link'
import { Clock, CalendarX2 } from 'lucide-react'
import { formatDateTime } from '@/lib/date-format'
import { getCalendarCategory, getCategoryColorClasses, getCategoryLabel } from '@/lib/calendar-categories'
import type { CalendarRundownItem } from '@/hooks/useCalendarRundownItems'

export interface CalendarDayListProps {
  day: Date | null
  events: CalendarRundownItem[]
}

export function CalendarDayList({ day, events }: CalendarDayListProps) {
  if (!day) {
    return (
      <div className="flex flex-col items-center gap-1.5 rounded-2xl border border-zinc-200 bg-white py-8 text-center dark:border-zinc-800 dark:bg-zinc-950">
        <Clock className="h-6 w-6 text-zinc-300 dark:text-zinc-700" />
        <p className="text-xs text-zinc-400 dark:text-zinc-500">Select a day to see details.</p>
      </div>
    )
  }

  return (
    <div className="rounded-2xl border border-zinc-200 bg-white overflow-hidden dark:border-zinc-800 dark:bg-zinc-950">
      <div className="border-b border-zinc-100 px-4 py-3 dark:border-zinc-800">
        <h3 className="text-xs font-semibold text-zinc-700 dark:text-zinc-200">
          {day.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
        </h3>
      </div>

      {events.length === 0 ? (
        <div className="flex flex-col items-center gap-1.5 py-6 text-center">
          <CalendarX2 className="h-6 w-6 text-zinc-300 dark:text-zinc-700" />
          <p className="text-xs text-zinc-400 dark:text-zinc-500">No events on this day.</p>
        </div>
      ) : (
        <div className="divide-y divide-zinc-50 dark:divide-zinc-800/60">
          {events.map((item) => {
            const category = getCalendarCategory(item.auto_source)
            const colors = getCategoryColorClasses(category)
            return (
              <div key={item.id} className="flex items-center justify-between gap-4 px-4 py-2.5">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-xs font-semibold text-zinc-900 dark:text-zinc-50">{item.title}</p>
                  {item.competitions && (
                    <Link
                      href={`/competitions/${item.competition_id}`}
                      className="block truncate text-[11px] font-medium text-sky-600 hover:underline dark:text-sky-400"
                    >
                      {item.competitions.name}
                    </Link>
                  )}
                  <span className={`mt-1 inline-block rounded-full px-2 py-0.5 text-[10px] font-bold ${colors.badgeBg} ${colors.badgeText}`}>
                    {getCategoryLabel(category)}
                  </span>
                </div>
                <span className="shrink-0 rounded-md bg-zinc-100 px-2 py-0.5 text-[11px] tabular-nums font-medium text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">
                  {formatDateTime(item.event_at)}
                </span>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run components/calendar/CalendarDayList.test.tsx`
Expected: PASS (3 tests)

- [ ] **Step 5: Commit**

```bash
git add components/calendar/CalendarDayList.tsx components/calendar/CalendarDayList.test.tsx
git commit -m "feat: add CalendarDayList component"
```

---

### Task 4: `CalendarGrid` component

**Files:**
- Create: `components/calendar/CalendarGrid.tsx`
- Test: `components/calendar/CalendarGrid.test.tsx`

**Interfaces:**
- Consumes: `CalendarRundownItem` (Task 2), `getCalendarCategory` / `getCategoryColorClasses` (Task 1).
- Produces: `CalendarGridProps`, `CalendarGrid` (see contract above). Consumed by Task 5.

- [ ] **Step 1: Write the failing test**

```tsx
// components/calendar/CalendarGrid.test.tsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { CalendarGrid } from './CalendarGrid'
import type { CalendarRundownItem } from '@/hooks/useCalendarRundownItems'

function makeEvent(id: string, isoDate: string, autoSource: string | null): CalendarRundownItem {
  return {
    id,
    title: `Event ${id}`,
    event_at: isoDate,
    competition_id: 'c1',
    auto_source: autoSource,
    competitions: { name: 'BYTESFEST', status: 'in_progress' },
  }
}

describe('CalendarGrid', () => {
  const month = new Date('2026-08-01T00:00:00Z')
  const events = [
    makeEvent('1', '2026-08-10T15:00:00Z', 'submission_deadline'),
    makeEvent('2', '2026-08-10T09:00:00Z', 'registration_deadline'),
    makeEvent('3', '2026-08-20T09:00:00Z', null),
  ]

  it('renders a day cell for every day in the month', () => {
    render(<CalendarGrid month={month} events={events} selectedDay={null} onSelectDay={vi.fn()} />)
    expect(screen.getByText('1')).toBeInTheDocument()
    expect(screen.getByText('31')).toBeInTheDocument()
  })

  it('renders one dot per event on a day with events', () => {
    const { container } = render(
      <CalendarGrid month={month} events={events} selectedDay={null} onSelectDay={vi.fn()} />
    )
    const day10Cell = screen.getByText('10').closest('button') as HTMLElement
    expect(day10Cell.querySelectorAll('[data-testid="calendar-event-dot"]')).toHaveLength(2)
  })

  it('calls onSelectDay with the clicked date', () => {
    const onSelectDay = vi.fn()
    render(<CalendarGrid month={month} events={events} selectedDay={null} onSelectDay={onSelectDay} />)
    fireEvent.click(screen.getByText('20').closest('button') as HTMLElement)
    expect(onSelectDay).toHaveBeenCalledTimes(1)
    const calledWith: Date = onSelectDay.mock.calls[0][0]
    expect(calledWith.getUTCDate()).toBe(20)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run components/calendar/CalendarGrid.test.tsx`
Expected: FAIL with "Cannot find module './CalendarGrid'"

- [ ] **Step 3: Write minimal implementation**

```tsx
// components/calendar/CalendarGrid.tsx
'use client'

import { cn } from '@/lib/cn'
import { getCalendarCategory, getCategoryColorClasses } from '@/lib/calendar-categories'
import type { CalendarRundownItem } from '@/hooks/useCalendarRundownItems'

export interface CalendarGridProps {
  month: Date
  events: CalendarRundownItem[]
  selectedDay: Date | null
  onSelectDay: (day: Date) => void
}

const WEEKDAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const MAX_DOTS_PER_DAY = 3

function isSameDay(a: Date, b: Date): boolean {
  return a.getUTCFullYear() === b.getUTCFullYear() && a.getUTCMonth() === b.getUTCMonth() && a.getUTCDate() === b.getUTCDate()
}

function buildGridDays(month: Date): Date[] {
  const year = month.getUTCFullYear()
  const monthIndex = month.getUTCMonth()
  const firstOfMonth = new Date(Date.UTC(year, monthIndex, 1))
  const startWeekday = firstOfMonth.getUTCDay()
  const daysInMonth = new Date(Date.UTC(year, monthIndex + 1, 0)).getUTCDate()

  const days: Date[] = []
  // Leading spillover from previous month.
  for (let i = startWeekday; i > 0; i--) {
    days.push(new Date(Date.UTC(year, monthIndex, 1 - i)))
  }
  // Days of the current month.
  for (let d = 1; d <= daysInMonth; d++) {
    days.push(new Date(Date.UTC(year, monthIndex, d)))
  }
  // Trailing spillover to complete the last week.
  while (days.length % 7 !== 0) {
    const last = days[days.length - 1]
    days.push(new Date(Date.UTC(last.getUTCFullYear(), last.getUTCMonth(), last.getUTCDate() + 1)))
  }
  return days
}

export function CalendarGrid({ month, events, selectedDay, onSelectDay }: CalendarGridProps) {
  const days = buildGridDays(month)
  const today = new Date()

  return (
    <div className="rounded-2xl border border-zinc-200 bg-white p-2 dark:border-zinc-800 dark:bg-zinc-950">
      <div className="grid grid-cols-7 gap-1 pb-1">
        {WEEKDAY_LABELS.map((label) => (
          <div key={label} className="py-1 text-center text-[10px] font-semibold text-zinc-400 dark:text-zinc-500">
            {label}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-1">
        {days.map((day) => {
          const dayEvents = events.filter((event) => isSameDay(new Date(event.event_at), day))
          const isCurrentMonth = day.getUTCMonth() === month.getUTCMonth()
          const isToday = isSameDay(day, today)
          const isSelected = selectedDay !== null && isSameDay(day, selectedDay)
          const visibleDots = dayEvents.slice(0, MAX_DOTS_PER_DAY)
          const overflowCount = dayEvents.length - visibleDots.length

          return (
            <button
              key={day.toISOString()}
              type="button"
              onClick={() => onSelectDay(day)}
              className={cn(
                'flex min-h-16 flex-col items-start gap-1 rounded-lg p-1.5 text-left transition-colors',
                isCurrentMonth ? 'text-zinc-900 dark:text-zinc-50' : 'text-zinc-300 dark:text-zinc-700',
                isSelected
                  ? 'bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900'
                  : 'hover:bg-zinc-50 dark:hover:bg-zinc-900',
                isToday && !isSelected && 'ring-1 ring-sky-400 dark:ring-sky-600'
              )}
            >
              <span className="text-[11px] font-semibold">{day.getUTCDate()}</span>
              <div className="flex flex-wrap gap-0.5">
                {visibleDots.map((event) => {
                  const colors = getCategoryColorClasses(getCalendarCategory(event.auto_source))
                  return <span key={event.id} data-testid="calendar-event-dot" className={cn('h-1.5 w-1.5 rounded-full', colors.dot)} />
                })}
                {overflowCount > 0 && <span className="text-[9px] font-medium">+{overflowCount}</span>}
              </div>
            </button>
          )
        })}
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run components/calendar/CalendarGrid.test.tsx`
Expected: PASS (3 tests)

- [ ] **Step 5: Commit**

```bash
git add components/calendar/CalendarGrid.tsx components/calendar/CalendarGrid.test.tsx
git commit -m "feat: add CalendarGrid component"
```

---

### Task 5: `/calendar` page

**Files:**
- Create: `app/(app)/calendar/page.tsx`
- Test: `app/(app)/calendar/page.test.tsx`

**Interfaces:**
- Consumes: `useCalendarRundownItems` (Task 2, mocked in test), `CalendarGrid` (Task 4), `CalendarDayList` (Task 3), `getCategoryColorClasses`/`getCategoryLabel`/`ALL_CALENDAR_CATEGORIES` (Task 1).
- Produces: default export page component at route `/calendar`. No further consumers within this plan (Task 6 links to this route).

- [ ] **Step 1: Write the failing test**

```tsx
// app/(app)/calendar/page.test.tsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import CalendarPage from './page'
import type { CalendarRundownItem } from '@/hooks/useCalendarRundownItems'

const mockEvent: CalendarRundownItem = {
  id: '1',
  title: 'Submission deadline',
  event_at: new Date().toISOString(),
  competition_id: 'c1',
  auto_source: 'submission_deadline',
  competitions: { name: 'BYTESFEST', status: 'in_progress' },
}

vi.mock('@/hooks/useCalendarRundownItems', () => ({
  useCalendarRundownItems: () => ({ data: [mockEvent], isLoading: false, error: null }),
}))

describe('CalendarPage', () => {
  it('renders the month grid and the legend', () => {
    render(<CalendarPage />)
    expect(screen.getByText(/registration deadline/i)).toBeInTheDocument()
    expect(screen.getByText(/manual \/ custom/i)).toBeInTheDocument()
  })

  it('shows day details after clicking a day with an event', () => {
    render(<CalendarPage />)
    const today = new Date()
    fireEvent.click(screen.getByText(String(today.getUTCDate())).closest('button') as HTMLElement)
    expect(screen.getByText('Submission deadline')).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run "app/(app)/calendar/page.test.tsx"`
Expected: FAIL with "Cannot find module './page'"

- [ ] **Step 3: Write minimal implementation**

```tsx
// app/(app)/calendar/page.tsx
'use client'

import { useMemo, useState } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { CalendarGrid } from '@/components/calendar/CalendarGrid'
import { CalendarDayList } from '@/components/calendar/CalendarDayList'
import { useCalendarRundownItems } from '@/hooks/useCalendarRundownItems'
import { ALL_CALENDAR_CATEGORIES, getCategoryColorClasses, getCategoryLabel } from '@/lib/calendar-categories'
import { Button } from '@/components/ui/Button'

function startOfMonth(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1))
}

function addMonths(date: Date, delta: number): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + delta, 1))
}

function gridRange(month: Date): { start: Date; end: Date } {
  const firstOfMonth = startOfMonth(month)
  const startWeekday = firstOfMonth.getUTCDay()
  const start = new Date(Date.UTC(firstOfMonth.getUTCFullYear(), firstOfMonth.getUTCMonth(), 1 - startWeekday))
  const daysInMonth = new Date(Date.UTC(firstOfMonth.getUTCFullYear(), firstOfMonth.getUTCMonth() + 1, 0)).getUTCDate()
  const lastOfMonth = new Date(Date.UTC(firstOfMonth.getUTCFullYear(), firstOfMonth.getUTCMonth(), daysInMonth))
  const trailingDays = (7 - ((lastOfMonth.getUTCDay() + 1) % 7)) % 7
  const end = new Date(Date.UTC(lastOfMonth.getUTCFullYear(), lastOfMonth.getUTCMonth(), lastOfMonth.getUTCDate() + trailingDays, 23, 59, 59))
  return { start, end }
}

export default function CalendarPage() {
  const [currentMonth, setCurrentMonth] = useState(() => startOfMonth(new Date()))
  const [selectedDay, setSelectedDay] = useState<Date | null>(() => new Date())

  const { start, end } = useMemo(() => gridRange(currentMonth), [currentMonth])
  const { data: events, isLoading, error } = useCalendarRundownItems(start, end)

  const dayEvents = useMemo(() => {
    if (!events || !selectedDay) return []
    return events.filter((event) => {
      const eventDate = new Date(event.event_at)
      return (
        eventDate.getUTCFullYear() === selectedDay.getUTCFullYear() &&
        eventDate.getUTCMonth() === selectedDay.getUTCMonth() &&
        eventDate.getUTCDate() === selectedDay.getUTCDate()
      )
    })
  }, [events, selectedDay])

  return (
    <div className="mx-auto max-w-5xl space-y-6 py-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-zinc-900 dark:text-zinc-50">Calendar</h1>
        <div className="flex items-center gap-2">
          <Button variant="secondary" size="sm" onClick={() => setCurrentMonth((m) => addMonths(m, -1))} aria-label="Previous month">
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="w-32 text-center text-sm font-semibold text-zinc-700 dark:text-zinc-200">
            {currentMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric', timeZone: 'UTC' })}
          </span>
          <Button variant="secondary" size="sm" onClick={() => setCurrentMonth((m) => addMonths(m, 1))} aria-label="Next month">
            <ChevronRight className="h-4 w-4" />
          </Button>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => {
              setCurrentMonth(startOfMonth(new Date()))
              setSelectedDay(new Date())
            }}
          >
            Today
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap gap-3">
        {ALL_CALENDAR_CATEGORIES.map((category) => {
          const colors = getCategoryColorClasses(category)
          return (
            <div key={category} className="flex items-center gap-1.5 text-[11px] text-zinc-600 dark:text-zinc-400">
              <span className={`h-2 w-2 rounded-full ${colors.dot}`} />
              {getCategoryLabel(category)}
            </div>
          )
        })}
      </div>

      {isLoading && (
        <div className="grid grid-cols-7 gap-1">
          {Array.from({ length: 42 }).map((_, i) => (
            <div key={i} className="h-16 rounded-lg bg-zinc-100 animate-pulse dark:bg-zinc-900" />
          ))}
        </div>
      )}

      {error && (
        <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-xs text-red-700 dark:border-red-900 dark:bg-red-950/50 dark:text-red-300">
          Failed to load calendar events.
        </div>
      )}

      {!isLoading && !error && (
        <div className="grid gap-4 md:grid-cols-[2fr_1fr]">
          <CalendarGrid month={currentMonth} events={events ?? []} selectedDay={selectedDay} onSelectDay={setSelectedDay} />
          <CalendarDayList day={selectedDay} events={dayEvents} />
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run "app/(app)/calendar/page.test.tsx"`
Expected: PASS (2 tests)

- [ ] **Step 5: Commit**

```bash
git add "app/(app)/calendar/page.tsx" "app/(app)/calendar/page.test.tsx"
git commit -m "feat: add /calendar page"
```

---

### Task 6: Desktop nav entry

**Files:**
- Modify: `components/layout/AppShell.tsx:1-53` (imports and desktop `<nav>` block)

**Interfaces:**
- Consumes: route `/calendar` (Task 5). No new exports.

- [ ] **Step 1: Add the `CalendarDays` icon import**

In `components/layout/AppShell.tsx`, change:

```tsx
import { LayoutDashboard, Settings, Sparkles } from 'lucide-react'
```

to:

```tsx
import { LayoutDashboard, Settings, Sparkles, CalendarDays } from 'lucide-react'
```

- [ ] **Step 2: Add an active-state check for `/calendar`**

Immediately after the existing line:

```tsx
const isDashboardActive = pathname === '/dashboard' || pathname.startsWith('/competitions')
```

add:

```tsx
const isCalendarActive = pathname === '/calendar'
```

- [ ] **Step 3: Add the nav link in the desktop `<nav>`**

Insert this block right after the closing `</Link>` of the Dashboard link (before the "Tanya AI" `<button>`):

```tsx
          <Link
            href="/calendar"
            className={cn(
              'flex items-center gap-1.5 text-sm transition-colors hover:text-zinc-900 dark:hover:text-zinc-50',
              isCalendarActive ? 'font-semibold text-sky-600 dark:text-sky-400' : 'text-zinc-600 dark:text-zinc-400'
            )}
          >
            <CalendarDays className="h-4 w-4" />
            Calendar
          </Link>
```

- [ ] **Step 4: Write a smoke test for the new link**

```tsx
// components/layout/AppShell.test.tsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { AppShell } from './AppShell'

vi.mock('next/navigation', () => ({
  usePathname: () => '/calendar',
}))

vi.mock('./OfflineBanner', () => ({ OfflineBanner: () => null }))
vi.mock('./InstallPrompt', () => ({ InstallPrompt: () => null }))
vi.mock('./AiHubSelectorModal', () => ({ AiHubSelectorModal: () => null }))
vi.mock('@/components/settings/ThemeToggle', () => ({ ThemeToggle: () => null }))

describe('AppShell', () => {
  it('renders a Calendar link marked active on /calendar', () => {
    render(<AppShell>content</AppShell>)
    const link = screen.getByRole('link', { name: /calendar/i })
    expect(link).toHaveAttribute('href', '/calendar')
    expect(link.className).toMatch(/text-sky-600/)
  })
})
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run components/layout/AppShell.test.tsx`
Expected: PASS (1 test)

- [ ] **Step 6: Run the full test suite**

Run: `npx vitest run`
Expected: all tests pass, including the new calendar tests from Tasks 1–5.

- [ ] **Step 7: Commit**

```bash
git add components/layout/AppShell.tsx components/layout/AppShell.test.tsx
git commit -m "feat: add Calendar link to desktop nav"
```

---

## Post-plan verification

- [ ] `npx tsc --noEmit` — no type errors.
- [ ] `npx vitest run` — full suite green.
- [ ] Manually visit `/calendar` in the dev server: month grid renders, clicking a day shows its events (or empty state), prev/next/Today buttons change the visible month, clicking an event's competition name navigates to `/competitions/[id]`, desktop nav highlights "Calendar" when active.
