'use client'

import { ExternalLink, Plus } from 'lucide-react'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { formatDate } from '@/lib/date-format'
import type { DiscoveredCompetition } from '@/lib/discover'

interface DiscoveredCompetitionCardProps {
  competition: DiscoveredCompetition
  onAdd: (competition: DiscoveredCompetition) => void
}

export function DiscoveredCompetitionCard({ competition, onAdd }: DiscoveredCompetitionCardProps) {
  return (
    <Card className="p-4 space-y-2.5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="font-semibold text-sm text-zinc-900 dark:text-zinc-50">{competition.name}</h3>
          {competition.organizer && (
            <p className="text-xs text-zinc-500 dark:text-zinc-400">{competition.organizer}</p>
          )}
        </div>
        {competition.website_url && (
          <a
            href={competition.website_url}
            target="_blank"
            rel="noopener noreferrer"
            className="shrink-0 flex items-center gap-1 text-xs font-medium text-sky-600 hover:underline dark:text-sky-400"
          >
            Situs <ExternalLink className="h-3 w-3" />
          </a>
        )}
      </div>

      {competition.summary_snippet && (
        <p className="text-xs text-zinc-600 dark:text-zinc-400">{competition.summary_snippet}</p>
      )}

      {competition.tags.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {competition.tags.map((tag) => (
            <span
              key={tag}
              className="rounded-full bg-zinc-100 px-2 py-0.5 text-[10px] font-medium text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300"
            >
              {tag}
            </span>
          ))}
        </div>
      )}

      {(competition.registration_deadline || competition.submission_deadline) && (
        <div className="flex flex-wrap gap-3 text-[11px] text-zinc-500 dark:text-zinc-400">
          {competition.registration_deadline && (
            <span>Pendaftaran: {formatDate(competition.registration_deadline)}</span>
          )}
          {competition.submission_deadline && (
            <span>Submit: {formatDate(competition.submission_deadline)}</span>
          )}
        </div>
      )}

      <div className="pt-1">
        <Button size="sm" variant="secondary" onClick={() => onAdd(competition)} className="gap-1.5">
          <Plus className="h-3.5 w-3.5" />
          Tambah ke Competitions
        </Button>
      </div>
    </Card>
  )
}
