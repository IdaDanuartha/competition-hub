'use client'

import { useState } from 'react'
import { FileSearch, Sparkles, CheckCircle2, AlertTriangle, Lightbulb, Award, Loader2, FileText, ChevronDown, ChevronUp, History } from 'lucide-react'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { FileDropzone } from '@/components/ui/FileDropzone'
import { ModelSelector } from '@/components/ui/ModelSelector'
import { useProposalReviews, useReviewProposal } from '@/hooks/useProposalReview'
import type { ProposalReview } from '@/lib/types/database'

const MODEL_OPTIONS = [
  { value: 'gemini-3.6-flash', label: 'gemini-3.6-flash (Fast & Smart)' },
  { value: 'gemini-2.5-flash', label: 'gemini-2.5-flash' },
  { value: 'gpt-4o-mini', label: 'gpt-4o-mini (OpenAI Fast)' },
  { value: 'gpt-4o', label: 'gpt-4o (OpenAI Flagship)' },
]

export function ProposalReviewSection({ competitionId }: { competitionId: string }) {
  const { data: reviews = [], isLoading } = useProposalReviews(competitionId)
  const { mutateAsync: reviewProposal, isPending } = useReviewProposal()
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [selectedReview, setSelectedReview] = useState<ProposalReview | null>(null)
  const [showHistory, setShowHistory] = useState(false)
  const [selectedModel, setSelectedModel] = useState<string>('gemini-3.6-flash')
  const [modelStatuses, setModelStatuses] = useState<Record<string, { status: string; message: string }>>({})

  useEffect(() => {
    fetch('/api/ai-models-status')
      .then((res) => res.json())
      .then((data) => {
        if (data?.models) {
          setModelStatuses(data.models)
        }
      })
      .catch(() => {})
  }, [])

  // The active review is either user-selected from history or the latest review
  const activeReview = selectedReview || reviews[0] || null

  const handleFileSelect = async (file: File) => {
    setErrorMsg(null)
    try {
      const result = await reviewProposal({
        competitionId,
        file,
        preferredModel: selectedModel,
      })
      setSelectedReview(result)
    } catch (err: any) {
      setErrorMsg(err?.message || 'Gagal menganalisis proposal. Pastikan format file PDF valid.')
    }
  }

  const getScoreColor = (score: number) => {
    if (score >= 85) return 'text-emerald-600 dark:text-emerald-400 border-emerald-500 bg-emerald-50 dark:bg-emerald-950/40'
    if (score >= 70) return 'text-amber-600 dark:text-amber-400 border-amber-500 bg-amber-50 dark:bg-amber-950/40'
    return 'text-red-600 dark:text-red-400 border-red-500 bg-red-50 dark:bg-red-950/40'
  }

  const getScoreBadge = (score: number) => {
    if (score >= 85) return { label: 'Proposal Tangguh (Siap Submit)', color: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/60 dark:text-emerald-200' }
    if (score >= 70) return { label: 'Proposal Cukup Baik (Perlu Optimalisasi)', color: 'bg-amber-100 text-amber-800 dark:bg-amber-900/60 dark:text-amber-200' }
    return { label: 'Perlu Banyak Perbaikan (Risiko Gugur)', color: 'bg-red-100 text-red-800 dark:bg-red-900/60 dark:text-red-200' }
  }

  return (
    <Card className="p-4 sm:p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-b border-zinc-200 pb-4 dark:border-zinc-800">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-purple-600/10 text-purple-600 dark:bg-purple-500/20 dark:text-purple-400">
            <FileSearch className="h-5 w-5" />
          </div>
          <div>
            <h3 className="font-semibold text-zinc-900 dark:text-zinc-50 flex items-center gap-2 text-base">
              AI Proposal &amp; Pitch Deck Evaluator
            </h3>
            <p className="text-xs text-zinc-500 dark:text-zinc-400">
              Evaluasi draf berkas proposal / pitch deck terhadap Judging Criteria &amp; bobot juri resmi
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <ModelSelector
            options={MODEL_OPTIONS}
            selectedModel={selectedModel}
            modelStatuses={modelStatuses as any}
            onSelectModel={setSelectedModel}
            disabled={isPending}
          />

          {reviews.length > 0 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowHistory((prev) => !prev)}
              className="text-xs shrink-0"
            >
              <History className="h-3.5 w-3.5" />
              <span>Riwayat ({reviews.length})</span>
            </Button>
          )}
        </div>
      </div>

      {/* Upload Dropzone & Loading State */}
      <div className="space-y-3">
        <FileDropzone
          accept="application/pdf"
          maxSizeBytes={25 * 1024 * 1024}
          onFileSelected={handleFileSelect}
          disabled={isPending}
        />

        {isPending && (
          <div className="rounded-xl border border-purple-200 bg-purple-50/70 p-4 dark:border-purple-900/60 dark:bg-purple-950/40 flex items-center gap-3 animate-in fade-in">
            <Loader2 className="h-5 w-5 animate-spin text-purple-600 dark:text-purple-400 shrink-0" />
            <div className="space-y-0.5 min-w-0">
              <p className="text-xs font-semibold text-purple-900 dark:text-purple-200">
                Mengevaluasi Draf Proposal dengan AI Model ({selectedModel})...
              </p>
              <p className="text-[11px] text-purple-700 dark:text-purple-300 truncate">
                Menghitung skor per Kriteria Penilaian, memeriksa kesesuaian syarat, dan merumuskan saran perbaikan...
              </p>
            </div>
          </div>
        )}

        {errorMsg && <p className="text-xs font-medium text-red-600 dark:text-red-400">{errorMsg}</p>}
      </div>

      {/* History Select Panel */}
      {showHistory && reviews.length > 0 && (
        <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-3 dark:border-zinc-800 dark:bg-zinc-900/50 space-y-2 animate-in fade-in duration-150">
          <p className="text-xs font-semibold text-zinc-700 dark:text-zinc-300 flex items-center gap-1.5">
            <History className="h-3.5 w-3.5 text-purple-500" /> Riwayat Hasil Evaluasi Proposal
          </p>
          <div className="grid gap-2 sm:grid-cols-2">
            {reviews.map((rev) => {
              const isSelected = activeReview?.id === rev.id
              const badge = getScoreBadge(rev.overall_score)
              return (
                <button
                  key={rev.id}
                  onClick={() => setSelectedReview(rev)}
                  className={`flex items-center justify-between p-2.5 rounded-lg border text-left text-xs transition-all cursor-pointer ${
                    isSelected
                      ? 'border-purple-500 bg-purple-50/50 dark:bg-purple-950/30 font-semibold'
                      : 'border-zinc-200 bg-white hover:border-zinc-300 dark:border-zinc-800 dark:bg-zinc-950'
                  }`}
                >
                  <div className="min-w-0 pr-2 space-y-0.5">
                    <p className="truncate text-zinc-900 dark:text-zinc-100 font-medium">
                      {rev.file_name}
                    </p>
                    <p className="text-[10px] text-zinc-400">
                      {new Date(rev.created_at).toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' })}
                    </p>
                  </div>
                  <span className={`shrink-0 px-2 py-1 rounded-md text-[11px] font-bold ${getScoreColor(rev.overall_score)} border`}>
                    {rev.overall_score}/100
                  </span>
                </button>
              )
            })}
          </div>
        </div>
      )}

      {/* Active Evaluation Result Display */}
      {activeReview && !isPending && (
        <div className="space-y-5 animate-in fade-in duration-200">
          {/* Overall Score Header Card */}
          <div className="rounded-2xl border border-zinc-200 bg-gradient-to-br from-zinc-50 via-purple-50/20 to-zinc-50 p-4 sm:p-5 shadow-2xs dark:border-zinc-800 dark:from-zinc-900/90 dark:via-purple-950/20 dark:to-zinc-900/90 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="space-y-1.5 min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold ${getScoreBadge(activeReview.overall_score).color}`}>
                  {getScoreBadge(activeReview.overall_score).label}
                </span>
                <span className="text-[11px] text-zinc-500 dark:text-zinc-400">
                  • File: {activeReview.file_name}
                </span>
              </div>

              <h4 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 leading-snug">
                Ringkasan Evaluasi Juri
              </h4>
              <p className="text-xs text-zinc-600 dark:text-zinc-400 leading-relaxed">
                {activeReview.summary}
              </p>
            </div>

            {/* Score Circle Gauge */}
            <div className={`flex flex-col items-center justify-center rounded-2xl border-2 px-5 py-3 shrink-0 ${getScoreColor(activeReview.overall_score)}`}>
              <span className="text-3xl font-black tracking-tight">{activeReview.overall_score}</span>
              <span className="text-[10px] font-bold uppercase tracking-wider opacity-80">Skor Akhir</span>
            </div>
          </div>

          {/* Criteria Scores Breakdown */}
          {activeReview.criteria_scores && activeReview.criteria_scores.length > 0 && (
            <div className="space-y-3">
              <h4 className="font-semibold text-zinc-800 dark:text-zinc-200 text-xs sm:text-sm flex items-center gap-1.5">
                <Award className="h-4 w-4 text-amber-500" />
                Penilaian per Kriteria Guidebook
              </h4>
              <div className="grid gap-3 sm:grid-cols-2">
                {activeReview.criteria_scores.map((item, idx) => {
                  const percent = Math.round((item.score / item.max_score) * 100)
                  return (
                    <div
                      key={idx}
                      className="rounded-xl border border-zinc-200 bg-white p-3.5 dark:border-zinc-800 dark:bg-zinc-950 space-y-2"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <span className="text-xs font-semibold text-zinc-900 dark:text-zinc-100 leading-tight">
                          {item.criterion}
                        </span>
                        <span className="shrink-0 text-xs font-bold text-purple-600 dark:text-purple-400 bg-purple-50 dark:bg-purple-950 px-2 py-0.5 rounded border border-purple-200 dark:border-purple-900">
                          {item.score}/{item.max_score} ({percent}%)
                        </span>
                      </div>

                      {/* Progress Bar */}
                      <div className="h-1.5 w-full rounded-full bg-zinc-100 dark:bg-zinc-800 overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all duration-500 ${
                            percent >= 80 ? 'bg-emerald-500' : percent >= 65 ? 'bg-amber-500' : 'bg-red-500'
                          }`}
                          style={{ width: `${percent}%` }}
                        />
                      </div>

                      <p className="text-[11px] text-zinc-500 dark:text-zinc-400 leading-relaxed italic">
                        &quot;{item.feedback}&quot;
                      </p>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* Strengths, Weaknesses, Recommendations Grid */}
          <div className="grid gap-4 sm:grid-cols-3">
            {/* Strengths */}
            <div className="rounded-xl border border-emerald-200 bg-emerald-50/40 p-3.5 dark:border-emerald-900/60 dark:bg-emerald-950/20 space-y-2">
              <h5 className="text-xs font-bold text-emerald-800 dark:text-emerald-400 uppercase tracking-wider flex items-center gap-1.5">
                <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                Keunggulan Utama
              </h5>
              <ul className="space-y-1.5 text-xs text-zinc-700 dark:text-zinc-300">
                {activeReview.strengths.map((str, idx) => (
                  <li key={idx} className="flex items-start gap-1.5">
                    <span className="text-emerald-500 font-bold">•</span>
                    <span>{str}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Weaknesses */}
            <div className="rounded-xl border border-amber-200 bg-amber-50/40 p-3.5 dark:border-amber-900/60 dark:bg-amber-950/20 space-y-2">
              <h5 className="text-xs font-bold text-amber-800 dark:text-amber-400 uppercase tracking-wider flex items-center gap-1.5">
                <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400 shrink-0" />
                Kekurangan &amp; Celah
              </h5>
              <ul className="space-y-1.5 text-xs text-zinc-700 dark:text-zinc-300">
                {activeReview.weaknesses.map((weak, idx) => (
                  <li key={idx} className="flex items-start gap-1.5">
                    <span className="text-amber-500 font-bold">•</span>
                    <span>{weak}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Actionable Recommendations */}
            <div className="rounded-xl border border-sky-200 bg-sky-50/40 p-3.5 dark:border-sky-900/60 dark:bg-sky-950/20 space-y-2">
              <h5 className="text-xs font-bold text-sky-800 dark:text-sky-400 uppercase tracking-wider flex items-center gap-1.5">
                <Lightbulb className="h-4 w-4 text-sky-600 dark:text-sky-400 shrink-0" />
                Rekomendasi Perbaikan
              </h5>
              <ul className="space-y-1.5 text-xs text-zinc-700 dark:text-zinc-300">
                {activeReview.actionable_recommendations.map((rec, idx) => (
                  <li key={idx} className="flex items-start gap-1.5">
                    <span className="text-sky-500 font-bold">•</span>
                    <span>{rec}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      )}
    </Card>
  )
}
