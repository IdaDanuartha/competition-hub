// components/calendar/CalendarGrid.tsx
'use client'

import { cn } from '@/lib/cn'
import { getCalendarCategory, getCategoryColorClasses } from '@/lib/calendar-categories'
import type { CalendarRundownItem } from '@/hooks/useCalendarRundownItems'

export interface CalendarGridProps {
  month: Date
  events: CalendarRundownItem[]
  selectedDay: Date | null
  onSelectDay: (day: Date) => void
}

const WEEKDAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const MAX_DOTS_PER_DAY = 3

function isSameDay(a: Date, b: Date): boolean {
  return a.getUTCFullYear() === b.getUTCFullYear() && a.getUTCMonth() === b.getUTCMonth() && a.getUTCDate() === b.getUTCDate()
}

function buildGridDays(month: Date): Date[] {
  const year = month.getUTCFullYear()
  const monthIndex = month.getUTCMonth()
  const firstOfMonth = new Date(Date.UTC(year, monthIndex, 1))
  const startWeekday = firstOfMonth.getUTCDay()
  const daysInMonth = new Date(Date.UTC(year, monthIndex + 1, 0)).getUTCDate()

  const days: Date[] = []
  // Leading spillover from previous month.
  for (let i = startWeekday; i > 0; i--) {
    days.push(new Date(Date.UTC(year, monthIndex, 1 - i)))
  }
  // Days of the current month.
  for (let d = 1; d <= daysInMonth; d++) {
    days.push(new Date(Date.UTC(year, monthIndex, d)))
  }
  // Trailing spillover to complete the last week.
  while (days.length % 7 !== 0) {
    const last = days[days.length - 1]
    days.push(new Date(Date.UTC(last.getUTCFullYear(), last.getUTCMonth(), last.getUTCDate() + 1)))
  }
  return days
}

export function CalendarGrid({ month, events, selectedDay, onSelectDay }: CalendarGridProps) {
  const days = buildGridDays(month)
  const today = new Date()

  return (
    <div className="rounded-2xl border border-zinc-200 bg-white p-2 dark:border-zinc-800 dark:bg-zinc-950">
      <div className="grid grid-cols-7 gap-1 pb-1">
        {WEEKDAY_LABELS.map((label) => (
          <div key={label} className="py-1 text-center text-[10px] font-semibold text-zinc-400 dark:text-zinc-500">
            {label}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-1">
        {days.map((day) => {
          const dayEvents = events.filter((event) => isSameDay(new Date(event.event_at), day))
          const isCurrentMonth = day.getUTCMonth() === month.getUTCMonth()
          const isToday = isSameDay(day, today)
          const isSelected = selectedDay !== null && isSameDay(day, selectedDay)
          const visibleDots = dayEvents.slice(0, MAX_DOTS_PER_DAY)
          const overflowCount = dayEvents.length - visibleDots.length

          return (
            <button
              key={day.toISOString()}
              type="button"
              onClick={() => onSelectDay(day)}
              className={cn(
                'flex min-h-16 flex-col items-start gap-1 rounded-lg p-1.5 text-left transition-colors',
                isCurrentMonth ? 'text-zinc-900 dark:text-zinc-50' : 'text-zinc-300 dark:text-zinc-700',
                isSelected
                  ? 'bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900'
                  : 'hover:bg-zinc-50 dark:hover:bg-zinc-900',
                isToday && !isSelected && 'ring-1 ring-sky-400 dark:ring-sky-600'
              )}
            >
              <span className="text-[11px] font-semibold">{isCurrentMonth ? day.getUTCDate() : ''}</span>
              <div className="flex flex-wrap gap-0.5">
                {visibleDots.map((event) => {
                  const colors = getCategoryColorClasses(getCalendarCategory(event.auto_source))
                  return <span key={event.id} data-testid="calendar-event-dot" className={cn('h-1.5 w-1.5 rounded-full', colors.dot)} />
                })}
                {overflowCount > 0 && <span className="text-[9px] font-medium">+{overflowCount}</span>}
              </div>
            </button>
          )
        })}
      </div>
    </div>
  )
}
