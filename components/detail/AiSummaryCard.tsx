'use client'

import { useState, useEffect } from 'react'
import { Sparkles, RefreshCw, Copy, Check, ChevronDown, ChevronUp, Tag, Layers, Terminal, Loader2, Wallet } from 'lucide-react'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Skeleton } from '@/components/ui/Skeleton'
import { PortfolioMatchBadge } from '@/components/portfolio/PortfolioMatchBadge'
import { usePortfolio } from '@/hooks/usePortfolio'
import { matchPortfolioEntries } from '@/lib/ai-summary'
import type { AiSummary } from '@/lib/types/database'
import { ModelSelector } from '@/components/ui/ModelSelector'


interface AiSummaryCardProps {
  summary: AiSummary | null
  isLoading: boolean
  isGenerating?: boolean
  onRegenerate: (model?: string) => void
}

const MODEL_OPTIONS = [
  { value: 'gemini-3.6-flash', label: 'gemini-3.6-flash (Fast & Smart)' },
  { value: 'gemini-2.5-flash', label: 'gemini-2.5-flash' },
  { value: 'gpt-4o-mini', label: 'gpt-4o-mini (OpenAI)' },
]

function parseThemeString(text: string) {
  if (!text || !text.trim()) return { mainTheme: '', subTheme: '', points: [], subThemePoints: [], raw: text }

  let mainTheme = ''
  let subTheme = ''
  const points: string[] = []
  const subThemePoints: string[] = []

  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean)

  if (lines.length > 1) {
    let inSubThemeSection = false

    for (const line of lines) {
      // Skip pure header lines like "Sub-Tema:" or "Poin SDGs:"
      if (/^(?:poin|fokus|kategori)\s*(?:\/|\&|dan)?\s*sdgs?\s*:?$/i.test(line)) {
        continue
      }

      if (/^(?:Tema Utama|Tema)\s*:/i.test(line)) {
        inSubThemeSection = false
        mainTheme = line.replace(/^(?:Tema Utama|Tema)\s*:\s*/i, '').trim()
      } else if (/^(?:Sub-Tema|Subtema|Fokus Kegiatan|Fokus)\s*:/i.test(line)) {
        // Check if there's a value inline (e.g. "Sub-Tema: Smart City")
        const inlineVal = line.replace(/^(?:Sub-Tema|Subtema|Fokus Kegiatan|Fokus)\s*:\s*/i, '').trim()
        // Ignore if the inline value is just a number or very short non-meaningful text
        if (inlineVal && !/^\d+$/.test(inlineVal) && inlineVal !== '(Tidak ada sub-tema spesifik)') {
          subTheme = inlineVal
          inSubThemeSection = false
        } else {
          // Sub-themes are on subsequent bullet lines
          inSubThemeSection = true
        }
      } else if (/^(?:\d+\.|\-|\*)\s*/.test(line)) {
        const item = line.replace(/^(?:\d+\.|\-|\*)\s*/, '').trim()
        if (item) {
          if (inSubThemeSection) {
            subThemePoints.push(item)
          } else {
            points.push(item)
          }
        }
      } else if (line.toLowerCase().includes('sdg') && !line.toLowerCase().startsWith('poin')) {
        inSubThemeSection = false
        points.push(line.trim())
      } else {
        inSubThemeSection = false
      }
    }
  }

  if (!mainTheme && !subTheme) {
    const mainMatch = text.match(/(?:Tema Utama|Tema)\s*:\s*([^.\n]+|\"[^\"]+\")/i)
    const subMatch = text.match(/(?:Sub-Tema|Subtema)\s*(?:Hackathon)?\s*:\s*([^.\n]+|\"[^\"]+\"|'[^']+')/i)

    if (mainMatch) mainTheme = mainMatch[1].trim()
    if (subMatch) {
      const val = subMatch[1].trim()
      // Ignore if sub-theme is just a number
      if (!/^\d+$/.test(val)) subTheme = val
    }

    const quotes = Array.from(text.matchAll(/["“]([^"”]+)["”]/g)).map((m) => m[1].trim())
    if (!mainTheme && quotes.length >= 1) mainTheme = quotes[0]
    if (!subTheme && quotes.length >= 2) subTheme = quotes[1]

    const sdgMatches = Array.from(text.matchAll(/(SDG\s*\d+\s*:[^,.)\n]*|SDG\s*\d+\s*(?:\([^)]+\))?)/gi))
    for (const m of sdgMatches) {
      const clean = m[1].trim()
      if (clean && !points.includes(clean) && !clean.toLowerCase().startsWith('poin')) {
        points.push(clean)
      }
    }
  }

  mainTheme = mainTheme.replace(/^["'“]|["'”]$/g, '').trim()
  subTheme = subTheme.replace(/^["'“]|["'”]$/g, '').trim()

  return { mainTheme, subTheme, points, subThemePoints, raw: text }
}

function FormattedThemeFocus({ text }: { text: string }) {
  const { mainTheme, subTheme, points, subThemePoints, raw } = parseThemeString(text)

  if (!mainTheme && !subTheme && subThemePoints.length === 0 && points.length === 0) {
    return (
      <div className="mt-2 space-y-1 text-zinc-600 dark:text-zinc-400">
        <p className="leading-relaxed">{raw}</p>
      </div>
    )
  }

  return (
    <div className="mt-2 space-y-3">
      {mainTheme && (
        <div className="rounded-xl border border-amber-200 bg-amber-50/70 p-3.5 shadow-2xs dark:border-amber-900/60 dark:bg-amber-950/30">
          <div className="flex items-center gap-1.5 text-[11px] font-bold tracking-wider text-amber-700 dark:text-amber-400 uppercase">
            <Sparkles className="h-3.5 w-3.5" />
            <span>Tema Utama</span>
          </div>
          <p className="mt-1 font-semibold text-zinc-900 dark:text-zinc-50 text-sm sm:text-base leading-snug">
            {mainTheme}
          </p>
        </div>
      )}

      {(subTheme || subThemePoints.length > 0) && (
        <div className="rounded-xl border border-sky-200 bg-sky-50/70 p-3.5 shadow-2xs dark:border-sky-900/60 dark:bg-sky-950/30">
          <div className="flex items-center gap-1.5 text-[11px] font-bold tracking-wider text-sky-700 dark:text-sky-400 uppercase">
            <Layers className="h-3.5 w-3.5" />
            <span>Sub-Tema / Fokus Kegiatan</span>
          </div>
          {subTheme && (
            <p className="mt-1 font-medium text-zinc-800 dark:text-zinc-200 text-sm leading-snug">
              {subTheme}
            </p>
          )}
          {subThemePoints.length > 0 && (
            <ul className="mt-1.5 space-y-1">
              {subThemePoints.map((pt, idx) => (
                <li key={idx} className="flex items-start gap-1.5 text-sm font-medium text-zinc-800 dark:text-zinc-200">
                  <span className="mt-0.5 text-sky-500">•</span>
                  <span>{pt}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {points.length > 0 && (
        <div className="pt-1 space-y-1.5">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-zinc-700 dark:text-zinc-300">
            <Tag className="h-3.5 w-3.5 text-emerald-500" />
            <span>Poin &amp; Kategori Fokus:</span>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {points.map((pt, idx) => (
              <span
                key={idx}
                className="inline-flex items-center rounded-lg border border-emerald-200/80 bg-emerald-50/80 px-3 py-1 text-xs font-medium text-emerald-800 dark:border-emerald-900/60 dark:bg-emerald-950/60 dark:text-emerald-300"
              >
                {pt}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function FormattedRegistrationFee({ text }: { text: string }) {
  if (!text || !text.trim()) return null
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean)

  return (
    <div className="rounded-xl border border-emerald-200 bg-emerald-50/70 p-3.5 shadow-2xs dark:border-emerald-900/60 dark:bg-emerald-950/30">
      <div className="flex items-center gap-1.5 text-[11px] font-bold tracking-wider text-emerald-700 dark:text-emerald-400 uppercase">
        <Wallet className="h-3.5 w-3.5" />
        <span>Biaya Pendaftaran / Registration Fee</span>
      </div>
      {lines.length > 1 ? (
        <ul className="mt-2 space-y-1.5">
          {lines.map((line, idx) => (
            <li key={idx} className="flex items-start gap-2 text-sm font-semibold text-zinc-900 dark:text-zinc-50">
              <span className="mt-1 h-1.5 w-1.5 rounded-full bg-emerald-500 shrink-0" />
              <span>{line.replace(/^(?:\d+\.|\-|\*)\s*/, '')}</span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-1 font-semibold text-zinc-900 dark:text-zinc-50 text-sm sm:text-base leading-snug">
          {text}
        </p>
      )}
    </div>
  )
}


export function AiSummaryCard({ summary, isLoading, isGenerating, onRegenerate }: AiSummaryCardProps) {
  const [copied, setCopied] = useState(false)
  const [isExpanded, setIsExpanded] = useState(true)
  const [showLogs, setShowLogs] = useState(false)
  const [selectedModel, setSelectedModel] = useState<string>(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('ai-summary-model') || 'gemini-3.6-flash'
    }
    return 'gemini-3.6-flash'
  })
  const { data: portfolio = [] } = usePortfolio()

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

  useEffect(() => {
    if (summary?.model_used && !localStorage.getItem('ai-summary-model')) {
      const cleanModelName = summary.model_used.split(' ')[0]
      setSelectedModel(cleanModelName)
    }
  }, [summary?.model_used])

  function handleModelChange(model: string) {
    setSelectedModel(model)
    localStorage.setItem('ai-summary-model', model)
  }

  const matches = matchPortfolioEntries(summary?.theme_and_subtheme ?? null, portfolio)

  function handleCopy() {
    if (!summary) return
    const text = `
AI SUMMARY & ADVICE
===================
Summary: ${summary.summary}
Theme: ${summary.theme_and_subtheme ?? 'N/A'}

Key Requirements:
${summary.key_requirements.map((r) => `- ${r}`).join('\n')}

Judging Criteria:
${summary.judging_criteria.map((c) => `- ${c}`).join('\n')}

Project Idea Suggestions:
${summary.project_idea_suggestions.map((i) => `* ${i.title}: ${i.description} (Rationale: ${i.rationale})`).join('\n')}
    `.trim()

    navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const showSkeleton = isLoading || isGenerating

  // Current selected model status indicator
  const currentStatus = modelStatuses[selectedModel]?.status || 'active'
  const statusColor =
    currentStatus === 'active'
      ? 'bg-emerald-500'
      : currentStatus === 'rate_limited'
      ? 'bg-amber-500'
      : currentStatus === 'key_missing'
      ? 'bg-zinc-400'
      : 'bg-red-500'

  const [liveLogStep, setLiveLogStep] = useState(0)

  useEffect(() => {
    if (isGenerating) {
      setShowLogs(true)
      setLiveLogStep(1)
      const t1 = setTimeout(() => setLiveLogStep(2), 600)
      const t2 = setTimeout(() => setLiveLogStep(3), 1500)
      const t3 = setTimeout(() => setLiveLogStep(4), 3000)
      const t4 = setTimeout(() => setLiveLogStep(5), 5500)
      return () => {
        clearTimeout(t1)
        clearTimeout(t2)
        clearTimeout(t3)
        clearTimeout(t4)
      }
    } else {
      setLiveLogStep(0)
    }
  }, [isGenerating])

  const liveLogs = [
    `[${new Date().toLocaleTimeString('id-ID')}] [1/6] Inisialisasi pipeline regenerasi AI untuk model ${selectedModel}...`,
    liveLogStep >= 2 ? `[${new Date().toLocaleTimeString('id-ID')}] [2/6] Membaca file guidebook PDF dari Supabase Storage...` : null,
    liveLogStep >= 3 ? `[${new Date().toLocaleTimeString('id-ID')}] [3/6] ✓ Buffer PDF berhasil dibaca dari storage` : null,
    liveLogStep >= 4 ? `[${new Date().toLocaleTimeString('id-ID')}] [4/6] Menjalankan Mesin Kompresi Stream & Parser Tanggal Indonesia...` : null,
    liveLogStep >= 5 ? `[${new Date().toLocaleTimeString('id-ID')}] [5/6] Mengirimkan payload ke AI Model Engine (${selectedModel}) & memproses tabel timeline...` : null,
  ].filter(Boolean) as string[]

  const executionLogs = isGenerating
    ? liveLogs
    : summary?.execution_log ?? [
        `[${summary?.updated_at ? new Date(summary.updated_at).toLocaleTimeString('id-ID') : 'Terbaru'}] Inisialisasi analisis AI`,
        `[Model Engine] ${selectedModel}: ${modelStatuses[selectedModel]?.message || 'Aktif'}`,
        `[Status] Analisis tersimpan di database`,
      ]

  return (
    <Card className="space-y-4 p-4 sm:p-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-b border-zinc-200 pb-3 dark:border-zinc-800">
        <div className="flex flex-wrap items-center gap-2.5">
          <Sparkles className="h-5 w-5 text-amber-500 shrink-0" />
          <h3 className="font-semibold text-zinc-900 dark:text-zinc-50">AI Summary &amp; Advice</h3>

          {/* Custom Model Selector */}
          <ModelSelector
            options={MODEL_OPTIONS}
            selectedModel={selectedModel}
            modelStatuses={modelStatuses as any}
            onSelectModel={handleModelChange}
            disabled={isGenerating}
          />
        </div>

        <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
          {(summary || isGenerating) && (
            <>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowLogs((prev) => !prev)}
                className={showLogs ? 'bg-zinc-200 text-zinc-900 dark:bg-zinc-800 dark:text-zinc-100' : ''}
              >
                <Terminal className="h-3.5 w-3.5" />
                <span>Logs AI</span>
              </Button>
              {summary && !showSkeleton && (
                <>
                  <Button variant="ghost" size="sm" onClick={handleCopy}>
                    {copied ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5" />}
                    {copied ? 'Copied' : 'Copy'}
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setIsExpanded((prev) => !prev)}
                    aria-label={isExpanded ? 'Minimize summary' : 'Expand summary'}
                  >
                    {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                    {isExpanded ? 'Minimize' : 'Expand'}
                  </Button>
                </>
              )}
            </>
          )}
          <Button
            variant="secondary"
            size="sm"
            onClick={() => {
              setShowLogs(true)
              onRegenerate(selectedModel)
            }}
            disabled={isGenerating}
          >
            <RefreshCw className={`h-3.5 w-3.5 ${isGenerating ? 'animate-spin' : ''}`} />
            {summary ? 'Regenerate' : 'Generate Summary'}
          </Button>
        </div>
      </div>

      {/* AI Execution Logs Accordion */}
      {showLogs && (
        <div className="rounded-xl border border-zinc-800 bg-zinc-950 p-3.5 font-mono text-xs text-emerald-400 space-y-2 animate-in fade-in duration-150">
          <div className="flex items-center justify-between border-b border-zinc-800 pb-2 text-[11px] text-zinc-400">
            <span className="flex items-center gap-1.5 text-zinc-200 font-semibold">
              <Terminal className="h-3.5 w-3.5 text-emerald-400" /> Execution Log (AI Engine)
            </span>
            <span>Model: {selectedModel}</span>
          </div>
          <div className="max-h-40 overflow-y-auto space-y-1 text-[11px] leading-relaxed text-zinc-300">
            {executionLogs.map((log, i) => (
              <p key={i} className="whitespace-pre-wrap">{log}</p>
            ))}
          </div>
        </div>
      )}

      {showSkeleton ? (
        <div className="space-y-4 py-2">
          {isGenerating && (
            <div className="rounded-xl border border-amber-200 bg-amber-50/80 p-3.5 dark:border-amber-900/60 dark:bg-amber-950/40 flex items-center justify-between">
              <div className="flex items-center gap-2 text-xs font-semibold text-amber-900 dark:text-amber-200">
                <Loader2 className="h-4 w-4 animate-spin text-amber-600 dark:text-amber-400 shrink-0" />
                <span>Meregenerasi AI Summary &amp; Timeline dengan {selectedModel}...</span>
              </div>
              <button
                type="button"
                onClick={() => setShowLogs((prev) => !prev)}
                className="flex items-center gap-1 text-[11px] font-semibold text-amber-800 dark:text-amber-200 hover:underline cursor-pointer"
              >
                <Terminal className="h-3 w-3" />
                <span>{showLogs ? 'Minimize Log' : 'Expand Log'}</span>
              </button>
            </div>
          )}
          <div className="space-y-2">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-5/6" />
          </div>
          <div className="space-y-2">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-20 w-full" />
          </div>
          <div className="space-y-2">
            <Skeleton className="h-4 w-36" />
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-4 w-1/2" />
          </div>
        </div>
      ) : !summary ? (
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          No AI summary generated yet. Upload a guidebook or click &quot;Generate Summary&quot; to extract key insights.
        </p>
      ) : (
        <div className="space-y-4 text-sm">
          <div>
            <h4 className="font-semibold text-zinc-800 dark:text-zinc-200">Overview</h4>
            <p className="mt-1 leading-relaxed text-zinc-600 dark:text-zinc-400">{summary.summary}</p>
          </div>

          {isExpanded && (
            <>
              {summary.theme_and_subtheme && (
                <div>
                  <h4 className="font-semibold text-zinc-800 dark:text-zinc-200">Theme &amp; Focus</h4>
                  <FormattedThemeFocus text={summary.theme_and_subtheme} />
                </div>
              )}

              {summary.registration_fee && (
                <FormattedRegistrationFee text={summary.registration_fee} />
              )}

              <PortfolioMatchBadge matches={matches} />


              {summary.key_requirements.length > 0 && (
                <div>
                  <h4 className="font-semibold text-zinc-800 dark:text-zinc-200">Key Requirements</h4>
                  <ul className="mt-1 list-disc space-y-1 pl-4 text-zinc-600 dark:text-zinc-400">
                    {summary.key_requirements.map((req, idx) => (
                      <li key={idx}>{req}</li>
                    ))}
                  </ul>
                </div>
              )}

              {summary.judging_criteria.length > 0 && (
                <div>
                  <h4 className="font-semibold text-zinc-800 dark:text-zinc-200">Judging Criteria</h4>
                  <ul className="mt-1 list-disc space-y-1 pl-4 text-zinc-600 dark:text-zinc-400">
                    {summary.judging_criteria.map((crit, idx) => (
                      <li key={idx}>{crit}</li>
                    ))}
                  </ul>
                </div>
              )}

              {summary.project_idea_suggestions.length > 0 && (
                <div>
                  <h4 className="font-semibold text-zinc-800 dark:text-zinc-200">Project Idea Suggestions</h4>
                  <div className="mt-2 space-y-2">
                    {summary.project_idea_suggestions.map((idea, idx) => (
                      <div key={idx} className="rounded-md border border-zinc-200 bg-zinc-50 p-3 dark:border-zinc-800 dark:bg-zinc-900/50">
                        <p className="font-medium text-zinc-900 dark:text-zinc-100">{idea.title}</p>
                        <p className="mt-0.5 text-xs text-zinc-600 dark:text-zinc-400">{idea.description}</p>
                        <p className="mt-1.5 text-[11px] italic text-amber-700 dark:text-amber-400">Rationale: {idea.rationale}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </Card>
  )
}
