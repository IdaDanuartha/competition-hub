import { statusProgress } from '@/lib/status'
import type { CompetitionStatus } from '@/lib/types/database'

export function ProgressStages({ status }: { status: CompetitionStatus }) {
  const { stage, total } = statusProgress(status)
  return (
    <div className="flex items-center gap-2">
      <div className="flex gap-0.5">
        {Array.from({ length: total }).map((_, i) => (
          <div
            key={i}
            className={
              i < stage
                ? 'h-1.5 w-4 rounded-full bg-zinc-900 dark:bg-zinc-50'
                : 'h-1.5 w-4 rounded-full bg-zinc-200 dark:bg-zinc-800'
            }
          />
        ))}
      </div>
      <span className="text-xs text-zinc-500 dark:text-zinc-400">
        {stage} of {total}
      </span>
    </div>
  )
}
