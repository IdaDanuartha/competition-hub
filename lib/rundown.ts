import type { Competition } from '@/lib/types/database'

export interface DeadlineOverlap {
  competitionIds: string[]
  competitionNames: string[]
  dates: string[]
}

const ACTIVE_STATUSES = new Set(['researching', 'registered', 'in_progress', 'submitted', 'finalist'])
const OVERLAP_WINDOW_DAYS = 3

function deadlinesOf(c: Competition): { label: 'registration' | 'submission'; date: string }[] {
  const out: { label: 'registration' | 'submission'; date: string }[] = []
  if (c.registration_deadline) out.push({ label: 'registration', date: c.registration_deadline })
  if (c.submission_deadline) out.push({ label: 'submission', date: c.submission_deadline })
  return out
}

export function detectDeadlineOverlaps(competitions: Competition[]): DeadlineOverlap[] {
  const active = competitions.filter((c) => ACTIVE_STATUSES.has(c.status))
  const windowMs = OVERLAP_WINDOW_DAYS * 24 * 60 * 60 * 1000
  const overlaps: DeadlineOverlap[] = []
  const seenPairs = new Set<string>()

  for (let i = 0; i < active.length; i++) {
    for (let j = i + 1; j < active.length; j++) {
      const a = active[i]
      const b = active[j]
      for (const da of deadlinesOf(a)) {
        for (const db of deadlinesOf(b)) {
          const diff = Math.abs(new Date(da.date).getTime() - new Date(db.date).getTime())
          if (diff <= windowMs) {
            const pairKey = [a.id, b.id].sort().join(':')
            if (!seenPairs.has(pairKey)) {
              seenPairs.add(pairKey)
              overlaps.push({
                competitionIds: [a.id, b.id],
                competitionNames: [a.name, b.name],
                dates: [da.date, db.date],
              })
            }
          }
        }
      }
    }
  }

  return overlaps
}
