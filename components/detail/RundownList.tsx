'use client'

import { useState } from 'react'
import { Trash2, Calendar } from 'lucide-react'
import { Badge } from '@/components/ui/Badge'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { formatDateTime } from '@/lib/date-format'
import { useDeleteRundownItem } from '@/hooks/useRundown'
import type { RundownItem } from '@/lib/types/database'

export function RundownList({ items }: { items: RundownItem[] }) {
  const competitionId = items[0]?.competition_id ?? ''
  const { mutate: deleteItem } = useDeleteRundownItem(competitionId)
  const [deleteTarget, setDeleteTarget] = useState<RundownItem | null>(null)

  if (items.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-zinc-300 p-8 text-center dark:border-zinc-700">
        <Calendar className="mx-auto h-8 w-8 text-zinc-400 dark:text-zinc-500" />
        <p className="mt-2 text-sm font-medium text-zinc-600 dark:text-zinc-400">No rundown items yet.</p>
        <p className="text-xs text-zinc-400 dark:text-zinc-500">
          Upload a guidebook or add items manually to build your timeline.
        </p>
      </div>
    )
  }

  return (
    <>
      <div className="relative ml-4 border-l-2 border-sky-400 py-2 space-y-6 dark:border-sky-600">
        {items.map((item) => (
          <div key={item.id} className="relative pl-6">
            {/* Timeline Node Dot */}
            <div className="absolute -left-[9px] top-1.5 h-4 w-4 rounded-full border-2 border-sky-500 bg-white shadow-xs ring-4 ring-sky-100 dark:border-sky-400 dark:bg-zinc-900 dark:ring-sky-950/80" />

            {/* Date Badge above card */}
            <div className="mb-2 inline-flex items-center gap-1.5 rounded-full border border-sky-200 bg-sky-50/80 px-3 py-0.5 text-xs font-semibold text-sky-700 dark:border-sky-900/60 dark:bg-sky-950/60 dark:text-sky-300">
              <Calendar className="h-3 w-3" />
              <span>{formatDateTime(item.event_at)}</span>
            </div>

            {/* Timeline Item Card */}
            <div className="group relative flex items-start justify-between rounded-xl border border-zinc-200 bg-white p-4 shadow-xs transition-shadow hover:shadow-md dark:border-zinc-800 dark:bg-zinc-900">
              <div className="space-y-1 pr-4">
                <div className="flex items-center gap-2 flex-wrap">
                  <h4 className="font-semibold text-zinc-900 dark:text-zinc-50">{item.title}</h4>
                  {item.is_auto_generated && (
                    <Badge className="bg-sky-100 text-sky-700 dark:bg-sky-950 dark:text-sky-300 border-0 text-[11px]">
                      Auto
                    </Badge>
                  )}
                </div>
                {item.description && (
                  <p className="text-xs leading-relaxed text-zinc-600 dark:text-zinc-400 whitespace-pre-wrap">
                    {item.description}
                  </p>
                )}
              </div>

              <button
                type="button"
                onClick={() => setDeleteTarget(item)}
                className="shrink-0 text-zinc-400 opacity-80 hover:text-red-600 transition-opacity group-hover:opacity-100 dark:hover:text-red-400"
                aria-label={`Delete ${item.title}`}
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          </div>
        ))}
      </div>

      <ConfirmDialog
        isOpen={Boolean(deleteTarget)}
        title="Delete Rundown Item"
        description={`Are you sure you want to delete "${deleteTarget?.title}"?`}
        confirmLabel="Delete Item"
        onConfirm={() => {
          if (deleteTarget) {
            deleteItem(deleteTarget.id)
            setDeleteTarget(null)
          }
        }}
        onClose={() => setDeleteTarget(null)}
      />
    </>
  )
}
