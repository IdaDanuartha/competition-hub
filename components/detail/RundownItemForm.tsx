'use client'

import { useState } from 'react'
import { Input } from '@/components/ui/Input'
import { Textarea } from '@/components/ui/Textarea'
import { Button } from '@/components/ui/Button'
import { rundownItemSchema, type RundownItemFormValues } from '@/lib/validation'

interface RundownItemFormProps {
  onSubmit: (values: RundownItemFormValues) => void | Promise<void>
  onCancel?: () => void
}

export function RundownItemForm({ onSubmit, onCancel }: RundownItemFormProps) {
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [eventAt, setEventAt] = useState('')
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [isSubmitting, setIsSubmitting] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (isSubmitting) return

    const result = rundownItemSchema.safeParse({ title, description, event_at: eventAt })
    if (!result.success) {
      const fieldErrors: Record<string, string> = {}
      for (const issue of result.error.issues) fieldErrors[String(issue.path[0])] = issue.message
      setErrors(fieldErrors)
      return
    }
    setErrors({})
    try {
      setIsSubmitting(true)
      await onSubmit(result.data)
      setTitle('')
      setDescription('')
      setEventAt('')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label htmlFor="rundown-title" className="mb-1 block text-sm font-medium">Title</label>
        <Input id="rundown-title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Technical Meeting" />
        {errors.title && <p className="mt-1 text-sm text-red-600">{errors.title}</p>}
      </div>
      <div>
        <label htmlFor="rundown-date" className="mb-1 block text-sm font-medium">Date / time</label>
        <Input id="rundown-date" type="datetime-local" value={eventAt} onChange={(e) => setEventAt(e.target.value)} />
        {errors.event_at && <p className="mt-1 text-sm text-red-600">{errors.event_at}</p>}
      </div>
      <div>
        <label htmlFor="rundown-description" className="mb-1 block text-sm font-medium">Description (optional)</label>
        <Textarea id="rundown-description" rows={3} value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Add any details or notes..." />
      </div>
      <div className="flex items-center justify-end gap-2 pt-2 border-t border-zinc-100 dark:border-zinc-800">
        {onCancel && (
          <Button type="button" variant="secondary" size="sm" onClick={onCancel} disabled={isSubmitting}>
            Cancel
          </Button>
        )}
        <Button type="submit" size="sm" isLoading={isSubmitting}>
          {isSubmitting ? 'Adding...' : 'Add rundown item'}
        </Button>
      </div>
    </form>
  )
}
