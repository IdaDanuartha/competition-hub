'use client'

import { useEffect, useState } from 'react'
import { X, TriangleAlert } from 'lucide-react'
import { detectDeadlineOverlaps } from '@/lib/rundown'
import type { Competition } from '@/lib/types/database'

const STORAGE_KEY = 'dismissed-overlap-pairs'

function pairKey(ids: string[]): string {
  return [...ids].sort().join(':')
}

function loadDismissed(): Set<string> {
  if (typeof window === 'undefined') return new Set()
  try {
    return new Set(JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]'))
  } catch {
    return new Set()
  }
}

export function DeadlineOverlapBanner({ competitions }: { competitions: Competition[] }) {
  const [dismissed, setDismissed] = useState<Set<string>>(new Set())

  useEffect(() => {
    setDismissed(loadDismissed())
  }, [])

  const overlaps = detectDeadlineOverlaps(competitions).filter(
    (o) => !dismissed.has(pairKey(o.competitionIds))
  )

  function dismiss(ids: string[]) {
    const next = new Set(dismissed)
    next.add(pairKey(ids))
    setDismissed(next)
    localStorage.setItem(STORAGE_KEY, JSON.stringify([...next]))
  }

  if (overlaps.length === 0) return null

  return (
    <div className="space-y-2">
      {overlaps.map((overlap) => (
        <div
          key={pairKey(overlap.competitionIds)}
          className="flex items-center justify-between rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-300"
        >
          <span className="flex items-center gap-2">
            <TriangleAlert className="h-4 w-4" />
            {overlap.competitionNames.join(' and ')} have deadlines within 3 days of each other.
          </span>
          <button aria-label="Dismiss" onClick={() => dismiss(overlap.competitionIds)}>
            <X className="h-4 w-4" />
          </button>
        </div>
      ))}
    </div>
  )
}
