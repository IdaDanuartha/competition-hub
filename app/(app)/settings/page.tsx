'use client'

import { RundownModeToggle } from '@/components/settings/RundownModeToggle'
import { WhatsAppSettingsForm } from '@/components/settings/WhatsAppSettingsForm'
import { ApiKeySettingsForm } from '@/components/settings/ApiKeySettingsForm'
import { ExportDataButton } from '@/components/settings/ExportDataButton'
import { Skeleton } from '@/components/ui/Skeleton'
import { useUserSettings, useUpdateUserSettings } from '@/hooks/useUserSettings'
import type { UserSettings } from '@/lib/types/database'

const DEFAULT_SETTINGS: UserSettings = {
  id: '',
  whatsapp_number: null,
  default_reminder_offsets_minutes: [1440, 180],
  timezone: 'Asia/Makassar',
  rundown_generation_mode: 'auto',
  theme_preference: 'light',
  gemini_api_key: null,
  openai_api_key: null,
}

export default function SettingsPage() {
  const { data: settings, isLoading } = useUserSettings()
  const { mutateAsync: update, isPending } = useUpdateUserSettings()

  if (isLoading) {
    return (
      <div className="mx-auto max-w-xl space-y-8 py-8">
        <Skeleton className="h-6 w-32" />
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-40 w-full" />
      </div>
    )
  }

  const activeSettings = settings ?? DEFAULT_SETTINGS

  return (
    <div className="mx-auto max-w-xl space-y-8 py-8">
      <h1 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">Settings</h1>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-zinc-700 dark:text-zinc-300">AI Model API Keys</h2>
        <ApiKeySettingsForm
          defaultGeminiKey={activeSettings.gemini_api_key}
          defaultGeminiKeys={activeSettings.gemini_api_keys}
          defaultOpenaiKey={activeSettings.openai_api_key}
          isLoading={isPending}
          onSubmit={(values) => update(values)}
        />

      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-zinc-700 dark:text-zinc-300">Rundown generation</h2>
        <RundownModeToggle
          mode={activeSettings.rundown_generation_mode}
          onChange={(mode) => update({ rundown_generation_mode: mode })}
        />
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-zinc-700 dark:text-zinc-300">WhatsApp reminders</h2>
        <WhatsAppSettingsForm
          defaultNumber={activeSettings.whatsapp_number ?? ''}
          defaultOffsets={activeSettings.default_reminder_offsets_minutes}
          isLoading={isPending}
          onSubmit={(values) => update(values)}
        />
      </section>

      <section className="space-y-3 border-t border-zinc-200 pt-6 dark:border-zinc-800">
        <h2 className="text-sm font-semibold text-zinc-700 dark:text-zinc-300">Data Backup &amp; Export</h2>
        <p className="text-xs text-zinc-500">
          Download a complete JSON backup of your competitions, documents metadata, AI summaries, and portfolio.
        </p>
        <ExportDataButton />
      </section>
    </div>
  )
}

