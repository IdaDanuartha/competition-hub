import { describe, it, expect, vi } from 'vitest'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { renderHook, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { usePortfolio } from './usePortfolio'

const mockEntries = [
  { id: 'p1', user_id: 'u1', name: 'Project Alpha', description: 'AI Bot', tags: ['AI', 'Web'], tech_stack: ['Next.js'], used_in_competitions: ['c1'], created_at: '', updated_at: '' },
]
const order = vi.fn().mockResolvedValue({ data: mockEntries, error: null })
const select = vi.fn().mockReturnValue({ order })
const from = vi.fn().mockReturnValue({ select })

vi.mock('@/lib/supabase/client', () => ({
  createClient: () => ({ from }),
}))

function wrapper({ children }: { children: ReactNode }) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
}

describe('usePortfolio', () => {
  it('fetches portfolio entries ordered by created_at desc', async () => {
    const { result } = renderHook(() => usePortfolio(), { wrapper })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data).toEqual(mockEntries)
    expect(order).toHaveBeenCalledWith('created_at', { ascending: false })
  })
})
