// components/competitions/CompetitionTable.test.tsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { CompetitionTable } from './CompetitionTable'
import type { Competition } from '@/lib/types/database'

vi.mock('@/hooks/useCompetitions', () => ({
  useUpdateCompetitionStatus: () => ({
    mutate: vi.fn(),
  }),
}))

function comp(overrides: Partial<Competition>): Competition {
  return {
    id: overrides.id ?? '1', user_id: 'u', name: overrides.name ?? 'Comp',
    organizer: null, theme: null, status: overrides.status ?? 'researching',
    team_name: null, instagram_url: null, website_url: null,
    registration_deadline: null, submission_deadline: overrides.submission_deadline ?? null,
    event_start_at: null, event_end_at: null, location: null,
    tags: overrides.tags ?? [], cloned_from_id: null, notes: null,
    created_at: '2026-01-01', updated_at: '2026-01-01', ...overrides,
  }
}

describe('CompetitionTable', () => {
  it('renders one row per competition with name and status', () => {
    const rows = [comp({ id: '1', name: 'BYTESFEST' }), comp({ id: '2', name: 'Hackalab' })]
    render(<CompetitionTable competitions={rows} sortKey="name" onSortKeyChange={() => {}} />)
    expect(screen.getByText('BYTESFEST')).toBeInTheDocument()
    expect(screen.getByText('Hackalab')).toBeInTheDocument()
  })

  it('sorts by name ascending when sortKey is name', () => {
    const rows = [comp({ id: '1', name: 'Zeta' }), comp({ id: '2', name: 'Alpha' })]
    render(<CompetitionTable competitions={rows} sortKey="name" onSortKeyChange={() => {}} />)
    const cells = screen.getAllByTestId('competition-row-name')
    expect(cells[0]).toHaveTextContent('Alpha')
    expect(cells[1]).toHaveTextContent('Zeta')
  })

  it('shows an empty state when there are no competitions', () => {
    render(<CompetitionTable competitions={[]} sortKey="name" onSortKeyChange={() => {}} />)
    expect(screen.getByText(/no competitions/i)).toBeInTheDocument()
  })
})
