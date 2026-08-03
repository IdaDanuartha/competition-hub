// app/(app)/calendar/page.test.tsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import CalendarPage from './page'
import type { CalendarRundownItem } from '@/hooks/useCalendarRundownItems'

// Pick a fixed day-of-month that is deterministically NOT today, in the same
// local month/year as `currentMonth`'s default (the current month), so the
// event lands on a current-month grid cell other than the one selected by
// default (today). Falls back to the 6th on the rare day today is the 5th,
// to avoid flaking near month boundaries. Local-time constructors are used
// throughout (rather than UTC) because the page now buckets days by local
// time, so the fixture must match that semantic to stay deterministic
// regardless of the machine timezone running the tests.
const today = new Date()
const mockEventDay = today.getDate() === 5 ? 6 : 5
const mockEventDate = new Date(today.getFullYear(), today.getMonth(), mockEventDay, 12, 0, 0)

const mockEvent: CalendarRundownItem = {
  id: '1',
  title: 'Submission deadline',
  event_at: mockEventDate.toISOString(),
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

    // "Submission deadline" is both the event title (rendered in the day
    // list) and the legend's category label for that same category, so we
    // scope every check to <p> elements — the event-title element in
    // CalendarDayList — never the legend's <div>.
    const titleParagraphs = () => screen.getAllByText('Submission deadline').filter((el) => el.tagName === 'P')

    // Default-selected day is today, which has no events (the mock event is
    // on mockEventDay, not today) — proves the initial render shows nothing
    // for today, so the later assertion can't pass "for free".
    expect(titleParagraphs()).toHaveLength(0)

    // The grid shows spillover days from adjacent months, which can share the
    // same day-of-month digit as the target day — scope to the current-month
    // cell via the `data-current-month` attribute.
    const targetButton = screen
      .getAllByText(String(mockEventDay))
      .map((el) => el.closest('button'))
      .find((button) => button?.getAttribute('data-current-month') === 'true') as HTMLElement
    fireEvent.click(targetButton)

    // Clicking the target day updated `selectedDay`, so its event now shows.
    expect(titleParagraphs()).toHaveLength(1)
  })
})
