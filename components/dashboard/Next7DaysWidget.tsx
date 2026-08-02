'use client'

import Link from 'next/link'
import { CalendarDays, Clock } from 'lucide-react'
import { formatDateTime } from '@/lib/date-format'
import { useUpcomingDeadlines } from '@/hooks/useUpcomingDeadlines'

export function Next7DaysWidget() {
  const { data: items, isLoading } = useUpcomingDeadlines()

  return (
    <div className="rounded-2xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950 overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-2 border-b border-zinc-100 px-5 py-3.5 dark:border-zinc-800">
        <CalendarDays className="h-4 w-4 text-sky-500" />
        <h2 className="text-sm font-semibold text-zinc-700 dark:text-zinc-200">Next 7 Days</h2>
      </div>

      {/* Body */}
      <div className="divide-y divide-zinc-50 dark:divide-zinc-800/60">
        {isLoading && (
          <div className="space-y-2.5 px-5 py-4">
            {[80, 60, 72].map((w) => (
              <div key={w} className="flex items-center justify-between">
                <div className={`h-3 rounded bg-zinc-100 dark:bg-zinc-800`} style={{ width: `${w}%` }} />
                <div className="h-3 w-24 rounded bg-zinc-100 dark:bg-zinc-800" />
              </div>
            ))}
          </div>
        )}

        {!isLoading && (!items || items.length === 0) && (
          <div className="flex flex-col items-center gap-2 py-8 text-center">
            <Clock className="h-8 w-8 text-zinc-200 dark:text-zinc-700" />
            <p className="text-sm text-zinc-400 dark:text-zinc-500">Nothing due in the next 7 days.</p>
          </div>
        )}

        {!isLoading && items && items.length > 0 && items.map((item) => (
          <div key={item.id} className="flex items-center justify-between gap-4 px-5 py-3 hover:bg-zinc-50 transition-colors dark:hover:bg-zinc-900/50">
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-zinc-900 dark:text-zinc-50">{item.title}</p>
              {item.competitions && (
                <Link
                  href={`/competitions/${item.competition_id}`}
                  className="text-xs text-sky-600 hover:underline dark:text-sky-400"
                >
                  {item.competitions.name}
                </Link>
              )}
            </div>
            <span className="shrink-0 rounded-md bg-zinc-50 px-2 py-1 text-xs tabular-nums text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400">
              {formatDateTime(item.event_at)}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}
