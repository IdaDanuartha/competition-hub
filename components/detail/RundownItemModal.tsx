'use client'

import { X } from 'lucide-react'
import { RundownItemForm } from '@/components/detail/RundownItemForm'
import type { RundownItemFormValues } from '@/lib/validation'

interface RundownItemModalProps {
  isOpen: boolean
  onClose: () => void
  onSubmit: (values: RundownItemFormValues) => void | Promise<void>
}

export function RundownItemModal({ isOpen, onClose, onSubmit }: RundownItemModalProps) {
  if (!isOpen) return null

  async function handleSubmit(values: RundownItemFormValues) {
    await onSubmit(values)
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-zinc-950/50 backdrop-blur-xs transition-opacity"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Modal Content */}
      <div className="relative z-10 w-full max-w-md rounded-xl border border-zinc-200 bg-white p-6 shadow-xl dark:border-zinc-800 dark:bg-zinc-900">
        <div className="flex items-center justify-between border-b border-zinc-200 pb-3 dark:border-zinc-800">
          <h3 className="font-semibold text-zinc-900 dark:text-zinc-50">Add Rundown Item</h3>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-600 dark:hover:bg-zinc-800 dark:hover:text-zinc-300"
            aria-label="Close modal"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="pt-4">
          <RundownItemForm onSubmit={handleSubmit} onCancel={onClose} />
        </div>
      </div>
    </div>
  )
}
