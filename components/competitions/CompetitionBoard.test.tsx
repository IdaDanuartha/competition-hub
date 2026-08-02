import { describe, it, expect, vi } from 'vitest'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { ReactNode } from 'react'
import { CompetitionBoard } from './CompetitionBoard'
import type { Competition } from '@/lib/types/database'

const mutate = vi.fn()
vi.mock('@/hooks/useCompetitions', () => ({
  useUpdateCompetitionStatus: () => ({ mutate }),
}))

function comp(overrides: Partial<Competition>): Competition {
  return {
    id: overrides.id ?? '1', user_id: 'u', name: overrides.name ?? 'Comp',
    organizer: null, theme: null, status: overrides.status ?? 'researching',
    team_name: null, instagram_url: null, website_url: null,
    registration_deadline: null, submission_deadline: null,
    event_start_at: null, event_end_at: null, location: null,
    tags: [], cloned_from_id: null, notes: null,
    created_at: '2026-01-01', updated_at: '2026-01-01', ...overrides,
  }
}

function wrapper({ children }: { children: ReactNode }) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
}

describe('CompetitionBoard', () => {
  it('places each competition under its status column', () => {
    const rows = [comp({ id: '1', name: 'A', status: 'researching' }), comp({ id: '2', name: 'B', status: 'submitted' })]
    render(<CompetitionBoard competitions={rows} />, { wrapper })
    expect(screen.getByRole('heading', { name: /Researching/i })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: /Submitted/i })).toBeInTheDocument()
    expect(screen.getByText('A')).toBeInTheDocument()
    expect(screen.getByText('B')).toBeInTheDocument()
  })

  it('calls useUpdateCompetitionStatus.mutate when a card is moved', async () => {
    const rows = [comp({ id: '1', name: 'A', status: 'researching' })]
    render(<CompetitionBoard competitions={rows} />, { wrapper })
    const select = screen.getByLabelText(/move a/i)
    await userEvent.selectOptions(select, 'submitted')
    expect(mutate).toHaveBeenCalledWith({ id: '1', status: 'submitted' })
  })
})
