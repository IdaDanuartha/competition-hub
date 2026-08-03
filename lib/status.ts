import type { CompetitionStatus } from '@/lib/types/database'

export const STATUS_ORDER: CompetitionStatus[] = [
  'researching', 'registered', 'in_progress', 'submitted', 'finalist', 'completed', 'not_selected', 'cancelled',
]

const PROGRESS_LADDER: CompetitionStatus[] = [
  'researching', 'registered', 'in_progress', 'submitted', 'finalist', 'completed',
]

const LABELS: Record<CompetitionStatus, string> = {
  researching: 'Researching',
  registered: 'Registered',
  in_progress: 'In Progress',
  submitted: 'Submitted',
  finalist: 'Finalist',
  completed: 'Completed',
  not_selected: 'Not Selected',
  cancelled: 'Cancelled',
}

const COLORS: Record<CompetitionStatus, string> = {
  researching: 'bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300',
  registered: 'bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300',
  in_progress: 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300',
  submitted: 'bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-300',
  finalist: 'bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-300',
  completed: 'bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-300',
  not_selected: 'bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300',
  cancelled: 'bg-zinc-200 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300',
}

export function statusLabel(status: CompetitionStatus): string {
  return LABELS[status]
}

export function statusColorClass(status: CompetitionStatus): string {
  return COLORS[status]
}

export function statusProgress(status: CompetitionStatus): { stage: number; total: number } {
  const total = PROGRESS_LADDER.length
  if (status === 'not_selected' || status === 'cancelled') return { stage: total, total }
  const index = PROGRESS_LADDER.indexOf(status)
  return { stage: index + 1, total }
}
