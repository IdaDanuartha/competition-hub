import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor, act } from '@testing-library/react'
import { useUploadGuidebook } from './useUploadGuidebook'

const functionsInvoke = vi.fn().mockResolvedValue({
  data: { signature: 'sig', timestamp: 123, apiKey: 'key', cloudName: 'cloud', folder: 'competition-hub/comp-1' },
  error: null,
})

const insert = vi.fn().mockResolvedValue({ error: null })
const dbFrom = vi.fn().mockReturnValue({ insert })

vi.mock('@/lib/supabase/client', () => ({
  createClient: () => ({
    functions: { invoke: functionsInvoke },
    from: dbFrom,
  }),
}))

describe('useUploadGuidebook', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    functionsInvoke.mockResolvedValue({
      data: { signature: 'sig', timestamp: 123, apiKey: 'key', cloudName: 'cloud', folder: 'competition-hub/comp-1' },
      error: null,
    })
    insert.mockResolvedValue({ error: null })
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ public_id: 'competition-hub/comp-1/guidebook', secure_url: 'https://res.cloudinary.com/demo/image/upload/guidebook.pdf' }),
    }) as unknown as typeof fetch
  })

  it('requests signature and uploads file to Cloudinary, then inserts a document row', async () => {
    const { result } = renderHook(() => useUploadGuidebook('comp-1'))
    const file = new File([new Uint8Array(10)], 'guidebook.pdf', { type: 'application/pdf' })

    await act(async () => {
      await result.current.upload(file)
    })

    expect(functionsInvoke).toHaveBeenCalledWith('cloudinary-sign', { body: { competitionId: 'comp-1' } })
    expect(global.fetch).toHaveBeenCalledWith(expect.stringContaining('api.cloudinary.com'), expect.any(Object))
    expect(dbFrom).toHaveBeenCalledWith('competition_documents')
    expect(insert).toHaveBeenCalledWith(
      expect.objectContaining({
        competition_id: 'comp-1',
        file_name: 'guidebook.pdf',
        cloudinary_public_id: 'competition-hub/comp-1/guidebook',
        cloudinary_url: 'https://res.cloudinary.com/demo/image/upload/guidebook.pdf',
        doc_type: 'guidebook',
      })
    )
    await waitFor(() => expect(result.current.status).toBe('done'))
  })

  it('sets status to error when Cloudinary upload fails', async () => {
    global.fetch = vi.fn().mockResolvedValueOnce({
      ok: false,
      json: async () => ({ error: { message: 'Cloudinary Upload Error' } }),
    }) as unknown as typeof fetch

    const { result } = renderHook(() => useUploadGuidebook('comp-1'))
    const file = new File([new Uint8Array(10)], 'guidebook.pdf', { type: 'application/pdf' })

    await act(async () => {
      await result.current.upload(file)
    })

    expect(result.current.status).toBe('error')
    expect(result.current.error).toBe('Cloudinary Upload Error')
  })
})
