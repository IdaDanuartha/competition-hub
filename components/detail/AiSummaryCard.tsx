'use client'

import { useState, useEffect } from 'react'
import { Sparkles, RefreshCw, Copy, Check, Cpu, ChevronDown, ChevronUp, Tag, Layers } from 'lucide-react'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Skeleton } from '@/components/ui/Skeleton'
import { PortfolioMatchBadge } from '@/components/portfolio/PortfolioMatchBadge'
import { usePortfolio } from '@/hooks/usePortfolio'
import { matchPortfolioEntries } from '@/lib/ai-summary'
import type { AiSummary } from '@/lib/types/database'

interface AiSummaryCardProps {
  summary: AiSummary | null
  isLoading: boolean
  isGenerating?: boolean
  onRegenerate: (model?: string) => void
}

const MODEL_OPTIONS = [
  { value: 'gemini-3.6-flash', label: 'gemini-3.6-flash (Fast & Smart)' },
  { value: 'gemini-3.5-flash-lite', label: 'gemini-3.5-flash-lite (Lightweight)' },
  { value: 'gemini-2.5-flash', label: 'gemini-2.5-flash' },
  { value: 'gemini-1.5-flash', label: 'gemini-1.5-flash' },
  { value: 'gpt-4o-mini', label: 'gpt-4o-mini (OpenAI)' },
]

function parseThemeString(text: string) {
  if (!text || !text.trim()) return { mainTheme: '', subTheme: '', points: [], raw: text }

  let mainTheme = ''
  let subTheme = ''
  const points: string[] = []

  // Check line-by-line
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean)
  if (lines.length > 1) {
    for (const line of lines) {
      if (/^(?:poin|fokus|kategori)\s*(?:\/|\&|dan)?\s*sdgs?\s*:?/i.test(line) || line.trim().endsWith(':')) {
        // Skip header line like "Poin / Fokus SDGs:"
        continue
      }

      if (/^(?:Tema Utama|Tema)\s*:/i.test(line)) {
        mainTheme = line.replace(/^(?:Tema Utama|Tema)\s*:\s*/i, '').trim()
      } else if (/^(?:Sub-Tema|Subtema|Fokus Kegiatan|Fokus)\s*:/i.test(line)) {
        subTheme = line.replace(/^(?:Sub-Tema|Subtema|Fokus Kegiatan|Fokus)\s*:\s*/i, '').trim()
      } else if (/^(?:\d+\.|\-|\*)\s*/.test(line)) {
        const item = line.replace(/^(?:\d+\.|\-|\*)\s*/, '').trim()
        if (item) points.push(item)
      } else if (line.toLowerCase().includes('sdg') && !line.toLowerCase().startsWith('poin')) {
        points.push(line.trim())
      }
    }
  }

  // Fallback pattern extraction if not parsed by line
  if (!mainTheme && !subTheme) {
    const mainMatch = text.match(/(?:Tema Utama|Tema)\s*:\s*([^.\n]+|\"[^\"]+\")/i)
    const subMatch = text.match(/(?:Sub-Tema|Subtema)\s*(?:Hackathon)?\s*:\s*([^.\n]+|\"[^\"]+\"|'[^']+')/i)

    if (mainMatch) mainTheme = mainMatch[1].trim()
    if (subMatch) subTheme = subMatch[1].trim()

    // Quotes extraction fallback e.g. "Main Theme" dengan sub-tema "Sub Theme"
    const quotes = Array.from(text.matchAll(/["“]([^"”]+)["”]/g)).map((m) => m[1].trim())
    if (!mainTheme && quotes.length >= 1) mainTheme = quotes[0]
    if (!subTheme && quotes.length >= 2) subTheme = quotes[1]

    // SDG points fallback (excluding "poin / fokus")
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

  return { mainTheme, subTheme, points, raw: text }
}

function FormattedThemeFocus({ text }: { text: string }) {
  const { mainTheme, subTheme, points, raw } = parseThemeString(text)

  if (!mainTheme && !subTheme && points.length === 0) {
    return (
      <div className="mt-2 space-y-1 text-zinc-600 dark:text-zinc-400">
        <p className="leading-relaxed">{raw}</p>
      </div>
    )
  }

  return (
    <div className="mt-2 space-y-3">
      {/* Card 1: Tema Utama */}
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

      {/* Card 2: Sub-Tema */}
      {subTheme && (
        <div className="rounded-xl border border-sky-200 bg-sky-50/70 p-3.5 shadow-2xs dark:border-sky-900/60 dark:bg-sky-950/30">
          <div className="flex items-center gap-1.5 text-[11px] font-bold tracking-wider text-sky-700 dark:text-sky-400 uppercase">
            <Layers className="h-3.5 w-3.5" />
            <span>Sub-Tema / Fokus Kegiatan</span>
          </div>
          <p className="mt-1 font-medium text-zinc-800 dark:text-zinc-200 text-sm leading-snug">
            {subTheme}
          </p>
        </div>
      )}

      {/* Poin / Kategori Fokus Pills */}
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

export function AiSummaryCard({ summary, isLoading, isGenerating, onRegenerate }: AiSummaryCardProps) {
  const [copied, setCopied] = useState(false)
  const [isExpanded, setIsExpanded] = useState(true)
  const [selectedModel, setSelectedModel] = useState<string>(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('ai-summary-model') || 'gemini-3.6-flash'
    }
    return 'gemini-3.6-flash'
  })
  const { data: portfolio = [] } = usePortfolio()

  useEffect(() => {
    // Only set from summary if user hasn't saved a preference yet
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

  return (
    <Card className="space-y-4 p-4 sm:p-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-b border-zinc-200 pb-3 dark:border-zinc-800">
        <div className="flex flex-wrap items-center gap-2.5">
          <Sparkles className="h-5 w-5 text-amber-500 shrink-0" />
          <h3 className="font-semibold text-zinc-900 dark:text-zinc-50">AI Summary &amp; Advice</h3>

          {/* Model Selector Dropdown */}
          <div className="flex items-center gap-1.5 rounded-lg border border-zinc-200 bg-zinc-50/80 px-2.5 py-1 transition-colors hover:bg-zinc-100 dark:border-zinc-800 dark:bg-zinc-900/80 dark:hover:bg-zinc-800/80">
            <Cpu className="h-3.5 w-3.5 text-sky-500" />
            <select
              value={selectedModel}
              onChange={(e) => handleModelChange(e.target.value)}
              disabled={isGenerating}
              className="bg-transparent text-xs font-medium text-zinc-800 dark:text-zinc-200 outline-none cursor-pointer"
              aria-label="Select AI model"
            >
              {MODEL_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value} className="bg-white text-zinc-900 dark:bg-zinc-900 dark:text-zinc-100">
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
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
          <Button variant="secondary" size="sm" onClick={() => onRegenerate(selectedModel)} disabled={isGenerating}>
            <RefreshCw className={`h-3.5 w-3.5 ${isGenerating ? 'animate-spin' : ''}`} />
            {summary ? 'Regenerate' : 'Generate Summary'}
          </Button>
        </div>
      </div>

      {showSkeleton ? (
        <div className="space-y-4 py-2">
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
