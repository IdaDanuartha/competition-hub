'use client'

import { useMemo, useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Search, Compass } from 'lucide-react'
import { Input } from '@/components/ui/Input'
import { Button } from '@/components/ui/Button'
import { Skeleton } from '@/components/ui/Skeleton'
import { ModelSelector, type ModelOption } from '@/components/ui/ModelSelector'
import { DiscoveredCompetitionCard } from '@/components/discover/DiscoveredCompetitionCard'
import { useCompetitions } from '@/hooks/useCompetitions'
import { usePreferredModel } from '@/hooks/usePreferredModel'
import { PREFILL_STORAGE_KEY, type DiscoveredCompetition } from '@/lib/discover'

const MODEL_OPTIONS: ModelOption[] = [
  { value: 'gemini-3.6-flash', label: 'gemini-3.6-flash (Fast & Smart)' },
  { value: 'gemini-2.5-flash', label: 'gemini-2.5-flash' },
  { value: 'gpt-4o-mini', label: 'gpt-4o-mini (OpenAI Fast)' },
  { value: 'gpt-4o', label: 'gpt-4o (OpenAI Flagship High-Reasoning)' },
]

export default function DiscoverPage() {
  const router = useRouter()
  const { data: competitions } = useCompetitions()
  const [preferredModel, setPreferredModel] = usePreferredModel('gemini-3.6-flash')
  const [modelStatuses, setModelStatuses] = useState<Record<string, any>>({})

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

  const defaultKeywords = useMemo(() => {
    if (!competitions) return ''
    const tagCounts = new Map<string, number>()
    for (const c of competitions) {
      for (const tag of c.tags) {
        tagCounts.set(tag, (tagCounts.get(tag) ?? 0) + 1)
      }
    }
    return Array.from(tagCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([tag]) => tag)
      .join(', ')
  }, [competitions])

  const [keywords, setKeywords] = useState('')
  const [hasSearched, setHasSearched] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [results, setResults] = useState<DiscoveredCompetition[]>([])

  const effectiveKeywords = keywords || defaultKeywords

  async function handleSearch() {
    if (!effectiveKeywords.trim()) return
    setIsLoading(true)
    setError(null)
    setHasSearched(true)
    try {
      const res = await fetch('/api/discover-competitions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ keywords: effectiveKeywords, preferred_model: preferredModel }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error || 'Gagal mencari lomba.')
        setResults([])
        return
      }
      setResults(data.results || [])
    } catch (e: any) {
      setError(e?.message || 'Gagal mencari lomba.')
      setResults([])
    } finally {
      setIsLoading(false)
    }
  }

  function handleAdd(competition: DiscoveredCompetition) {
    sessionStorage.setItem(
      PREFILL_STORAGE_KEY,
      JSON.stringify({
        name: competition.name,
        organizer: competition.organizer ?? '',
        theme: competition.theme ?? '',
        tags: competition.tags,
        website_url: competition.website_url ?? '',
        registration_deadline: competition.registration_deadline ?? null,
        submission_deadline: competition.submission_deadline ?? null,
      })
    )
    router.push('/competitions/new')
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6 py-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Compass className="h-5 w-5 text-sky-500" />
          <h1 className="text-xl font-bold text-zinc-900 dark:text-zinc-50">Discover</h1>
        </div>

        {/* AI Model Selector */}
        <ModelSelector
          options={MODEL_OPTIONS}
          selectedModel={preferredModel}
          modelStatuses={modelStatuses}
          onSelectModel={(model) => setPreferredModel(model)}
          disabled={isLoading}
        />
      </div>

      <p className="text-xs text-zinc-500 dark:text-zinc-400">
        Cari lomba/hackathon baru pakai AI web search, lalu tambahkan yang cocok ke Competitions kamu.
      </p>

      <div className="flex flex-col sm:flex-row gap-2">
        <Input
          value={keywords}
          onChange={(e) => setKeywords(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
          placeholder={defaultKeywords || 'e.g. hackathon AI mahasiswa 2026'}
        />
        <Button onClick={handleSearch} isLoading={isLoading} className="gap-1.5 shrink-0">
          <Search className="h-4 w-4" />
          Cari Lomba Baru
        </Button>
      </div>

      {isLoading && (
        <div className="space-y-3">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-32 w-full rounded-2xl" />
          ))}
        </div>
      )}

      {!isLoading && error && (
        <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-xs text-red-700 dark:border-red-900 dark:bg-red-950/50 dark:text-red-300 space-y-2">
          <p>{error}</p>
          <Button variant="secondary" size="sm" onClick={handleSearch}>
            Coba lagi
          </Button>
        </div>
      )}

      {!isLoading && !error && hasSearched && results.length === 0 && (
        <p className="text-xs text-zinc-400 dark:text-zinc-500 text-center py-6">
          Ga ketemu lomba aktif yang buka pendaftaran, coba keyword lain.
        </p>
      )}

      {!isLoading && !error && results.length > 0 && (
        <div className="space-y-3">
          {results.map((competition, i) => (
            <DiscoveredCompetitionCard key={`${competition.name}-${i}`} competition={competition} onAdd={handleAdd} />
          ))}
        </div>
      )}
    </div>
  )
}
