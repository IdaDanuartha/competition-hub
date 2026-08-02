'use client'

import Link from 'next/link'
import { StatusBadge } from './StatusBadge'
import { formatDate } from '@/lib/date-format'
import { formatTag } from '@/lib/tags'
import type { Competition } from '@/lib/types/database'

type SortKey = 'name' | 'nearestDeadline' | 'status'

function nearestDeadline(c: Competition): number {
  const dates = [c.registration_deadline, c.submission_deadline].filter(Boolean) as string[]
  if (dates.length === 0) return Infinity
  return Math.min(...dates.map((d) => new Date(d).getTime()))
}

function sortCompetitions(competitions: Competition[], sortKey: SortKey): Competition[] {
  const copy = [...competitions]
  if (sortKey === 'name') return copy.sort((a, b) => a.name.localeCompare(b.name))
  if (sortKey === 'status') return copy.sort((a, b) => a.status.localeCompare(b.status))
  return copy.sort((a, b) => nearestDeadline(a) - nearestDeadline(b))
}

interface CompetitionTableProps {
  competitions: Competition[]
  sortKey: SortKey
  onSortKeyChange: (key: SortKey) => void
}

export function CompetitionTable({ competitions, sortKey, onSortKeyChange }: CompetitionTableProps) {
  if (competitions.length === 0) {
    return (
      <p className="py-12 text-center text-sm text-zinc-500 dark:text-zinc-400">
        No competitions match the current filters.
      </p>
    )
  }

  const sorted = sortCompetitions(competitions, sortKey)

  return (
    <table className="w-full text-left text-sm">
      <thead>
        <tr className="border-b border-zinc-200 text-xs uppercase tracking-wide text-zinc-500 dark:border-zinc-800 dark:text-zinc-400">
          <th className="cursor-pointer py-2" onClick={() => onSortKeyChange('name')}>Name</th>
          <th className="cursor-pointer py-2" onClick={() => onSortKeyChange('status')}>Status</th>
          <th className="py-2">Tags</th>
          <th className="cursor-pointer py-2" onClick={() => onSortKeyChange('nearestDeadline')}>Next Date</th>
        </tr>
      </thead>
      <tbody>
        {sorted.map((c) => (
          <tr key={c.id} className="border-b border-zinc-100 last:border-0 dark:border-zinc-900">
            <td className="py-2.5">
              <Link href={`/competitions/${c.id}`} data-testid="competition-row-name" className="font-medium text-zinc-900 hover:underline dark:text-zinc-50">
                {c.name}
              </Link>
            </td>
            <td className="py-2.5"><StatusBadge status={c.status} /></td>
            <td className="py-2.5">
              {(() => {
                const validTags = c.tags.filter((t) => t && t !== '_' && t.trim() !== '')
                if (validTags.length === 0) return <span className="text-zinc-400 dark:text-zinc-600">—</span>
                return (
                  <div className="flex flex-wrap gap-1">
                    {validTags.map((tag) => (
                      <span
                        key={tag}
                        className="inline-flex items-center rounded-full bg-zinc-100 px-2 py-0.5 text-xs font-medium text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300"
                      >
                        {formatTag(tag)}
                      </span>
                    ))}
                  </div>
                )
              })()}
            </td>
            <td className="py-2.5 text-zinc-500 dark:text-zinc-400">
              {formatDate(c.submission_deadline ?? c.registration_deadline)}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}
