'use client'

import { useState, useEffect } from 'react'
import { Input } from '@/components/ui/Input'
import { Textarea } from '@/components/ui/Textarea'
import { Button } from '@/components/ui/Button'
import { competitionSchema, type CompetitionFormValues } from '@/lib/validation'
import { TAG_OPTIONS } from '@/lib/tags'
import { cn } from '@/lib/cn'

interface CompetitionFormProps {
  defaultValues?: Partial<CompetitionFormValues>
  isEditMode?: boolean
  onSubmit: (values: CompetitionFormValues) => void | Promise<void>
  submitLabel: string
  isSubmitting?: boolean
}

export function CompetitionForm({
  defaultValues,
  isEditMode: explicitIsEditMode,
  onSubmit,
  submitLabel,
  isSubmitting: externalIsSubmitting,
}: CompetitionFormProps) {
  const isEditMode = explicitIsEditMode ?? Boolean(defaultValues?.name)
  const [showMoreFields, setShowMoreFields] = useState(false)

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

  // Sync values state whenever defaultValues change from parent (e.g. after AI summary extraction)
  useEffect(() => {
    if (defaultValues) {
      setValues({
        name: defaultValues.name ?? '',
        organizer: defaultValues.organizer ?? '',
        theme: defaultValues.theme ?? '',
        team_name: defaultValues.team_name ?? '',
        team_members: defaultValues.team_members?.join(', ') ?? '',
        instagram_url: defaultValues.instagram_url ?? '',
        website_url: defaultValues.website_url ?? '',
        registration_deadline: defaultValues.registration_deadline ?? '',
        submission_deadline: defaultValues.submission_deadline ?? '',
        event_start_at: defaultValues.event_start_at ?? '',
        event_end_at: defaultValues.event_end_at ?? '',
        location: defaultValues.location ?? '',
        notes: defaultValues.notes ?? '',
      })
      if (defaultValues.tags) {
        setTags(defaultValues.tags)
      }
    }
  }, [
    defaultValues?.name,
    defaultValues?.organizer,
    defaultValues?.theme,
    defaultValues?.team_name,
    defaultValues?.registration_deadline,
    defaultValues?.submission_deadline,
    defaultValues?.event_start_at,
    defaultValues?.event_end_at,
    defaultValues?.location,
    defaultValues?.notes,
  ])

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

  const renderAllFields = isEditMode || showMoreFields

  return (
    <form onSubmit={handleSubmit} className="space-y-5 rounded-2xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-950">
      {/* 1. Name Field (Required) */}
      <div>
        <label htmlFor="name" className="mb-1 block text-sm font-medium text-zinc-900 dark:text-zinc-50">
          Competition Name <span className="text-red-500">*</span>
        </label>
        <Input
          id="name"
          value={values.name}
          onChange={(e) => set('name', e.target.value)}
          placeholder="e.g. GEMASTIK XVIII 2026"
        />
        {errors.name && <p className="mt-1 text-sm text-red-600 dark:text-red-400">{errors.name}</p>}
      </div>

      {/* 2. Team Name Field */}
      <div>
        <label htmlFor="team_name" className="mb-1 block text-sm font-medium text-zinc-900 dark:text-zinc-50">
          Team Name
        </label>
        <Input
          id="team_name"
          value={values.team_name}
          onChange={(e) => set('team_name', e.target.value)}
          placeholder="e.g. Antigravity Tech"
        />
      </div>

      {/* 3. Team Members Field */}
      <div>
        <label htmlFor="team_members" className="mb-1 block text-sm font-medium text-zinc-900 dark:text-zinc-50">
          Team Members <span className="text-xs font-normal text-zinc-400">(comma separated)</span>
        </label>
        <Input
          id="team_members"
          value={values.team_members}
          onChange={(e) => set('team_members', e.target.value)}
          placeholder="Danu, Yogi, Budi"
        />
      </div>

      {/* 4. Tags Field (Button Pills) */}
      <div>
        <span className="mb-2 block text-sm font-medium text-zinc-900 dark:text-zinc-50">
          Tags / Category
        </span>
        <div className="flex flex-wrap gap-2">
          {TAG_OPTIONS.map((tagObj) => {
            const active = tags.includes(tagObj.value)
            return (
              <button
                key={tagObj.value}
                type="button"
                onClick={() => toggleTag(tagObj.value)}
                className={cn(
                  'rounded-full border px-3 py-1.5 text-xs font-medium transition-all',
                  active
                    ? 'border-sky-600 bg-sky-600 text-white dark:border-sky-400 dark:bg-sky-400 dark:text-zinc-900'
                    : 'border-zinc-200 bg-zinc-50 text-zinc-600 hover:border-zinc-300 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-400'
                )}
              >
                {active ? '✓ ' : ''}{tagObj.label}
              </button>
            )
          })}
        </div>
      </div>

      {/* Extended Fields for Edit Mode or when toggled */}
      {renderAllFields && (
        <div className="space-y-5 pt-3 border-t border-zinc-100 dark:border-zinc-800/80 animate-in fade-in duration-200">
          <div>
            <label htmlFor="organizer" className="mb-1 block text-sm font-medium text-zinc-900 dark:text-zinc-50">
              Organizer
            </label>
            <Input
              id="organizer"
              value={values.organizer}
              onChange={(e) => set('organizer', e.target.value)}
              placeholder="e.g. Universitas Indonesia"
            />
          </div>

          <div>
            <label htmlFor="theme" className="mb-1 block text-sm font-medium text-zinc-900 dark:text-zinc-50">
              Theme / Description
            </label>
            <Input
              id="theme"
              value={values.theme}
              onChange={(e) => set('theme', e.target.value)}
              placeholder="e.g. Digital Innovation for Sustainability"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label htmlFor="instagram_url" className="mb-1 block text-sm font-medium text-zinc-900 dark:text-zinc-50">
                Instagram Link
              </label>
              <Input
                id="instagram_url"
                value={values.instagram_url}
                onChange={(e) => set('instagram_url', e.target.value)}
                placeholder="https://instagram.com/..."
              />
              {errors.instagram_url && <p className="mt-1 text-sm text-red-600 dark:text-red-400">{errors.instagram_url}</p>}
            </div>
            <div>
              <label htmlFor="website_url" className="mb-1 block text-sm font-medium text-zinc-900 dark:text-zinc-50">
                Website Link
              </label>
              <Input
                id="website_url"
                value={values.website_url}
                onChange={(e) => set('website_url', e.target.value)}
                placeholder="https://..."
              />
              {errors.website_url && <p className="mt-1 text-sm text-red-600 dark:text-red-400">{errors.website_url}</p>}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label htmlFor="registration_deadline" className="mb-1 block text-sm font-medium text-zinc-900 dark:text-zinc-50">
                Registration Deadline
              </label>
              <Input
                id="registration_deadline"
                type="datetime-local"
                value={values.registration_deadline}
                onChange={(e) => set('registration_deadline', e.target.value)}
              />
            </div>
            <div>
              <label htmlFor="submission_deadline" className="mb-1 block text-sm font-medium text-zinc-900 dark:text-zinc-50">
                Submission Deadline
              </label>
              <Input
                id="submission_deadline"
                type="datetime-local"
                value={values.submission_deadline}
                onChange={(e) => set('submission_deadline', e.target.value)}
              />
            </div>
            <div>
              <label htmlFor="event_start_at" className="mb-1 block text-sm font-medium text-zinc-900 dark:text-zinc-50">
                Event Start
              </label>
              <Input
                id="event_start_at"
                type="datetime-local"
                value={values.event_start_at}
                onChange={(e) => set('event_start_at', e.target.value)}
              />
            </div>
            <div>
              <label htmlFor="event_end_at" className="mb-1 block text-sm font-medium text-zinc-900 dark:text-zinc-50">
                Event End
              </label>
              <Input
                id="event_end_at"
                type="datetime-local"
                value={values.event_end_at}
                onChange={(e) => set('event_end_at', e.target.value)}
              />
            </div>
          </div>

          <div>
            <label htmlFor="location" className="mb-1 block text-sm font-medium text-zinc-900 dark:text-zinc-50">
              Location
            </label>
            <Input
              id="location"
              value={values.location}
              onChange={(e) => set('location', e.target.value)}
              placeholder="City, or Online"
            />
          </div>

          <div>
            <label htmlFor="notes" className="mb-1 block text-sm font-medium text-zinc-900 dark:text-zinc-50">
              Notes
            </label>
            <Textarea
              id="notes"
              rows={3}
              value={values.notes}
              onChange={(e) => set('notes', e.target.value)}
              placeholder="Catatan tambahan mengenai kompetisi..."
            />
          </div>
        </div>
      )}

      {/* Toggle additional optional fields button for New Competition mode */}
      {!isEditMode && !showMoreFields && (
        <button
          type="button"
          onClick={() => setShowMoreFields(true)}
          className="text-xs font-medium text-sky-600 hover:underline dark:text-sky-400"
        >
          + Show additional fields (deadlines, links, location...)
        </button>
      )}

      {/* Form Action Submit Button */}
      <div className="pt-2">
        <Button type="submit" isLoading={isSubmitting} className="w-full sm:w-auto">
          {isSubmitting ? 'Saving...' : submitLabel}
        </Button>
      </div>
    </form>
  )
}
