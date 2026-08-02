import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { RundownList } from './RundownList'
import type { RundownItem } from '@/lib/types/database'

function renderWithClient(ui: React.ReactElement) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>)
}

function item(overrides: Partial<RundownItem>): RundownItem {
  return {
    id: '1', competition_id: 'c1', title: 'Briefing', description: null,
    event_at: '2026-03-01T09:00:00Z', reminder_offsets_minutes: null,
    is_auto_generated: false, auto_source: null, created_at: '', ...overrides,
  }
}

describe('RundownList', () => {
  it('renders each item with an auto-generated marker when applicable', () => {
    const items = [
      item({ id: '1', title: 'Submission deadline', is_auto_generated: true }),
      item({ id: '2', title: 'Pitching day' }),
    ]
    renderWithClient(<RundownList items={items} />)
    expect(screen.getByText('Submission deadline')).toBeInTheDocument()
    expect(screen.getByText('Pitching day')).toBeInTheDocument()
    expect(screen.getByText(/auto/i)).toBeInTheDocument()
  })

  it('shows an empty state', () => {
    renderWithClient(<RundownList items={[]} />)
    expect(screen.getByText(/no rundown items/i)).toBeInTheDocument()
  })
})
