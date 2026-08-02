'use client'

import { cn } from '@/lib/cn'
import type { RundownGenerationMode } from '@/lib/types/database'

interface RundownModeToggleProps {
  mode: RundownGenerationMode
  onChange: (mode: RundownGenerationMode) => void
}

export function RundownModeToggle({ mode, onChange }: RundownModeToggleProps) {
  const isAuto = mode === 'auto'
  return (
    <div className="flex items-center gap-3">
      <button
        type="button"
        role="switch"
        aria-checked={isAuto}
        aria-label="Auto-generate rundown items from deadlines"
        onClick={() => onChange(isAuto ? 'manual' : 'auto')}
        className={cn(
          'relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full p-0.5 transition-colors focus:outline-hidden',
          isAuto ? 'bg-zinc-900 dark:bg-zinc-100' : 'bg-zinc-300 dark:bg-zinc-700'
        )}
      >
        <span
          className={cn(
            'pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow-xs transition-transform dark:bg-zinc-900',
            isAuto ? 'translate-x-5' : 'translate-x-0'
          )}
        />
      </button>
      <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300 select-none">
        Auto-generate rundown items from deadlines ({isAuto ? 'Auto' : 'Manual'})
      </span>
    </div>
  )
}
