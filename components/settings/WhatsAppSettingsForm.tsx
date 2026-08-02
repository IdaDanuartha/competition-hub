'use client'

import { useState } from 'react'
import { Send, Loader2, CheckCircle2, AlertCircle } from 'lucide-react'
import { Input } from '@/components/ui/Input'
import { Button } from '@/components/ui/Button'
import { settingsSchema } from '@/lib/validation'

const OFFSET_OPTIONS = [
  { label: '15 minutes', minutes: 15 },
  { label: '1 hour', minutes: 60 },
  { label: '3 hours', minutes: 180 },
  { label: '1 day', minutes: 1440 },
  { label: '3 days', minutes: 4320 },
  { label: '1 week', minutes: 10080 },
]

interface WhatsAppSettingsFormProps {
  defaultNumber: string
  defaultOffsets: number[]
  isLoading?: boolean
  onSubmit: (values: { whatsapp_number: string; default_reminder_offsets_minutes: number[] }) => void | Promise<any>
}

export function WhatsAppSettingsForm({ defaultNumber, defaultOffsets, isLoading = false, onSubmit }: WhatsAppSettingsFormProps) {
  const [number, setNumber] = useState(defaultNumber)
  const [offsets, setOffsets] = useState<number[]>(defaultOffsets)
  const [error, setError] = useState<string | null>(null)
  const [localSubmitting, setLocalSubmitting] = useState(false)
  
  const [testLoading, setTestLoading] = useState(false)
  const [testSuccess, setTestSuccess] = useState<string | null>(null)
  const [testError, setTestError] = useState<string | null>(null)

  function toggleOffset(minutes: number) {
    setOffsets((prev) => (prev.includes(minutes) ? prev.filter((m) => m !== minutes) : [...prev, minutes]))
  }

  async function handleSubmit(e: React.FormEvent) {
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
    setLocalSubmitting(true)
    try {
      await onSubmit({ whatsapp_number: number, default_reminder_offsets_minutes: offsets })
    } finally {
      setLocalSubmitting(false)
    }
  }

  async function handleSendTest() {
    if (testLoading) return
    setTestLoading(true)
    setTestSuccess(null)
    setTestError(null)

    try {
      const res = await fetch('/api/test-wa', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ whatsapp_number: number }),
      })
      const data = await res.json()

      if (!res.ok) {
        setTestError(data.error || 'Gagal mengirim pesan uji coba.')
      } else {
        const queueId = data.fonnteResponse?.id?.[0] ? ` (Queue ID: ${data.fonnteResponse.id[0]})` : ''
        setTestSuccess(`${data.message || 'Pesan uji coba berhasil dikirim!'}${queueId}`)
      }
    } catch {
      setTestError('Terjadi kesalahan jaringan saat mencoba mengirim WA.')
    } finally {
      setTestLoading(false)
    }
  }


  const isSaving = isLoading || localSubmitting

  return (
    <form onSubmit={handleSubmit} className="space-y-5 rounded-2xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-950">
      <div>
        <label htmlFor="whatsapp-number" className="mb-1 block text-sm font-medium text-zinc-900 dark:text-zinc-50">
          WhatsApp number
        </label>
        <div className="flex flex-col sm:flex-row gap-2">
          <Input
            id="whatsapp-number"
            value={number}
            onChange={(e) => setNumber(e.target.value)}
            placeholder="62812xxxxxxx"
            className="flex-1"
          />
          <Button
            type="button"
            variant="secondary"
            onClick={handleSendTest}
            disabled={testLoading || !number}
            className="shrink-0 gap-1.5"
          >
            {testLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
            Test WA
          </Button>
        </div>
        {error && <p className="mt-1 text-sm text-red-600 dark:text-red-400">{error}</p>}
        {testSuccess && (
          <p className="mt-2 flex items-center gap-1.5 text-xs text-emerald-600 dark:text-emerald-400 font-medium">
            <CheckCircle2 className="h-3.5 w-3.5" />
            {testSuccess}
          </p>
        )}
        {testError && (
          <p className="mt-2 flex items-center gap-1.5 text-xs text-red-600 dark:text-red-400 font-medium">
            <AlertCircle className="h-3.5 w-3.5" />
            {testError}
          </p>
        )}
      </div>

      <div>
        <span className="mb-2 block text-sm font-medium text-zinc-900 dark:text-zinc-50">
          Default reminder offsets
        </span>
        <div className="flex flex-wrap gap-2">
          {OFFSET_OPTIONS.map((opt) => {
            const active = offsets.includes(opt.minutes)
            return (
              <button
                key={opt.minutes}
                type="button"
                onClick={() => toggleOffset(opt.minutes)}
                className={`rounded-lg border px-3 py-1.5 text-xs font-medium transition-all ${
                  active
                    ? 'border-emerald-600 bg-emerald-50 text-emerald-700 dark:border-emerald-500 dark:bg-emerald-950/40 dark:text-emerald-300'
                    : 'border-zinc-200 bg-zinc-50 text-zinc-600 hover:border-zinc-300 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-400'
                }`}
              >
                {active ? '✓ ' : ''}{opt.label}
              </button>
            )
          })}
        </div>
      </div>

      <div className="pt-2 border-t border-zinc-100 dark:border-zinc-800">
        <Button type="submit" size="sm" isLoading={isSaving}>
          Save WhatsApp settings
        </Button>
      </div>
    </form>
  )
}
