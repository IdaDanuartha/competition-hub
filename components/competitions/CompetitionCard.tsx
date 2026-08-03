'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Card } from '@/components/ui/Card'
import { Select } from '@/components/ui/Select'
import { ProgressStages } from './ProgressStages'
import { STATUS_ORDER, statusLabel } from '@/lib/status'
import { formatDate } from '@/lib/date-format'
import { formatTag } from '@/lib/tags'
import { useUpdateCompetitionStatus } from '@/hooks/useCompetitions'
import type { Competition, CompetitionStatus } from '@/lib/types/database'
import type { NextRundownEntry } from '@/hooks/useNextRundownDates'

const FINISHED_STATUSES = new Set<CompetitionStatus>(['completed', 'not_selected'])

export function CompetitionCard({
  competition,
  nextRundown,
}: {
  competition: Competition
  nextRundown?: NextRundownEntry
}) {
  const { mutate } = useUpdateCompetitionStatus()
  const [isDragging, setIsDragging] = useState(false)

  const isFinished = FINISHED_STATUSES.has(competition.status)

  // Determine next date: prefer rundown event, fall back to deadline fields
  const nextDateStr = nextRundown
    ? formatDate(nextRundown.event_at)
    : formatDate(competition.submission_deadline ?? competition.registration_deadline)
  const nextLabel = nextRundown ? nextRundown.title : null
  const showNext = !isFinished && !!nextDateStr

  return (
    <div
      draggable
      onDragStart={(e) => {
        setIsDragging(true)
        e.dataTransfer.setData('text/plain', competition.id)
        e.dataTransfer.effectAllowed = 'move'
      }}
      onDragEnd={() => setIsDragging(false)}
      className={`cursor-grab active:cursor-grabbing transition-opacity ${isDragging ? 'opacity-40' : 'opacity-100'}`}
    >
      <Card className="space-y-2 p-3 hover:shadow-md transition-shadow">
        <Link href={`/competitions/${competition.id}`} className="font-medium text-zinc-900 hover:underline dark:text-zinc-50 block">
          {competition.name}
        </Link>
        {competition.tags.length > 0 && (
          <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
            {competition.tags.map(formatTag).join(', ')}
          </p>
        )}
        <ProgressStages status={competition.status} />
        {showNext && (
          <div className="flex flex-col gap-0">
            <p className="text-xs text-zinc-500 dark:text-zinc-400">
              Next: {nextDateStr}
            </p>
            {nextLabel && (
              <p className="text-[10px] text-zinc-400 dark:text-zinc-500 leading-tight truncate">
                {nextLabel}
              </p>
            )}
          </div>
        )}
        <Select
          aria-label={`Move ${competition.name} to a different status`}
          value={competition.status}
          onChange={(e) => mutate({ id: competition.id, status: e.target.value as CompetitionStatus })}
          className="text-xs cursor-pointer"
        >
          {STATUS_ORDER.map((s) => (
            <option key={s} value={s}>{statusLabel(s)}</option>
          ))}
        </Select>
      </Card>
    </div>
  )
}
