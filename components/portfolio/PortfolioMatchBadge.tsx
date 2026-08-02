'use client'

import { AlertTriangle, Lightbulb } from 'lucide-react'
import type { PortfolioEntry } from '@/lib/types/database'

interface PortfolioMatchBadgeProps {
  matches: PortfolioEntry[]
}

export function PortfolioMatchBadge({ matches }: PortfolioMatchBadgeProps) {
  if (!matches || matches.length === 0) return null

  return (
    <div className="space-y-2 rounded-lg border border-purple-200 bg-purple-50 p-3.5 text-xs text-purple-900 dark:border-purple-900/60 dark:bg-purple-950/40 dark:text-purple-200">
      {matches.map((match) => (
        <div key={match.id} className="space-y-1">
          <div className="flex items-center gap-1.5 font-medium">
            <Lightbulb className="h-4 w-4 shrink-0 text-purple-600 dark:text-purple-400" />
            <span>Possible fit: reuse/adapt {match.name}</span>
          </div>
          {match.used_in_competitions.length > 0 && (
            <p className="text-purple-700 dark:text-purple-300">
              Used in: {match.used_in_competitions.join(', ')}
            </p>
          )}
        </div>
      ))}
      <div className="flex items-center gap-1.5 border-t border-purple-200 pt-2 text-[11px] text-purple-800 dark:border-purple-900/60 dark:text-purple-300">
        <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-amber-600" />
        <span>Check competition originality and IP rules before resubmitting existing work.</span>
      </div>
    </div>
  )
}
