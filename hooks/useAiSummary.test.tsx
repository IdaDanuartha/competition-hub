import { describe, it, expect, vi } from 'vitest'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { renderHook, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { useAiSummary } from './useAiSummary'

const mockSummary = {
  id: 's1',
  competition_id: 'c1',
  summary: 'Great competition overview',
  key_requirements: ['Max 3 members'],
  important_dates: ['Submission: 2026-09-01'],
  judging_criteria: ['Innovation 40%'],
  theme_and_subtheme: 'AI & Web',
  project_idea_suggestions: [{ title: 'Idea 1', description: 'Desc 1', rationale: 'Rationale 1' }],
  model_used: 'gemini-2.5-flash',
  created_at: '',
  updated_at: '',
}

const maybeSingle = vi.fn().mockResolvedValue({ data: mockSummary, error: null })
const eq = vi.fn().mockReturnValue({ maybeSingle })
const select = vi.fn().mockReturnValue({ eq })
const from = vi.fn().mockReturnValue({ select })

vi.mock('@/lib/supabase/client', () => ({
  createClient: () => ({ from }),
}))

function wrapper({ children }: { children: ReactNode }) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
}

describe('useAiSummary', () => {
  it('fetches AI summary for a competition', async () => {
    const { result } = renderHook(() => useAiSummary('c1'), { wrapper })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data).toEqual(mockSummary)
    expect(eq).toHaveBeenCalledWith('competition_id', 'c1')
  })
})
