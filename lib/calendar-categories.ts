export type CalendarCategory =
  | 'registration_deadline'
  | 'submission_deadline'
  | 'event_start_at'
  | 'event_end_at'
  | 'manual'

export const ALL_CALENDAR_CATEGORIES: CalendarCategory[] = [
  'registration_deadline',
  'submission_deadline',
  'event_start_at',
  'event_end_at',
  'manual',
]

const KNOWN_SOURCES: Record<string, CalendarCategory> = {
  registration_deadline: 'registration_deadline',
  submission_deadline: 'submission_deadline',
  event_start_at: 'event_start_at',
  event_end_at: 'event_end_at',
}

export function getCalendarCategory(autoSource: string | null): CalendarCategory {
  if (!autoSource) return 'manual'
  return KNOWN_SOURCES[autoSource] ?? 'manual'
}

const COLOR_CLASSES: Record<CalendarCategory, { dot: string; badgeBg: string; badgeText: string }> = {
  registration_deadline: {
    dot: 'bg-sky-500',
    badgeBg: 'bg-sky-100 dark:bg-sky-950/80',
    badgeText: 'text-sky-700 dark:text-sky-300',
  },
  submission_deadline: {
    dot: 'bg-rose-500',
    badgeBg: 'bg-rose-100 dark:bg-rose-950/80',
    badgeText: 'text-rose-700 dark:text-rose-300',
  },
  event_start_at: {
    dot: 'bg-emerald-500',
    badgeBg: 'bg-emerald-100 dark:bg-emerald-950/80',
    badgeText: 'text-emerald-700 dark:text-emerald-300',
  },
  event_end_at: {
    dot: 'bg-amber-500',
    badgeBg: 'bg-amber-100 dark:bg-amber-950/80',
    badgeText: 'text-amber-700 dark:text-amber-300',
  },
  manual: {
    dot: 'bg-violet-500',
    badgeBg: 'bg-violet-100 dark:bg-violet-950/80',
    badgeText: 'text-violet-700 dark:text-violet-300',
  },
}

export function getCategoryColorClasses(category: CalendarCategory) {
  return COLOR_CLASSES[category]
}

const LABELS: Record<CalendarCategory, string> = {
  registration_deadline: 'Registration deadline',
  submission_deadline: 'Submission deadline',
  event_start_at: 'Event starts',
  event_end_at: 'Event ends',
  manual: 'Manual / custom',
}

export function getCategoryLabel(category: CalendarCategory): string {
  return LABELS[category]
}


