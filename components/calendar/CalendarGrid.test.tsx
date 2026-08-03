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
  // Built with local-time constructors (not UTC ISO literals) so the grid's
  // local-time day-bucketing is exercised consistently regardless of the
  // machine timezone running the tests: the same local wall-clock semantics
  // are used both to construct these fixtures and to bucket them in the
  // component, so the test is timezone-independent by construction rather
  // than by pinning a specific offset.
  const month = new Date(2026, 7, 1)
  const events = [
    makeEvent('1', new Date(2026, 7, 10, 15, 0, 0).toISOString(), 'submission_deadline'),
    makeEvent('2', new Date(2026, 7, 10, 9, 0, 0).toISOString(), 'registration_deadline'),
    makeEvent('3', new Date(2026, 7, 20, 9, 0, 0).toISOString(), null),
  ]

  it('renders a day cell for every day in the month', () => {
    render(<CalendarGrid month={month} events={events} selectedDay={null} onSelectDay={vi.fn()} />)

    // August 2026 spillover means adjacent-month cells also show "1" (Sep 1)
    // and "31" (Jul 31), so scope the query to the in-month cell via the
    // `data-current-month` attribute on the day's button.
    const inMonthDay1 = screen
      .getAllByText('1')
      .find((el) => el.closest('button')?.getAttribute('data-current-month') === 'true')
    const inMonthDay31 = screen
      .getAllByText('31')
      .find((el) => el.closest('button')?.getAttribute('data-current-month') === 'true')

    expect(inMonthDay1).toBeInTheDocument()
    expect(inMonthDay31).toBeInTheDocument()
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
    expect(calledWith.getDate()).toBe(20)
  })
})
