'use client'

import { useState } from 'react'
import { Trash2, Calendar, Loader2, Pencil, X, Check } from 'lucide-react'
import { Badge } from '@/components/ui/Badge'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { Input } from '@/components/ui/Input'
import { Textarea } from '@/components/ui/Textarea'
import { Button } from '@/components/ui/Button'
import { formatDateTime, isoToDatetimeLocal } from '@/lib/date-format'
import { useDeleteRundownItem, useUpdateRundownItem } from '@/hooks/useRundown'
import type { RundownItem } from '@/lib/types/database'

interface EditState {
  title: string
  description: string
  event_at: string
}

function EditForm({
  item,
  onSave,
  onCancel,
  isSaving,
}: {
  item: RundownItem
  onSave: (values: EditState) => void
  onCancel: () => void
  isSaving: boolean
}) {
  const [title, setTitle] = useState(item.title)
  const [description, setDescription] = useState(item.description ?? '')
  const [eventAt, setEventAt] = useState(isoToDatetimeLocal(item.event_at))

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!title.trim() || !eventAt) return
    onSave({ title: title.trim(), description: description.trim(), event_at: eventAt })
  }

  return (
    <form onSubmit={handleSubmit} className="rounded-xl border border-sky-300 bg-sky-50/60 p-4 shadow-xs space-y-3 dark:border-sky-700/60 dark:bg-sky-950/30">
      <div>
        <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1">Title</label>
        <Input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="e.g. Technical Meeting"
          required
        />
      </div>
      <div>
        <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1">Date / time</label>
        <Input
          type="datetime-local"
          value={eventAt}
          onChange={(e) => setEventAt(e.target.value)}
          required
        />
      </div>
      <div>
        <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1">Description (optional)</label>
        <Textarea
          rows={2}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Add any details or notes..."
        />
      </div>
      <div className="flex items-center justify-end gap-2 pt-1">
        <Button type="button" variant="secondary" size="sm" onClick={onCancel} disabled={isSaving}>
          <X className="h-3 w-3 mr-1" />
          Batal
        </Button>
        <Button type="submit" size="sm" isLoading={isSaving}>
          <Check className="h-3 w-3 mr-1" />
          {isSaving ? 'Menyimpan...' : 'Simpan'}
        </Button>
      </div>
    </form>
  )
}

export function RundownList({ items, isLoading }: { items: RundownItem[]; isLoading?: boolean }) {
  const competitionId = items[0]?.competition_id ?? ''
  const { mutate: deleteItem } = useDeleteRundownItem(competitionId)
  const { mutate: updateItem, isPending: isUpdating } = useUpdateRundownItem(competitionId)
  const [deleteTarget, setDeleteTarget] = useState<RundownItem | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)

  if (isLoading) {
    return (
      <div className="relative ml-4 border-l-2 border-sky-300 py-2 space-y-6 dark:border-sky-800 animate-pulse">
        <div className="flex items-center gap-2 text-xs font-semibold text-sky-600 dark:text-sky-400 mb-2 pl-6">
          <Loader2 className="h-4 w-4 animate-spin" />
          <span>Generating &amp; updating timeline with AI...</span>
        </div>
        {[1, 2, 3].map((i) => (
          <div key={i} className="relative pl-6 space-y-2">
            <div className="absolute -left-[9px] top-1.5 h-4 w-4 rounded-full border-2 border-sky-300 bg-white dark:border-sky-700 dark:bg-zinc-900" />
            <div className="h-5 w-36 rounded-full bg-sky-100 dark:bg-sky-950/60" />
            <div className="rounded-xl border border-zinc-200 bg-white p-4 shadow-xs dark:border-zinc-800 dark:bg-zinc-900 space-y-2">
              <div className="h-4 w-48 rounded bg-zinc-200 dark:bg-zinc-800" />
              <div className="h-3 w-3/4 rounded bg-zinc-100 dark:bg-zinc-800/60" />
            </div>
          </div>
        ))}
      </div>
    )
  }

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

            {/* Inline Edit Form */}
            {editingId === item.id ? (
              <EditForm
                item={item}
                isSaving={isUpdating}
                onCancel={() => setEditingId(null)}
                onSave={(values) => {
                  updateItem(
                    { id: item.id, values: { ...values, reminder_offsets_minutes: item.reminder_offsets_minutes ?? undefined } },
                    { onSuccess: () => setEditingId(null) }
                  )
                }}
              />
            ) : (
              /* Timeline Item Card */
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

                <div className="flex items-center gap-1 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button
                    type="button"
                    onClick={() => setEditingId(item.id)}
                    className="p-1.5 rounded-lg text-zinc-400 hover:text-sky-600 hover:bg-sky-50 dark:hover:text-sky-400 dark:hover:bg-sky-950/50 transition-colors cursor-pointer"
                    aria-label={`Edit ${item.title}`}
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setDeleteTarget(item)}
                    className="p-1.5 rounded-lg text-zinc-400 hover:text-red-600 hover:bg-red-50 dark:hover:text-red-400 dark:hover:bg-red-950/50 transition-colors cursor-pointer"
                    aria-label={`Delete ${item.title}`}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            )}
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
