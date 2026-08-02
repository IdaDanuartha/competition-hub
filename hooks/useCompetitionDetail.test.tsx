import { describe, it, expect, vi } from 'vitest'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { renderHook, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { useCompetitionDetail } from './useCompetitionDetail'

const mockCompetition = { id: '1', name: 'Comp A' }
const single = vi.fn().mockResolvedValue({ data: mockCompetition, error: null })
const eq = vi.fn().mockReturnValue({ single })
const select = vi.fn().mockReturnValue({ eq })
const from = vi.fn().mockReturnValue({ select })

vi.mock('@/lib/supabase/client', () => ({
  createClient: () => ({ from }),
}))

function wrapper({ children }: { children: ReactNode }) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
}

describe('useCompetitionDetail', () => {
  it('fetches a single competition by id', async () => {
    const { result } = renderHook(() => useCompetitionDetail('1'), { wrapper })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data).toEqual(mockCompetition)
    expect(eq).toHaveBeenCalledWith('id', '1')
  })
})
