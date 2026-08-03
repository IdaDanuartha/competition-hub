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
  registered: 'bg-sky-100 text-sky-700 dark:bg-sky-950 dark:text-sky-300',
  in_progress: 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300',
  submitted: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300',
  finalist: 'bg-purple-100 text-purple-700 dark:bg-purple-950 dark:text-purple-300',
  completed: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300',
  not_selected: 'bg-zinc-200 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300',
  cancelled: 'bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300',
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
