import { describe, it, expect, vi } from 'vitest'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { renderHook, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { useDataExport } from './useDataExport'

const mockData = {
  competitions: [{ id: 'c1', name: 'BYTESFEST' }],
  documents: [{ id: 'd1', file_name: 'guide.pdf' }],
  rundown_items: [],
  ai_summaries: [],
  portfolio_entries: [],
}

const from = vi.fn().mockReturnValue({
  select: vi.fn().mockResolvedValue({ data: [], error: null }),
})

vi.mock('@/lib/supabase/client', () => ({
  createClient: () => ({ from }),
}))

function wrapper({ children }: { children: ReactNode }) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
}

describe('useDataExport', () => {
  it('provides a trigger to export JSON data', async () => {
    const { result } = renderHook(() => useDataExport(), { wrapper })
    expect(result.current.exportData).toBeDefined()
  })
})
