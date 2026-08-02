'use client'

import { useState } from 'react'
import { Input } from '@/components/ui/Input'
import { Textarea } from '@/components/ui/Textarea'
import { Button } from '@/components/ui/Button'
import type { PortfolioEntry } from '@/lib/types/database'

interface PortfolioFormProps {
  initialValues?: Partial<PortfolioEntry>
  onSubmit: (values: Partial<PortfolioEntry>) => void | Promise<void>
  onCancel?: () => void
}

export function PortfolioForm({ initialValues, onSubmit, onCancel }: PortfolioFormProps) {
  const [name, setName] = useState(initialValues?.name ?? '')
  const [description, setDescription] = useState(initialValues?.description ?? '')
  const [tags, setTags] = useState(initialValues?.tags?.join(', ') ?? '')
  const [techStack, setTechStack] = useState(initialValues?.tech_stack?.join(', ') ?? '')
  const [usedIn, setUsedIn] = useState(initialValues?.used_in_competitions?.join(', ') ?? '')
  const [error, setError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (isSubmitting) return

    if (!name.trim()) {
      setError('Project name is required')
      return
    }
    setError(null)
    try {
      setIsSubmitting(true)
      await onSubmit({
        name: name.trim(),
        description: description.trim() || null,
        tags: tags.split(',').map((t) => t.trim()).filter(Boolean),
        tech_stack: techStack.split(',').map((t) => t.trim()).filter(Boolean),
        used_in_competitions: usedIn.split(',').map((t) => t.trim()).filter(Boolean),
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4 rounded-lg border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
      <h3 className="font-semibold text-zinc-900 dark:text-zinc-50">
        {initialValues?.id ? 'Edit Project Entry' : 'New Project Entry'}
      </h3>
      <div>
        <label htmlFor="portfolio-name" className="mb-1 block text-sm font-medium">Project Name *</label>
        <Input id="portfolio-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g., WasteWise App" />
        {error && <p className="mt-1 text-sm text-red-600">{error}</p>}
      </div>
      <div>
        <label htmlFor="portfolio-desc" className="mb-1 block text-sm font-medium">Description</label>
        <Textarea id="portfolio-desc" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Brief summary of what this project does" />
      </div>
      <div>
        <label htmlFor="portfolio-tags" className="mb-1 block text-sm font-medium">Theme Tags (comma separated)</label>
        <Input id="portfolio-tags" value={tags} onChange={(e) => setTags(e.target.value)} placeholder="AI, Sustainability, Mobile App" />
      </div>
      <div>
        <label htmlFor="portfolio-tech" className="mb-1 block text-sm font-medium">Tech Stack (comma separated)</label>
        <Input id="portfolio-tech" value={techStack} onChange={(e) => setTechStack(e.target.value)} placeholder="Next.js, Python, Supabase" />
      </div>
      <div>
        <label htmlFor="portfolio-used" className="mb-1 block text-sm font-medium">Used in Competitions (comma separated)</label>
        <Input id="portfolio-used" value={usedIn} onChange={(e) => setUsedIn(e.target.value)} placeholder="BYTESFEST 2025, Hackalab" />
      </div>
      <div className="flex items-center justify-end gap-2 pt-2">
        {onCancel && (
          <Button type="button" variant="ghost" size="sm" onClick={onCancel} disabled={isSubmitting}>
            Cancel
          </Button>
        )}
        <Button type="submit" size="sm" isLoading={isSubmitting}>
          {isSubmitting ? 'Saving...' : 'Save Entry'}
        </Button>
      </div>
    </form>
  )
}
