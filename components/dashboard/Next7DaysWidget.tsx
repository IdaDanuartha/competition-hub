'use client'

import Link from 'next/link'
import { CalendarDays, Clock } from 'lucide-react'
import { formatDateTime } from '@/lib/date-format'
import { useUpcomingDeadlines } from '@/hooks/useUpcomingDeadlines'

export function Next7DaysWidget() {
  const { data: items, isLoading } = useUpcomingDeadlines()

  return (
    <div className="rounded-2xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950 overflow-hidden shadow-xs">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-zinc-100 px-4 py-3 dark:border-zinc-800">
        <div className="flex items-center gap-2">
          <CalendarDays className="h-4 w-4 text-sky-500" />
          <h2 className="text-xs font-semibold text-zinc-700 dark:text-zinc-200">Next 7 Days</h2>
          {items && items.length > 0 && (
            <span className="rounded-full bg-sky-100 px-2 py-0.5 text-[10px] font-bold text-sky-700 dark:bg-sky-950/80 dark:text-sky-300">
              {items.length} agenda
            </span>
          )}
        </div>
      </div>

      {/* Body - Max height with scrollbar to keep dashboard compact */}
      <div className="max-h-56 overflow-y-auto divide-y divide-zinc-50 dark:divide-zinc-800/60">
        {isLoading && (
          <div className="space-y-2.5 px-4 py-3">
            {[80, 60, 72].map((w) => (
              <div key={w} className="flex items-center justify-between">
                <div className={`h-3 rounded bg-zinc-100 dark:bg-zinc-800`} style={{ width: `${w}%` }} />
                <div className="h-3 w-24 rounded bg-zinc-100 dark:bg-zinc-800" />
              </div>
            ))}
          </div>
        )}

        {!isLoading && (!items || items.length === 0) && (
          <div className="flex flex-col items-center gap-1.5 py-6 text-center">
            <Clock className="h-6 w-6 text-zinc-300 dark:text-zinc-700" />
            <p className="text-xs text-zinc-400 dark:text-zinc-500">Nothing due in the next 7 days.</p>
          </div>
        )}

        {!isLoading &&
          items &&
          items.length > 0 &&
          items.map((item) => (
            <div
              key={item.id}
              className="flex items-center justify-between gap-4 px-4 py-2.5 hover:bg-zinc-50/80 transition-colors dark:hover:bg-zinc-900/50"
            >
              <div className="min-w-0 flex-1">
                <p className="truncate text-xs font-semibold text-zinc-900 dark:text-zinc-50">{item.title}</p>
                {item.competitions && (
                  <Link
                    href={`/competitions/${item.competition_id}`}
                    className="text-[11px] font-medium text-sky-600 hover:underline dark:text-sky-400 truncate block"
                  >
                    {item.competitions.name}
                  </Link>
                )}
              </div>
              <span className="shrink-0 rounded-md bg-zinc-100 px-2 py-0.5 text-[11px] tabular-nums font-medium text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">
                {formatDateTime(item.event_at)}
              </span>
            </div>
          ))}
      </div>
    </div>
  )
}
