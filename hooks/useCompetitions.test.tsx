// hooks/useCompetitions.test.tsx
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { renderHook, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { useCompetitions, useUpdateCompetitionStatus } from './useCompetitions'

const mockCompetitions = [
  { id: '1', name: 'Comp A', status: 'researching', created_at: '2026-01-01' },
]

const order = vi.fn().mockResolvedValue({ data: mockCompetitions, error: null })
const select = vi.fn().mockReturnValue({ order })
const eq = vi.fn().mockResolvedValue({ error: null })
const update = vi.fn().mockReturnValue({ eq })
const from = vi.fn().mockReturnValue({ select, update })

vi.mock('@/lib/supabase/client', () => ({
  createClient: () => ({ from }),
}))

function wrapper({ children }: { children: ReactNode }) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
}

beforeEach(() => {
  from.mockClear()
})

describe('useCompetitions', () => {
  it('fetches competitions ordered by created_at desc', async () => {
    const { result } = renderHook(() => useCompetitions(), { wrapper })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data).toEqual(mockCompetitions)
    expect(from).toHaveBeenCalledWith('competitions')
    expect(order).toHaveBeenCalledWith('created_at', { ascending: false })
  })
})

describe('useUpdateCompetitionStatus', () => {
  it('updates the status column for the given id', async () => {
    const { result } = renderHook(() => useUpdateCompetitionStatus(), { wrapper })
    result.current.mutate({ id: '1', status: 'submitted' })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(update).toHaveBeenCalledWith({ status: 'submitted' })
    expect(eq).toHaveBeenCalledWith('id', '1')
  })
})
