'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import { createClient } from '@/lib/supabase/client'

const STORAGE_BUCKET = 'guidebooks'

export function useUploadGuidebook(competitionId: string) {
  const [progress, setProgress] = useState(0)
  const [status, setStatus] = useState<'idle' | 'uploading' | 'done' | 'error'>('idle')
  const [error, setError] = useState<string | null>(null)

  async function upload(file: File) {
    setProgress(0)
    setStatus('uploading')
    setError(null)

    const supabase = createClient()

    try {
      // Upload to Supabase Storage (public bucket — no auth issues)
      const filePath = `${competitionId}/${Date.now()}_${file.name}`

      const { data: storageData, error: storageErr } = await supabase.storage
        .from(STORAGE_BUCKET)
        .upload(filePath, file, {
          contentType: 'application/pdf',
          upsert: false,
        })

      if (storageErr) {
        setStatus('error')
        setError(storageErr.message)
        toast.error(`Upload gagal: ${storageErr.message}`)
        return
      }

      setProgress(80)

      // Get the public URL
      const { data: urlData } = supabase.storage
        .from(STORAGE_BUCKET)
        .getPublicUrl(storageData.path)

      const publicUrl = urlData.publicUrl
      setProgress(90)

      // Save to DB
      const { error: insertError } = await supabase.from('competition_documents').insert({
        competition_id: competitionId,
        file_name: file.name,
        cloudinary_public_id: storageData.path, // reuse field for storage path
        cloudinary_url: publicUrl,              // reuse field for public URL
        doc_type: 'guidebook',
      })

      if (insertError) {
        setStatus('error')
        setError(insertError.message)
        toast.error(`Simpan dokumen gagal: ${insertError.message}`)
        return
      }

      setProgress(100)
      setStatus('done')
      toast.success(`Dokumen "${file.name}" berhasil diunggah!`)
    } catch (e: any) {
      const errMsg = e?.message || 'Upload failed'
      setStatus('error')
      setError(errMsg)
      toast.error(errMsg)
    }
  }

  return { upload, progress, status, error }
}
