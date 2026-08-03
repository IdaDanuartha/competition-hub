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
    expect(screen.getByText('Submission deadline', { selector: 'p' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /BYTESFEST/i })).toHaveAttribute('href', '/competitions/c1')
    expect(screen.getByText('Submission deadline', { selector: 'span' })).toBeInTheDocument()
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
