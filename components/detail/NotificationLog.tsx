import { Badge } from '@/components/ui/Badge'
import { formatDateTime } from '@/lib/date-format'
import type { NotificationLog as NotificationLogType } from '@/lib/types/database'

export function NotificationLog({ logs }: { logs: NotificationLogType[] }) {
  if (logs.length === 0) {
    return <p className="text-sm text-zinc-500 dark:text-zinc-400">No notifications sent yet.</p>
  }

  return (
    <ul className="space-y-2">
      {logs.map((log) => (
        <li key={log.id} className="flex items-center justify-between text-sm">
          <span className="text-zinc-700 dark:text-zinc-300">{log.message}</span>
          <div className="flex items-center gap-2">
            <span className="text-xs text-zinc-400">{formatDateTime(log.sent_at)}</span>
            <Badge
              className={
                log.status === 'sent'
                  ? 'bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-300'
                  : 'bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300'
              }
            >
              {log.status}
            </Badge>
          </div>
        </li>
      ))}
    </ul>
  )
}
