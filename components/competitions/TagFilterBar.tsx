'use client'

import { Select } from '@/components/ui/Select'
import { STATUS_ORDER, statusLabel } from '@/lib/status'
import { formatTag } from '@/lib/tags'
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
  const tagOptions = Array.from(new Set(competitions.flatMap((c) => c.tags))).sort()
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

  return (
    <div className="flex flex-wrap items-center gap-4 text-sm">
      <div className="flex flex-wrap gap-2">
        {STATUS_ORDER.map((s) => (
          <label key={s} className="flex items-center gap-1.5 cursor-pointer">
            <input type="checkbox" checked={value.status.includes(s)} onChange={() => toggleStatus(s)} />
            {statusLabel(s)}
          </label>
        ))}
      </div>
      {tagOptions.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {tagOptions.map((tag) => (
            <label key={tag} className="flex items-center gap-1.5 cursor-pointer">
              <input type="checkbox" checked={value.tags.includes(tag)} onChange={() => toggleTag(tag)} />
              {formatTag(tag)}
            </label>
          ))}
        </div>
      )}
      {teamOptions.length > 0 && (
        <Select
          aria-label="Filter by team"
          value={value.team ?? ''}
          onChange={(e) => onChange({ ...value, team: e.target.value || null })}
          className="w-40"
        >
          <option value="">All teams</option>
          {teamOptions.map((team) => (
            <option key={team} value={team}>{team}</option>
          ))}
        </Select>
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
