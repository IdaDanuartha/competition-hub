'use client'

import { useState } from 'react'
import { Input } from '@/components/ui/Input'
import { Button } from '@/components/ui/Button'
import { settingsSchema } from '@/lib/validation'

const OFFSET_OPTIONS = [
  { label: '15 minutes', minutes: 15 },
  { label: '1 hour', minutes: 60 },
  { label: '3 hours', minutes: 180 },
  { label: '1 day', minutes: 1440 },
]

interface WhatsAppSettingsFormProps {
  defaultNumber: string
  defaultOffsets: number[]
  onSubmit: (values: { whatsapp_number: string; default_reminder_offsets_minutes: number[] }) => void
}

export function WhatsAppSettingsForm({ defaultNumber, defaultOffsets, onSubmit }: WhatsAppSettingsFormProps) {
  const [number, setNumber] = useState(defaultNumber)
  const [offsets, setOffsets] = useState<number[]>(defaultOffsets)
  const [error, setError] = useState<string | null>(null)

  function toggleOffset(minutes: number) {
    setOffsets((prev) => (prev.includes(minutes) ? prev.filter((m) => m !== minutes) : [...prev, minutes]))
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const result = settingsSchema.safeParse({
      whatsapp_number: number,
      default_reminder_offsets_minutes: offsets,
      rundown_generation_mode: 'auto',
    })
    if (!result.success) {
      setError(result.error.issues.find((i) => i.path[0] === 'whatsapp_number')?.message ?? 'Invalid settings')
      return
    }
    setError(null)
    onSubmit({ whatsapp_number: number, default_reminder_offsets_minutes: offsets })
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label htmlFor="whatsapp-number" className="mb-1 block text-sm font-medium">WhatsApp number</label>
        <Input
          id="whatsapp-number"
          value={number}
          onChange={(e) => setNumber(e.target.value)}
          placeholder="62812xxxxxxx"
        />
        {error && <p className="mt-1 text-sm text-red-600">{error}</p>}
      </div>
      <div>
        <span className="mb-1 block text-sm font-medium">Default reminder offsets</span>
        <div className="flex flex-wrap gap-3">
          {OFFSET_OPTIONS.map((opt) => (
            <label key={opt.minutes} className="flex items-center gap-1.5 text-sm">
              <input type="checkbox" checked={offsets.includes(opt.minutes)} onChange={() => toggleOffset(opt.minutes)} />
              {opt.label}
            </label>
          ))}
        </div>
      </div>
      <Button type="submit" size="sm">Save WhatsApp settings</Button>
    </form>
  )
}
