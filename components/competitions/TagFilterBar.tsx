'use client'

import { Select } from '@/components/ui/Select'
import { STATUS_ORDER, statusLabel } from '@/lib/status'
import { formatTag } from '@/lib/tags'
import { cn } from '@/lib/cn'
import type { Competition, CompetitionStatus } from '@/lib/types/database'

export interface CompetitionFilter {
  status: CompetitionStatus[]
  tags: string[]
  team: string | null
}

interface TagFilterBarProps {
  competitions: Competition[]
  value: CompetitionFilter
  onChange: (next: CompetitionFilter) => void
}

export function TagFilterBar({ competitions, value, onChange }: TagFilterBarProps) {
  const rawTags = Array.from(new Set(competitions.flatMap((c) => c.tags))).sort()
  const tagOptions = rawTags.filter((t) => t && t !== '_' && t.trim() !== '')
  const teamOptions = Array.from(
    new Set(competitions.map((c) => c.team_name).filter((t): t is string => Boolean(t)))
  ).sort()

  function toggleTag(tag: string) {
    const tags = value.tags.includes(tag) ? value.tags.filter((t) => t !== tag) : [...value.tags, tag]
    onChange({ ...value, tags })
  }

  function toggleStatus(status: CompetitionStatus) {
    const status_ = value.status.includes(status)
      ? value.status.filter((s) => s !== status)
      : [...value.status, status]
    onChange({ ...value, status: status_ })
  }

  const hasActive = value.status.length > 0 || value.tags.length > 0 || value.team

  return (
    <div className="rounded-2xl border border-zinc-200 bg-white p-4 space-y-4 dark:border-zinc-800 dark:bg-zinc-950">
      {/* Section 1: Status Filter */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-zinc-400 dark:text-zinc-500">
            Status
          </span>
          {hasActive && (
            <button
              type="button"
              onClick={() => onChange({ status: [], tags: [], team: null })}
              className="text-xs font-medium text-red-600 hover:underline dark:text-red-400"
            >
              Reset Filters
            </button>
          )}
        </div>
        <div className="flex flex-wrap gap-1.5">
          {STATUS_ORDER.map((s) => {
            const active = value.status.includes(s)
            return (
              <button
                key={s}
                type="button"
                onClick={() => toggleStatus(s)}
                className={cn(
                  'rounded-full border px-3 py-1 text-xs font-medium transition-all',
                  active
                    ? 'border-zinc-900 bg-zinc-900 text-white dark:border-zinc-50 dark:bg-zinc-50 dark:text-zinc-900'
                    : 'border-zinc-200 bg-zinc-50 text-zinc-600 hover:border-zinc-300 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-400 dark:hover:border-zinc-700'
                )}
              >
                {statusLabel(s)}
              </button>
            )
          })}
        </div>
      </div>

      {/* Divider */}
      {(tagOptions.length > 0 || teamOptions.length > 0) && (
        <div className="h-px bg-zinc-100 dark:bg-zinc-800/80" />
      )}

      {/* Section 2: Category / Tags Filter */}
      {tagOptions.length > 0 && (
        <div className="space-y-1.5">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-zinc-400 dark:text-zinc-500">
            Category / Theme
          </span>
          <div className="flex flex-wrap gap-1.5">
            {tagOptions.map((tag) => {
              const active = value.tags.includes(tag)
              return (
                <button
                  key={tag}
                  type="button"
                  onClick={() => toggleTag(tag)}
                  className={cn(
                    'rounded-full border px-3 py-1 text-xs font-medium transition-all',
                    active
                      ? 'border-sky-600 bg-sky-600 text-white dark:border-sky-400 dark:bg-sky-400 dark:text-zinc-900'
                      : 'border-zinc-200 bg-zinc-50 text-zinc-600 hover:border-zinc-300 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-400 dark:hover:border-zinc-700'
                  )}
                >
                  {formatTag(tag)}
                </button>
              )
            })}
          </div>
        </div>
      )}

      {/* Section 3: Team Filter */}
      {teamOptions.length > 0 && (
        <div className="pt-1 flex flex-col sm:flex-row sm:items-center gap-2">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-zinc-400 dark:text-zinc-500 shrink-0">
            Team:
          </span>
          <Select
            aria-label="Filter by team"
            value={value.team ?? ''}
            onChange={(e) => onChange({ ...value, team: e.target.value || null })}
            className="w-full sm:w-48 h-8 rounded-lg border-zinc-200 text-xs dark:border-zinc-800"
          >
            <option value="">All teams</option>
            {teamOptions.map((team) => (
              <option key={team} value={team}>{team}</option>
            ))}
          </Select>
        </div>
      )}
    </div>
  )
}

export function applyCompetitionFilter(competitions: Competition[], filter: CompetitionFilter): Competition[] {
  return competitions.filter((c) => {
    if (filter.status.length > 0 && !filter.status.includes(c.status)) return false
    if (filter.tags.length > 0 && !filter.tags.some((t) => c.tags.includes(t))) return false
    if (filter.team && c.team_name !== filter.team) return false
    return true
  })
}
