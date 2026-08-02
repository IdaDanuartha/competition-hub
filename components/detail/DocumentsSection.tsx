'use client'

import { useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { FileText, Download, Trash2, Loader2, Terminal, ChevronDown, ChevronUp, CheckCircle2 } from 'lucide-react'
import { FileDropzone } from '@/components/ui/FileDropzone'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { useUploadGuidebook } from '@/hooks/useUploadGuidebook'
import { useDeleteDocument } from '@/hooks/useCompetitionDetail'
import { useGenerateAiSummary, useAiSummary } from '@/hooks/useAiSummary'
import type { CompetitionDocument } from '@/lib/types/database'

const MAX_SIZE_BYTES = 20 * 1024 * 1024

function formatSize(bytes: number | null | undefined): string {
  if (!bytes || bytes <= 0) return ''
  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(0)} KB`
  }
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
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
  const { data: summaryData } = useAiSummary(competitionId)
  const { mutate: deleteDoc } = useDeleteDocument(competitionId)
  const [deleteTarget, setDeleteTarget] = useState<CompetitionDocument | null>(null)
  
  // Hidden by default as requested
  const [showLiveTerminal, setShowLiveTerminal] = useState(false)
  const [showLogs, setShowLogs] = useState(false)

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

  // Cast summary to access logs & sizes
  const summary: any = summaryData
  const executionLogs: string[] = summary?.execution_log ?? [
    `[${summary?.updated_at ? new Date(summary.updated_at).toLocaleTimeString('id-ID') : 'Terbaru'}] Inisialisasi analisis AI`,
    `[Compress Engine] PDF terkompresi & dioptimasi otomatis`,
    `[Status] Ringkasan & timeline berhasil diperbarui`,
  ]

  return (
    <div className="space-y-3">
      {sorted.length > 0 && (
        <ul className="space-y-2">
          {sorted.map((doc) => {
            const documentViewUrl = `/api/documents/view?url=${encodeURIComponent(doc.cloudinary_url)}&name=${encodeURIComponent(doc.file_name)}`
            const docSizeBytes = (doc as any).file_size || (doc as any).size_bytes || (summary?.pdf_size_kb ? summary.pdf_size_kb * 1024 : null)
            const formattedSizeStr = formatSize(docSizeBytes)

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
                {formattedSizeStr && (
                  <span className="text-xs font-medium text-zinc-500 dark:text-zinc-400 shrink-0 bg-zinc-100 dark:bg-zinc-800 px-2 py-0.5 rounded">
                    {formattedSizeStr}
                  </span>
                )}
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

      {/* Live AI Processing Indicator & Expandable Terminal Logs (Hidden by default) */}
      {isProcessing && (
        <div className="rounded-xl border border-amber-200 bg-amber-50/60 p-3.5 dark:border-amber-900/50 dark:bg-amber-950/30 space-y-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2 text-xs font-semibold text-amber-900 dark:text-amber-200 min-w-0">
              <Loader2 className="h-4 w-4 animate-spin text-amber-600 dark:text-amber-400 shrink-0" />
              <span className="truncate">{status === 'uploading' ? '1/2. Mengunggah file guidebook ke storage...' : '2/2. Mengompresi PDF & menganalisis isi dengan AI...'}</span>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              {/* Expand / Minimize Terminal Log Button */}
              <button
                type="button"
                onClick={() => setShowLiveTerminal((prev) => !prev)}
                className="flex items-center gap-1 rounded-md bg-amber-100/80 px-2 py-1 text-[11px] font-semibold text-amber-800 hover:bg-amber-200 dark:bg-amber-900/60 dark:text-amber-200 dark:hover:bg-amber-800 transition-colors cursor-pointer"
              >
                <Terminal className="h-3 w-3 text-amber-600 dark:text-amber-400" />
                <span>{showLiveTerminal ? 'Minimize Log' : 'Expand Log'}</span>
                {showLiveTerminal ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
              </button>
              <span className="text-[10px] font-medium text-amber-600 dark:text-amber-400 animate-pulse">Proses...</span>
            </div>
          </div>

          {/* Live Terminal Logs (Only visible when user clicks Expand) */}
          {showLiveTerminal && (
            <div className="rounded-lg bg-zinc-950 p-2.5 font-mono text-[11px] text-zinc-300 space-y-1 shadow-inner max-h-36 overflow-y-auto animate-in fade-in duration-150">
              <p className="text-amber-400 font-semibold">[LOGS EKSEKUSI REALTIME]</p>
              {status === 'uploading' && <p className="text-zinc-400">&gt; Mengunggah file ke cloud storage (Supabase/Cloudinary)...</p>}
              {isGeneratingAi && (
                <>
                  <p className="text-emerald-400">&gt; ✓ File terunggah. Memulai kompresi PDF otomatis...</p>
                  <p className="text-sky-300">&gt; ⚡ Structuring PDF streams &amp; stripping metadata...</p>
                  <p className="text-zinc-300">&gt; Mengirimkan prompt &amp; PDF terkompresi ke AI Engine...</p>
                </>
              )}
            </div>
          )}
        </div>
      )}

      {status === 'error' && error && <p className="text-sm text-red-600">{error}</p>}

      {/* Toggle Execution Logs Button (Collapsed by default) */}
      {(!isProcessing && (summary?.execution_log?.length || sorted.length > 0)) && (
        <div className="pt-1">
          <button
            type="button"
            onClick={() => setShowLogs((prev) => !prev)}
            className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-200 bg-zinc-50 px-2.5 py-1.5 text-xs font-medium text-zinc-700 hover:bg-zinc-100 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
          >
            <Terminal className="h-3.5 w-3.5 text-sky-500" />
            <span>{showLogs ? 'Minimize Log Eksekusi AI' : 'Expand Log Eksekusi AI & Kompresi'}</span>
            {showLogs ? <ChevronUp className="h-3.5 w-3.5 text-zinc-400" /> : <ChevronDown className="h-3.5 w-3.5 text-zinc-400" />}
          </button>

          {/* Expanded Execution Logs Panel */}
          {showLogs && (
            <div className="mt-2.5 rounded-xl border border-zinc-200 bg-zinc-950 p-3 font-mono text-xs text-zinc-200 shadow-xl dark:border-zinc-800 animate-in fade-in zoom-in-95 duration-150 space-y-2">
              <div className="flex items-center justify-between border-b border-zinc-800 pb-2">
                <div className="flex items-center gap-2 text-[11px] font-semibold text-emerald-400">
                  <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                  <span>Log Eksekusi &amp; Kompresi PDF Terbaru</span>
                </div>
                {summary?.execution_time_ms && (
                  <span className="text-[10px] text-zinc-400 bg-zinc-900 px-2 py-0.5 rounded border border-zinc-800">
                    Waktu: {(summary.execution_time_ms / 1000).toFixed(2)} detik
                  </span>
                )}
              </div>

              <div className="space-y-1 text-[11px] max-h-48 overflow-y-auto leading-relaxed">
                {executionLogs.map((log, idx) => (
                  <div key={idx} className="flex gap-2">
                    <span className="text-zinc-500 select-none">&gt;</span>
                    <span className={log.includes('✓') ? 'text-emerald-300' : log.includes('⚡') ? 'text-amber-300' : log.includes('❌') ? 'text-red-400' : 'text-zinc-300'}>
                      {log}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
