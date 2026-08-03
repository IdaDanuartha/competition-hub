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
