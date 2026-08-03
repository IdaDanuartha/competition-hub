// app/(app)/calendar/page.tsx
'use client'

import { useMemo, useState } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { CalendarGrid } from '@/components/calendar/CalendarGrid'
import { CalendarDayList } from '@/components/calendar/CalendarDayList'
import { useCalendarRundownItems } from '@/hooks/useCalendarRundownItems'
import { ALL_CALENDAR_CATEGORIES, getCategoryColorClasses, getCategoryLabel } from '@/lib/calendar-categories'
import { Button } from '@/components/ui/Button'

function startOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1)
}

function addMonths(date: Date, delta: number): Date {
  return new Date(date.getFullYear(), date.getMonth() + delta, 1)
}

function gridRange(month: Date): { start: Date; end: Date } {
  const firstOfMonth = startOfMonth(month)
  const startWeekday = firstOfMonth.getDay()
  const start = new Date(firstOfMonth.getFullYear(), firstOfMonth.getMonth(), 1 - startWeekday)
  const daysInMonth = new Date(firstOfMonth.getFullYear(), firstOfMonth.getMonth() + 1, 0).getDate()
  const lastOfMonth = new Date(firstOfMonth.getFullYear(), firstOfMonth.getMonth(), daysInMonth)
  const trailingDays = (7 - ((lastOfMonth.getDay() + 1) % 7)) % 7
  const end = new Date(lastOfMonth.getFullYear(), lastOfMonth.getMonth(), lastOfMonth.getDate() + trailingDays, 23, 59, 59)
  return { start, end }
}

export default function CalendarPage() {
  const [currentMonth, setCurrentMonth] = useState(() => startOfMonth(new Date()))
  const [selectedDay, setSelectedDay] = useState<Date | null>(() => new Date())

  const { start, end } = useMemo(() => gridRange(currentMonth), [currentMonth])
  const { data: events, isLoading, error, refetch } = useCalendarRundownItems(start, end)

  const dayEvents = useMemo(() => {
    if (!events || !selectedDay) return []
    return events.filter((event) => {
      const eventDate = new Date(event.event_at)
      return (
        eventDate.getFullYear() === selectedDay.getFullYear() &&
        eventDate.getMonth() === selectedDay.getMonth() &&
        eventDate.getDate() === selectedDay.getDate()
      )
    })
  }, [events, selectedDay])

  return (
    <div className="mx-auto max-w-5xl space-y-6 py-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-zinc-900 dark:text-zinc-50">Calendar</h1>
        <div className="flex items-center gap-2">
          <Button variant="secondary" size="sm" onClick={() => setCurrentMonth((m) => addMonths(m, -1))} aria-label="Previous month">
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="w-32 text-center text-sm font-semibold text-zinc-700 dark:text-zinc-200">
            {currentMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
          </span>
          <Button variant="secondary" size="sm" onClick={() => setCurrentMonth((m) => addMonths(m, 1))} aria-label="Next month">
            <ChevronRight className="h-4 w-4" />
          </Button>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => {
              setCurrentMonth(startOfMonth(new Date()))
              setSelectedDay(new Date())
            }}
          >
            Today
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap gap-3">
        {ALL_CALENDAR_CATEGORIES.map((category) => {
          const colors = getCategoryColorClasses(category)
          return (
            <div key={category} className="flex items-center gap-1.5 text-[11px] text-zinc-600 dark:text-zinc-400">
              <span className={`h-2 w-2 rounded-full ${colors.dot}`} />
              {getCategoryLabel(category)}
            </div>
          )
        })}
      </div>

      {isLoading && (
        <div className="grid grid-cols-7 gap-1">
          {Array.from({ length: 42 }).map((_, i) => (
            <div key={i} className="h-16 rounded-lg bg-zinc-100 animate-pulse dark:bg-zinc-900" />
          ))}
        </div>
      )}

      {error && (
        <div className="flex items-center justify-between gap-3 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-xs text-red-700 dark:border-red-900 dark:bg-red-950/50 dark:text-red-300">
          Failed to load calendar events.
          <Button variant="secondary" size="sm" onClick={() => refetch()}>
            Retry
          </Button>
        </div>
      )}

      {!isLoading && !error && (
        <div className="grid gap-4 md:grid-cols-[2fr_1fr]">
          <CalendarGrid month={currentMonth} events={events ?? []} selectedDay={selectedDay} onSelectDay={setSelectedDay} />
          <CalendarDayList day={selectedDay} events={dayEvents} />
        </div>
      )}
    </div>
  )
}
