import { describe, it, expect, vi } from 'vitest'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { renderHook, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { useUpcomingDeadlines } from './useUpcomingDeadlines'

const mockRows = [{ id: '1', title: 'Briefing', event_at: '2026-03-01T09:00:00Z', competition_id: 'c1', competitions: { name: 'BYTESFEST' } }]
const order = vi.fn().mockResolvedValue({ data: mockRows, error: null })
const lte = vi.fn().mockReturnValue({ order })
const gte = vi.fn().mockReturnValue({ lte })
const select = vi.fn().mockReturnValue({ gte })
const from = vi.fn().mockReturnValue({ select })

vi.mock('@/lib/supabase/client', () => ({
  createClient: () => ({ from }),
}))

function wrapper({ children }: { children: ReactNode }) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
}

describe('useUpcomingDeadlines', () => {
  it('fetches rundown items within the next 7 days, ordered chronologically', async () => {
    const { result } = renderHook(() => useUpcomingDeadlines(), { wrapper })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data).toEqual(mockRows)
    expect(order).toHaveBeenCalledWith('event_at', { ascending: true })
  })
})
