'use client'

import Link from 'next/link'
import { ArrowUpDown, ChevronDown, Calendar, Tag as TagIcon } from 'lucide-react'
import { formatDate } from '@/lib/date-format'
import { formatTag } from '@/lib/tags'
import { STATUS_ORDER, statusLabel, statusColorClass } from '@/lib/status'
import { useUpdateCompetitionStatus } from '@/hooks/useCompetitions'
import type { Competition, CompetitionStatus } from '@/lib/types/database'
import { cn } from '@/lib/cn'

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
  const { mutate: updateStatus } = useUpdateCompetitionStatus()

  if (competitions.length === 0) {
    return (
      <div className="rounded-2xl border border-zinc-200 bg-white p-12 text-center shadow-xs dark:border-zinc-800 dark:bg-zinc-950">
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          No competitions match the current filters.
        </p>
      </div>
    )
  }

  const sorted = sortCompetitions(competitions, sortKey)

  return (
    <div className="rounded-2xl border border-zinc-200 bg-white shadow-xs overflow-hidden dark:border-zinc-800 dark:bg-zinc-950">
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-zinc-200/80 bg-zinc-50/50 text-[11px] font-semibold uppercase tracking-wider text-zinc-500 dark:border-zinc-800 dark:bg-zinc-900/40 dark:text-zinc-400">
              <th
                className="cursor-pointer py-3.5 px-5 transition-colors hover:text-zinc-900 dark:hover:text-zinc-200"
                onClick={() => onSortKeyChange('name')}
              >
                <div className="flex items-center gap-1.5">
                  <span>Name</span>
                  <ArrowUpDown className="h-3 w-3 opacity-60" />
                </div>
              </th>
              <th
                className="cursor-pointer py-3.5 px-4 transition-colors hover:text-zinc-900 dark:hover:text-zinc-200"
                onClick={() => onSortKeyChange('status')}
              >
                <div className="flex items-center gap-1.5">
                  <span>Status</span>
                  <ArrowUpDown className="h-3 w-3 opacity-60" />
                </div>
              </th>
              <th className="py-3.5 px-4">
                <div className="flex items-center gap-1.5">
                  <TagIcon className="h-3 w-3 opacity-60" />
                  <span>Tags</span>
                </div>
              </th>
              <th
                className="cursor-pointer py-3.5 px-5 transition-colors hover:text-zinc-900 dark:hover:text-zinc-200"
                onClick={() => onSortKeyChange('nearestDeadline')}
              >
                <div className="flex items-center gap-1.5">
                  <Calendar className="h-3 w-3 opacity-60" />
                  <span>Next Date</span>
                  <ArrowUpDown className="h-3 w-3 opacity-60" />
                </div>
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800/60">
            {sorted.map((c) => {
              const validTags = c.tags.filter((t) => t && t !== '_' && t.trim() !== '')
              return (
                <tr
                  key={c.id}
                  className="group transition-colors hover:bg-zinc-50/80 dark:hover:bg-zinc-900/50"
                >
                  {/* Name Column */}
                  <td className="py-3.5 px-5">
                    <Link
                      href={`/competitions/${c.id}`}
                      data-testid="competition-row-name"
                      className="font-medium text-zinc-900 group-hover:text-sky-600 dark:text-zinc-50 dark:group-hover:text-sky-400 transition-colors"
                    >
                      {c.name}
                    </Link>
                    {c.team_name && (
                      <p className="text-[11px] text-zinc-400 dark:text-zinc-500">Team: {c.team_name}</p>
                    )}
                  </td>

                  {/* Editable Status Dropdown Column */}
                  <td className="py-3.5 px-4">
                    <div className="relative inline-block">
                      <select
                        aria-label={`Status for ${c.name}`}
                        value={c.status}
                        onChange={(e) => updateStatus({ id: c.id, status: e.target.value as CompetitionStatus })}
                        className={cn(
                          'appearance-none rounded-full px-3 py-1 pr-6 text-xs font-semibold cursor-pointer border-0 transition-all focus:ring-2 focus:ring-sky-500 focus:outline-hidden',
                          statusColorClass(c.status)
                        )}
                      >
                        {STATUS_ORDER.map((s) => (
                          <option key={s} value={s} className="bg-white text-zinc-900 dark:bg-zinc-900 dark:text-zinc-50">
                            {statusLabel(s)}
                          </option>
                        ))}
                      </select>
                      <ChevronDown className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 h-3 w-3 opacity-60" />
                    </div>
                  </td>

                  {/* Tags Column */}
                  <td className="py-3.5 px-4">
                    {validTags.length === 0 ? (
                      <span className="text-xs text-zinc-400 dark:text-zinc-600">—</span>
                    ) : (
                      <div className="flex flex-wrap gap-1">
                        {validTags.map((tag) => (
                          <span
                            key={tag}
                            className="inline-flex items-center rounded-md bg-zinc-100 px-2 py-0.5 text-xs font-medium text-zinc-600 dark:bg-zinc-800/80 dark:text-zinc-300"
                          >
                            {formatTag(tag)}
                          </span>
                        ))}
                      </div>
                    )}
                  </td>

                  {/* Next Date Column */}
                  <td className="py-3.5 px-5 text-xs tabular-nums text-zinc-500 dark:text-zinc-400">
                    {formatDate(c.submission_deadline ?? c.registration_deadline) || '—'}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
