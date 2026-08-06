'use client'

import { useState, useEffect } from 'react'
import { Sparkles, FileText, Wallet, Award, Info, Calendar, ListOrdered, CheckSquare, Square, RefreshCw, UploadCloud, X } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { ModelSelector } from '@/components/ui/ModelSelector'

export interface RegenerateDataModalProps {
  isOpen: boolean
  onClose: () => void
  onConfirm: (options: { preferredModel: string; replaceFields: string[] }) => void
  initialModel?: string
  isGenerating?: boolean
  isUploadMode?: boolean
  fileName?: string
}

export const REPLACEMENT_CATEGORIES = [
  {
    id: 'summary_theme',
    label: 'Ringkasan & Tema Lomba',
    description: 'Deskripsi overview lomba, Tema Utama, dan Sub-tema / kategori lomba',
    icon: FileText,
  },
  {
    id: 'fee_requirements',
    label: 'Biaya & Syarat Pendaftaran',
    description: 'Rincian biaya pendaftaran, HTM, dan syarat/ketentuan eligibility',
    icon: Wallet,
  },
  {
    id: 'criteria_ideas',
    label: 'Kriteria Penilaian & Ide Proyek',
    description: 'Kriteria penilaian beserta bobot persentase & rekomendasi ide proyek',
    icon: Award,
  },
  {
    id: 'metadata',
    label: 'Metadata & Informasi Lomba',
    description: 'Penyelenggara, link Instagram, website resmi, lokasi, dan catatan',
    icon: Info,
  },
  {
    id: 'dates',
    label: 'Tanggal & Batas Waktu Utama',
    description: 'Batas pendaftaran, batas pengumpulan berkas/proposal, & tanggal event',
    icon: Calendar,
  },
  {
    id: 'rundown',
    label: 'Agenda Rundown & Timeline',
    description: 'Seluruh tahapan agenda kegiatan resmi di kalender lomba',
    icon: ListOrdered,
  },
]

const ALL_CATEGORY_IDS = REPLACEMENT_CATEGORIES.map((c) => c.id)

const MODEL_OPTIONS = [
  { value: 'gemini-3.6-flash', label: 'gemini-3.6-flash (Fast & Smart)' },
  { value: 'gemini-2.5-flash', label: 'gemini-2.5-flash' },
  { value: 'gpt-4o-mini', label: 'gpt-4o-mini (OpenAI Fast)' },
  { value: 'gpt-4o', label: 'gpt-4o (OpenAI Flagship High-Reasoning)' },
]

