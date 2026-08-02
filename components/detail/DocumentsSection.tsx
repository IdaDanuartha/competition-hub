'use client'

import { useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { FileText, Download, Trash2, Loader2 } from 'lucide-react'
import { FileDropzone } from '@/components/ui/FileDropzone'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { useUploadGuidebook } from '@/hooks/useUploadGuidebook'
import { useDeleteDocument } from '@/hooks/useCompetitionDetail'
import { useGenerateAiSummary } from '@/hooks/useAiSummary'
import type { CompetitionDocument } from '@/lib/types/database'

const MAX_SIZE_BYTES = 20 * 1024 * 1024

function formatSize(bytes: number | null): string {
  if (!bytes) return ''
  return `${(bytes / 1024 / 1024).toFixed(1)}MB`
}

export function DocumentsSection({
  competitionId,
  documents,
}: {
  competitionId: string
  documents: CompetitionDocument[]
}) {
  const queryClient = useQueryClient()
  const { upload, status, error } = useUploadGuidebook(competitionId)
  const { mutateAsync: generateAiSummary, isPending: isGeneratingAi } = useGenerateAiSummary()
  const { mutate: deleteDoc } = useDeleteDocument(competitionId)
  const [deleteTarget, setDeleteTarget] = useState<CompetitionDocument | null>(null)

  const sorted = [...documents].sort(
    (a, b) => new Date(b.uploaded_at).getTime() - new Date(a.uploaded_at).getTime()
  )

  async function handleFile(file: File) {
    await upload(file)
    queryClient.invalidateQueries({ queryKey: ['competition-documents', competitionId] })
    try {
      await generateAiSummary({ competitionId })
    } catch (err) {
      console.warn('Auto AI summary generation after upload failed:', err)
    }
  }

  const isProcessing = status === 'uploading' || isGeneratingAi

  return (
    <div className="space-y-3">
      {sorted.length > 0 && (
        <ul className="space-y-2">
          {sorted.map((doc) => {
            const documentViewUrl = `/api/documents/view?url=${encodeURIComponent(doc.cloudinary_url)}&name=${encodeURIComponent(doc.file_name)}`
            return (
              <li key={doc.id} className="flex items-center gap-2 rounded-md border border-zinc-200 p-2.5 text-sm dark:border-zinc-800">
                <FileText className="h-4 w-4 shrink-0 text-zinc-500" />
                <a
                  href={documentViewUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex-1 truncate hover:underline text-zinc-900 dark:text-zinc-50 font-medium"
                >
                  {doc.file_name}
                </a>
                <span className="text-xs text-zinc-400">{formatSize(null)}</span>
                <a
                  href={documentViewUrl}
                  download={doc.file_name}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={`Download ${doc.file_name}`}
                >
                  <Download className="h-4 w-4 text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200" />
                </a>
                <button
                  type="button"
                  onClick={() => setDeleteTarget(doc)}
                  className="text-zinc-400 hover:text-red-600 dark:hover:text-red-400"
                  aria-label={`Delete ${doc.file_name}`}
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </li>
            )
          })}
        </ul>
      )}

      <ConfirmDialog
        isOpen={Boolean(deleteTarget)}
        title="Delete Document"
        description={`Are you sure you want to delete "${deleteTarget?.file_name}"?`}
        confirmLabel="Delete Document"
        onConfirm={() => {
          if (deleteTarget) {
            deleteDoc(deleteTarget.id)
            setDeleteTarget(null)
          }
        }}
        onClose={() => setDeleteTarget(null)}
      />

      <FileDropzone
        accept="application/pdf"
        maxSizeBytes={MAX_SIZE_BYTES}
        onFileSelected={handleFile}
        disabled={isProcessing}
      />
      {isProcessing && (
        <p className="flex items-center gap-2 text-sm text-zinc-600 dark:text-zinc-400">
          <Loader2 className="h-4 w-4 animate-spin text-amber-500" />
          {status === 'uploading' ? 'Uploading guidebook...' : 'Analyzing guidebook & generating timeline with AI...'}
        </p>
      )}
      {status === 'error' && error && <p className="text-sm text-red-600">{error}</p>}
    </div>
  )
}
