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
    // The grid shows spillover days from adjacent months, which can share the
    // same day-of-month digit as today (e.g. today is the 3rd and a trailing
    // spillover day is also the 3rd) — scope to the current-month cell.
    const todayButton = screen
      .getAllByText(String(today.getUTCDate()))
      .map((el) => el.closest('button'))
      .find((button) => button?.getAttribute('data-current-month') === 'true') as HTMLElement
    fireEvent.click(todayButton)
    // "Submission deadline" is both the event title (rendered in the day list)
    // and the legend's category label for that same category — scope to the
    // title element (a <p>) so the assertion checks the actual event, not the
    // legend text that was already on screen before the click.
    const titleMatches = screen.getAllByText('Submission deadline').filter((el) => el.tagName === 'P')
    expect(titleMatches).toHaveLength(1)
    expect(titleMatches[0]).toBeInTheDocument()
  })
})
