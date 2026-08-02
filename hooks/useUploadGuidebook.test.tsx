import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useUploadGuidebook } from './useUploadGuidebook'

const uploadMock = vi.fn().mockResolvedValue({ data: { path: 'comp-1/123_guidebook.pdf' }, error: null })
const getPublicUrlMock = vi.fn().mockReturnValue({ data: { publicUrl: 'https://test.supabase.co/storage/v1/object/public/guidebooks/comp-1/123_guidebook.pdf' } })
const insertMock = vi.fn().mockResolvedValue({ error: null })
const fromMock = vi.fn().mockReturnValue({ insert: insertMock })

vi.mock('@/lib/supabase/client', () => ({
  createClient: () => ({
    storage: {
      from: () => ({
        upload: uploadMock,
        getPublicUrl: getPublicUrlMock,
      }),
    },
    from: fromMock,
  }),
}))

describe('useUploadGuidebook', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    uploadMock.mockResolvedValue({ data: { path: 'comp-1/123_guidebook.pdf' }, error: null })
    getPublicUrlMock.mockReturnValue({ data: { publicUrl: 'https://test.supabase.co/storage/v1/object/public/guidebooks/comp-1/123_guidebook.pdf' } })
    insertMock.mockResolvedValue({ error: null })
  })

  it('uploads file to Supabase Storage and inserts a document row', async () => {
    const { result } = renderHook(() => useUploadGuidebook('comp-1'))
    const file = new File([new Uint8Array(10)], 'guidebook.pdf', { type: 'application/pdf' })

    await act(async () => {
      await result.current.upload(file)
    })

    expect(uploadMock).toHaveBeenCalledWith(expect.stringContaining('comp-1/'), file, expect.any(Object))
    expect(fromMock).toHaveBeenCalledWith('competition_documents')
    expect(insertMock).toHaveBeenCalledWith(
      expect.objectContaining({
        competition_id: 'comp-1',
        file_name: 'guidebook.pdf',
        cloudinary_public_id: 'comp-1/123_guidebook.pdf',
        cloudinary_url: 'https://test.supabase.co/storage/v1/object/public/guidebooks/comp-1/123_guidebook.pdf',
        doc_type: 'guidebook',
      })
    )
    expect(result.current.status).toBe('done')
  })

  it('sets status to error when storage upload fails', async () => {
    uploadMock.mockResolvedValueOnce({ data: null, error: { message: 'Storage Error' } })

    const { result } = renderHook(() => useUploadGuidebook('comp-1'))
    const file = new File([new Uint8Array(10)], 'guidebook.pdf', { type: 'application/pdf' })

    await act(async () => {
      await result.current.upload(file)
    })

    expect(result.current.status).toBe('error')
    expect(result.current.error).toBe('Storage Error')
  })
})
