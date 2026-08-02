import { describe, it, expect, vi } from 'vitest'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { Next7DaysWidget } from './Next7DaysWidget'

vi.mock('@/hooks/useUpcomingDeadlines', () => ({
  useUpcomingDeadlines: () => ({
    data: [{ id: '1', title: 'Briefing', event_at: '2026-03-01T09:00:00Z', competition_id: 'c1', competitions: { name: 'BYTESFEST' } }],
    isLoading: false,
  }),
}))

function wrapper({ children }: { children: ReactNode }) {
  const queryClient = new QueryClient()
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
}

describe('Next7DaysWidget', () => {
  it('links each item to its competition', async () => {
    render(<Next7DaysWidget />, { wrapper })
    await waitFor(() => expect(screen.getByText('Briefing')).toBeInTheDocument())
    expect(screen.getByRole('link', { name: /BYTESFEST/i })).toHaveAttribute('href', '/competitions/c1')
  })
})
