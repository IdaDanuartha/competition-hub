import { describe, it, expect, vi } from 'vitest'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { renderHook, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { useRundownItems } from './useRundown'

const mockItems = [{ id: '1', competition_id: 'c1', title: 'Briefing', event_at: '2026-03-01T00:00:00Z' }]
const order = vi.fn().mockResolvedValue({ data: mockItems, error: null })
const eq = vi.fn().mockReturnValue({ order })
const select = vi.fn().mockReturnValue({ eq })
const from = vi.fn().mockReturnValue({ select })

vi.mock('@/lib/supabase/client', () => ({
  createClient: () => ({ from }),
}))

function wrapper({ children }: { children: ReactNode }) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
}

describe('useRundownItems', () => {
  it('fetches rundown items for a competition ordered by event_at', async () => {
    const { result } = renderHook(() => useRundownItems('c1'), { wrapper })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data).toEqual(mockItems)
    expect(eq).toHaveBeenCalledWith('competition_id', 'c1')
    expect(order).toHaveBeenCalledWith('event_at', { ascending: true })
  })
})
