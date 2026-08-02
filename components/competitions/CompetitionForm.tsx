'use client'

import { useState } from 'react'
import { Input } from '@/components/ui/Input'
import { Textarea } from '@/components/ui/Textarea'
import { Button } from '@/components/ui/Button'
import { competitionSchema, type CompetitionFormValues } from '@/lib/validation'
import { TAG_OPTIONS } from '@/lib/tags'

interface CompetitionFormProps {
  defaultValues?: Partial<CompetitionFormValues>
  onSubmit: (values: CompetitionFormValues) => void | Promise<void>
  submitLabel: string
  isSubmitting?: boolean
}

export function CompetitionForm({ defaultValues, onSubmit, submitLabel, isSubmitting: externalIsSubmitting }: CompetitionFormProps) {
  const [values, setValues] = useState<Record<string, string>>({
    name: defaultValues?.name ?? '',
    organizer: defaultValues?.organizer ?? '',
    theme: defaultValues?.theme ?? '',
    team_name: defaultValues?.team_name ?? '',
    team_members: defaultValues?.team_members?.join(', ') ?? '',
    instagram_url: defaultValues?.instagram_url ?? '',
    website_url: defaultValues?.website_url ?? '',
    registration_deadline: defaultValues?.registration_deadline ?? '',
    submission_deadline: defaultValues?.submission_deadline ?? '',
    event_start_at: defaultValues?.event_start_at ?? '',
    event_end_at: defaultValues?.event_end_at ?? '',
    location: defaultValues?.location ?? '',
    notes: defaultValues?.notes ?? '',
  })
  const [tags, setTags] = useState<string[]>(defaultValues?.tags ?? [])
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [internalIsSubmitting, setInternalIsSubmitting] = useState(false)

  const isSubmitting = externalIsSubmitting || internalIsSubmitting

  function set(field: string, value: string) {
    setValues((prev) => ({ ...prev, [field]: value }))
  }

  function toggleTag(tagValue: string) {
    setTags((prev) => (prev.includes(tagValue) ? prev.filter((t) => t !== tagValue) : [...prev, tagValue]))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (isSubmitting) return

    const teamMembersArray = values.team_members
      ? values.team_members.split(',').map((m) => m.trim()).filter(Boolean)
      : []

    const result = competitionSchema.safeParse({
      ...values,
      tags,
      team_members: teamMembersArray,
    })
    if (!result.success) {
      const fieldErrors: Record<string, string> = {}
      for (const issue of result.error.issues) {
        if (issue.path[0]) {
          fieldErrors[issue.path[0].toString()] = issue.message
        }
      }
      setErrors(fieldErrors)
      return
    }
    setErrors({})
    try {
      setInternalIsSubmitting(true)
      await onSubmit(result.data)
    } finally {
      setInternalIsSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label htmlFor="name" className="mb-1 block text-sm font-medium">Name</label>
        <Input id="name" value={values.name} onChange={(e) => set('name', e.target.value)} />
        {errors.name && <p className="mt-1 text-sm text-red-600">{errors.name}</p>}
      </div>
      <div>
        <label htmlFor="organizer" className="mb-1 block text-sm font-medium">Organizer</label>
        <Input id="organizer" value={values.organizer} onChange={(e) => set('organizer', e.target.value)} />
      </div>
      <div>
        <label htmlFor="theme" className="mb-1 block text-sm font-medium">Theme / category</label>
        <Input id="theme" value={values.theme} onChange={(e) => set('theme', e.target.value)} />
      </div>
      <div>
        <label htmlFor="team_name" className="mb-1 block text-sm font-medium">Team name</label>
        <Input id="team_name" value={values.team_name} onChange={(e) => set('team_name', e.target.value)} />
      </div>
      <div>
        <label htmlFor="team_members" className="mb-1 block text-sm font-medium">Team members (comma separated)</label>
        <Input id="team_members" value={values.team_members} onChange={(e) => set('team_members', e.target.value)} placeholder="Danu, I Ketut Yogi" />
      </div>
      <div>
        <span className="mb-1 block text-sm font-medium">Tags</span>
        <div className="flex flex-wrap gap-3">
          {TAG_OPTIONS.map((tagObj) => (
            <label key={tagObj.value} className="flex items-center gap-1.5 text-sm cursor-pointer">
              <input type="checkbox" checked={tags.includes(tagObj.value)} onChange={() => toggleTag(tagObj.value)} />
              {tagObj.label}
            </label>
          ))}
        </div>
      </div>
      <div>
        <label htmlFor="instagram_url" className="mb-1 block text-sm font-medium">Instagram link</label>
        <Input id="instagram_url" value={values.instagram_url} onChange={(e) => set('instagram_url', e.target.value)} />
        {errors.instagram_url && <p className="mt-1 text-sm text-red-600">{errors.instagram_url}</p>}
      </div>
      <div>
        <label htmlFor="website_url" className="mb-1 block text-sm font-medium">Website link</label>
        <Input id="website_url" value={values.website_url} onChange={(e) => set('website_url', e.target.value)} />
        {errors.website_url && <p className="mt-1 text-sm text-red-600">{errors.website_url}</p>}
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label htmlFor="registration_deadline" className="mb-1 block text-sm font-medium">Registration deadline</label>
          <Input id="registration_deadline" type="datetime-local" value={values.registration_deadline} onChange={(e) => set('registration_deadline', e.target.value)} />
        </div>
        <div>
          <label htmlFor="submission_deadline" className="mb-1 block text-sm font-medium">Submission deadline</label>
          <Input id="submission_deadline" type="datetime-local" value={values.submission_deadline} onChange={(e) => set('submission_deadline', e.target.value)} />
        </div>
        <div>
          <label htmlFor="event_start_at" className="mb-1 block text-sm font-medium">Event start</label>
          <Input id="event_start_at" type="datetime-local" value={values.event_start_at} onChange={(e) => set('event_start_at', e.target.value)} />
        </div>
        <div>
          <label htmlFor="event_end_at" className="mb-1 block text-sm font-medium">Event end</label>
          <Input id="event_end_at" type="datetime-local" value={values.event_end_at} onChange={(e) => set('event_end_at', e.target.value)} />
        </div>
      </div>
      <div>
        <label htmlFor="location" className="mb-1 block text-sm font-medium">Location</label>
        <Input id="location" value={values.location} onChange={(e) => set('location', e.target.value)} placeholder="City, or Online" />
      </div>
      <div>
        <label htmlFor="notes" className="mb-1 block text-sm font-medium">Notes</label>
        <Textarea id="notes" rows={4} value={values.notes} onChange={(e) => set('notes', e.target.value)} />
      </div>
      <Button type="submit" isLoading={isSubmitting}>
        {isSubmitting ? 'Saving...' : submitLabel}
      </Button>
    </form>
  )
}
