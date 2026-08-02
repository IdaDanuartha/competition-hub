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
