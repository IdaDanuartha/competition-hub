'use client'

import Link from 'next/link'
import { Clock, CalendarX2 } from 'lucide-react'
import { formatDateTime } from '@/lib/date-format'
import { getCalendarCategory, getCategoryColorClasses, getCategoryLabel } from '@/lib/calendar-categories'
import type { CalendarRundownItem } from '@/hooks/useCalendarRundownItems'

export interface CalendarDayListProps {
  day: Date | null
  events: CalendarRundownItem[]
}

export function CalendarDayList({ day, events }: CalendarDayListProps) {
  if (!day) {
    return (
      <div className="flex flex-col items-center gap-1.5 rounded-2xl border border-zinc-200 bg-white py-8 text-center dark:border-zinc-800 dark:bg-zinc-950">
        <Clock className="h-6 w-6 text-zinc-300 dark:text-zinc-700" />
        <p className="text-xs text-zinc-400 dark:text-zinc-500">Select a day to see details.</p>
      </div>
    )
  }

  return (
    <div className="rounded-2xl border border-zinc-200 bg-white overflow-hidden dark:border-zinc-800 dark:bg-zinc-950">
      <div className="border-b border-zinc-100 px-4 py-3 dark:border-zinc-800">
        <h3 className="text-xs font-semibold text-zinc-700 dark:text-zinc-200">
          {day.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
        </h3>
      </div>

      {events.length === 0 ? (
        <div className="flex flex-col items-center gap-1.5 py-6 text-center">
          <CalendarX2 className="h-6 w-6 text-zinc-300 dark:text-zinc-700" />
          <p className="text-xs text-zinc-400 dark:text-zinc-500">No events on this day.</p>
        </div>
      ) : (
        <div className="divide-y divide-zinc-50 dark:divide-zinc-800/60">
          {events.map((item) => {
            const category = getCalendarCategory(item.auto_source, item.title)
            const colors = getCategoryColorClasses(category)
            return (
              <div key={item.id} className="flex items-center justify-between gap-4 px-4 py-2.5">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-xs font-semibold text-zinc-900 dark:text-zinc-50">{item.title}</p>
                  {item.competitions && (
                    <Link
                      href={`/competitions/${item.competition_id}`}
                      className="block truncate text-[11px] font-medium text-sky-600 hover:underline dark:text-sky-400"
                    >
                      {item.competitions.name}
                    </Link>
                  )}
                  <span className={`mt-1 inline-block rounded-full px-2 py-0.5 text-[10px] font-bold ${colors.badgeBg} ${colors.badgeText}`}>
                    {getCategoryLabel(category)}
                  </span>
                </div>
                <span className="shrink-0 rounded-md bg-zinc-100 px-2 py-0.5 text-[11px] tabular-nums font-medium text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">
                  {formatDateTime(item.event_at)}
                </span>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
