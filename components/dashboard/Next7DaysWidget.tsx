'use client'

import Link from 'next/link'
import { Card } from '@/components/ui/Card'
import { Skeleton } from '@/components/ui/Skeleton'
import { formatDateTime } from '@/lib/date-format'
import { useUpcomingDeadlines } from '@/hooks/useUpcomingDeadlines'

export function Next7DaysWidget() {
  const { data: items, isLoading } = useUpcomingDeadlines()

  return (
    <Card className="p-4">
      <h2 className="mb-3 text-sm font-semibold text-zinc-700 dark:text-zinc-300">Next 7 Days</h2>
      {isLoading && (
        <div className="space-y-2">
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-2/3" />
        </div>
      )}
      {!isLoading && (!items || items.length === 0) && (
        <p className="text-sm text-zinc-500 dark:text-zinc-400">Nothing due in the next 7 days.</p>
      )}
      {!isLoading && items && items.length > 0 && (
        <ul className="space-y-2">
          {items.map((item) => (
            <li key={item.id} className="flex items-center justify-between text-sm">
              <div>
                <span className="text-zinc-900 dark:text-zinc-50">{item.title}</span>
                {item.competitions && (
                  <>
                    {' — '}
                    <Link href={`/competitions/${item.competition_id}`} className="text-zinc-500 hover:underline dark:text-zinc-400">
                      {item.competitions.name}
                    </Link>
                  </>
                )}
              </div>
              <span className="shrink-0 text-zinc-400">{formatDateTime(item.event_at)}</span>
            </li>
          ))}
        </ul>
      )}
    </Card>
  )
}
