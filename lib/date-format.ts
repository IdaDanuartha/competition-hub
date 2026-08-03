export function formatDate(iso: string | null): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

export function formatDateTime(iso: string | null): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

export function isWithinDays(iso: string | null, days: number): boolean {
  if (!iso) return false
  const target = new Date(iso).getTime()
  const now = Date.now()
  const windowMs = days * 24 * 60 * 60 * 1000
  return target >= now && target - now <= windowMs
}

/**
 * Converts a UTC ISO string (from DB) to a datetime-local input value
 * in the user's local timezone, e.g. "2026-08-08T23:59".
 * Used to pre-fill edit forms correctly.
 */
export function isoToDatetimeLocal(iso: string | null): string {
  if (!iso) return ''
  const d = new Date(iso)
  const pad = (n: number) => String(n).padStart(2, '0')
  return (
    `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}` +
    `T${pad(d.getHours())}:${pad(d.getMinutes())}`
  )
}
