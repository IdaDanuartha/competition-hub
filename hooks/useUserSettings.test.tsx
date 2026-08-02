import { describe, it, expect, vi } from 'vitest'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { renderHook, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { useUserSettings } from './useUserSettings'

const mockSettings = { id: 'u1', whatsapp_number: '6281234567890', rundown_generation_mode: 'auto', theme_preference: 'light' }
const maybeSingle = vi.fn().mockResolvedValue({ data: mockSettings, error: null })
const eq = vi.fn().mockReturnValue({ maybeSingle })
const select = vi.fn().mockReturnValue({ eq })
const from = vi.fn().mockReturnValue({ select })
const getUser = vi.fn().mockResolvedValue({ data: { user: { id: 'u1' } } })

vi.mock('@/lib/supabase/client', () => ({
  createClient: () => ({ from, auth: { getUser } }),
}))

function wrapper({ children }: { children: ReactNode }) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
}

describe('useUserSettings', () => {
  it('fetches settings for the current user', async () => {
    const { result } = renderHook(() => useUserSettings(), { wrapper })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data).toEqual(mockSettings)
    expect(eq).toHaveBeenCalledWith('id', 'u1')
  })
})
