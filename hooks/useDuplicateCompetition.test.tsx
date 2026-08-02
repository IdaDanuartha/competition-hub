import { describe, it, expect, vi } from 'vitest'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { renderHook, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { useDuplicateCompetition } from './useDuplicateCompetition'
import type { Competition } from '@/lib/types/database'

const single = vi.fn().mockResolvedValue({
  data: { id: 'new-id', name: 'BYTESFEST 2026 — Copy' },
  error: null,
})
const select = vi.fn().mockReturnValue({ single })
const insert = vi.fn().mockReturnValue({ select })
const from = vi.fn().mockReturnValue({ insert })

vi.mock('@/lib/supabase/client', () => ({
  createClient: () => ({ from }),
}))

function wrapper({ children }: { children: ReactNode }) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
}

const source: Competition = {
  id: 'orig', user_id: 'u', name: 'BYTESFEST 2026', organizer: 'Uni X', theme: 'Sustainability',
  status: 'finalist', team_name: 'REGEX', instagram_url: 'https://instagram.com/x', website_url: 'https://x.com',
  registration_deadline: '2026-01-01', submission_deadline: '2026-02-01', event_start_at: '2026-03-01',
  event_end_at: '2026-03-02', location: 'Solo', tags: ['hackathon'], cloned_from_id: null,
  notes: 'some notes', created_at: '', updated_at: '',
}

describe('useDuplicateCompetition', () => {
  it('copies only structural fields and resets status, dates, and links', async () => {
    const { result } = renderHook(() => useDuplicateCompetition(), { wrapper })
    result.current.mutate(source)
    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    const inserted = insert.mock.calls[0][0]
    expect(inserted.name).toBe('BYTESFEST 2026 — Copy')
    expect(inserted.organizer).toBe('Uni X')
    expect(inserted.theme).toBe('Sustainability')
    expect(inserted.team_name).toBe('REGEX')
    expect(inserted.tags).toEqual(['hackathon'])
    expect(inserted.notes).toBe('some notes')
    expect(inserted.cloned_from_id).toBe('orig')
    expect(inserted.status).toBe('researching')
    expect(inserted.registration_deadline).toBeUndefined()
    expect(inserted.submission_deadline).toBeUndefined()
    expect(inserted.instagram_url).toBeUndefined()
    expect(inserted.website_url).toBeUndefined()
  })
})