export function RegenerateDataModal({
  isOpen,
  onClose,
  onConfirm,
  initialModel = 'gemini-3.6-flash',
  isGenerating = false,
  isUploadMode = false,
  fileName,
}: RegenerateDataModalProps) {
  const [selectedModel, setSelectedModel] = useState(initialModel)
  const [selectedFields, setSelectedFields] = useState<string[]>(ALL_CATEGORY_IDS)
  const [modelStatuses, setModelStatuses] = useState<Record<string, { status: string; message: string }>>({})

  useEffect(() => {
    if (isOpen) {
      setSelectedModel(initialModel)
      setSelectedFields(ALL_CATEGORY_IDS)
      fetch('/api/ai-models-status')
        .then((res) => res.json())
        .then((data) => {
          if (data?.models) {
            setModelStatuses(data.models)
          }
        })
        .catch(() => {})
    }
  }, [isOpen, initialModel])

  if (!isOpen) return null

  function toggleField(id: string) {
    setSelectedFields((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    )
  }

  function handleSelectAll() {
    setSelectedFields(ALL_CATEGORY_IDS)
  }

  function handleDeselectAll() {
    setSelectedFields([])
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (selectedFields.length === 0) return
    onConfirm({ preferredModel: selectedModel, replaceFields: selectedFields })
  }

  const allSelected = selectedFields.length === ALL_CATEGORY_IDS.length
  const noneSelected = selectedFields.length === 0

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs animate-in fade-in duration-150">
      <div
        className="w-full max-w-lg space-y-4 rounded-2xl border border-zinc-200 bg-white p-5 shadow-2xl dark:border-zinc-800 dark:bg-zinc-950 sm:p-6"
        role="dialog"
        aria-modal="true"
        aria-labelledby="regenerate-dialog-title"
      >
        <div className="flex items-start justify-between border-b border-zinc-200 pb-3 dark:border-zinc-800">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-amber-100 text-amber-600 dark:bg-amber-950/80 dark:text-amber-400">
              {isUploadMode ? <UploadCloud className="h-5 w-5" /> : <Sparkles className="h-5 w-5" />}
            </div>
            <div>
              <h3 id="regenerate-dialog-title" className="text-base font-semibold text-zinc-900 dark:text-zinc-50 leading-tight">
                {isUploadMode ? 'Ekstrak Guidebook AI' : 'Pilih Data yang Diperbarui'}
              </h3>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
                {isUploadMode
                  ? `File "${fileName || 'Guidebook'}". Centang data mana saja yang ingin diekstrak:`
                  : 'Centang data mana saja yang ingin ditimpa/di-replace oleh AI:'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700 dark:hover:bg-zinc-800 dark:hover:text-zinc-200 transition-colors cursor-pointer"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Model Selection */}
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center justify-between rounded-xl border border-zinc-200/80 bg-zinc-50/70 p-3 dark:border-zinc-800 dark:bg-zinc-900/40">
            <label className="text-xs font-semibold text-zinc-800 dark:text-zinc-200 shrink-0">
              Model AI Engine:
            </label>
            <ModelSelector
              options={MODEL_OPTIONS}
              selectedModel={selectedModel}
              modelStatuses={modelStatuses as any}
              onSelectModel={(m) => setSelectedModel(m)}
              disabled={isGenerating}
            />
          </div>

          {/* Quick Select Controls */}
          <div className="flex items-center justify-between border-t border-zinc-100 pt-3 dark:border-zinc-900">
            <span className="text-xs font-medium text-zinc-600 dark:text-zinc-400">
              Pilih Kategori ({selectedFields.length}/{ALL_CATEGORY_IDS.length} terpilih):
            </span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleSelectAll}
                disabled={allSelected}
                className="text-[11px] font-semibold text-amber-600 dark:text-amber-400 hover:underline disabled:opacity-40 cursor-pointer"
              >
                Pilih Semua
              </button>
              <span className="text-zinc-300 dark:text-zinc-700 text-xs">•</span>
              <button
                type="button"
                onClick={handleDeselectAll}
                disabled={noneSelected}
                className="text-[11px] font-semibold text-zinc-500 hover:underline disabled:opacity-40 cursor-pointer"
              >
                Kosongkan
              </button>
            </div>
          </div>

          {/* Checkboxes List */}
          <div className="max-h-64 space-y-2 overflow-y-auto pr-1">
            {REPLACEMENT_CATEGORIES.map((cat) => {
              const IconComp = cat.icon
              const isChecked = selectedFields.includes(cat.id)

              return (
                <label
                  key={cat.id}
                  onClick={() => toggleField(cat.id)}
                  className={`flex cursor-pointer items-start gap-3 rounded-xl border p-3 transition-all ${
                    isChecked
                      ? 'border-amber-400/80 bg-amber-50/50 dark:border-amber-800/80 dark:bg-amber-950/20'
                      : 'border-zinc-200 bg-zinc-50/40 opacity-75 hover:opacity-100 dark:border-zinc-800 dark:bg-zinc-900/30'
                  }`}
                >
                  <div className="mt-0.5 shrink-0">
                    {isChecked ? (
                      <CheckSquare className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                    ) : (
                      <Square className="h-4 w-4 text-zinc-400" />
                    )}
                  </div>
                  <div className="flex-1 space-y-0.5 min-w-0">
                    <div className="flex items-center gap-1.5 text-xs font-semibold text-zinc-900 dark:text-zinc-100">
                      <IconComp className="h-3.5 w-3.5 text-amber-500 shrink-0" />
                      <span>{cat.label}</span>
                    </div>
                    <p className="text-[11px] text-zinc-500 dark:text-zinc-400 leading-tight">
                      {cat.description}
                    </p>
                  </div>
                </label>
              )
            })}
          </div>

          {noneSelected && (
            <p className="text-[11px] font-medium text-red-500 dark:text-red-400 text-center">
              Pilih minimal 1 kategori data yang ingin diperbarui!
            </p>
          )}

          {/* Footer buttons */}
          <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-zinc-100 dark:border-zinc-900">
            <Button type="button" variant="ghost" size="sm" onClick={onClose} disabled={isGenerating}>
              Batal
            </Button>
            <Button
              type="submit"
              variant="primary"
              size="sm"
              disabled={noneSelected || isGenerating}
              isLoading={isGenerating}
            >
              <RefreshCw className="h-3.5 w-3.5" />
              {isUploadMode ? 'Ekstrak Guidebook' : 'Perbarui Data Terpilih'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}
