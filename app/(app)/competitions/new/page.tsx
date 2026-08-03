'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { CompetitionForm } from '@/components/competitions/CompetitionForm'
import { useCreateCompetition } from '@/hooks/useCompetitions'
import { createClient } from '@/lib/supabase/client'
import { PREFILL_STORAGE_KEY } from '@/lib/discover'
import type { CompetitionFormValues } from '@/lib/validation'

export default function NewCompetitionPage() {
  const router = useRouter()
  const { mutateAsync } = useCreateCompetition()
  const [prefillValues, setPrefillValues] = useState<Partial<CompetitionFormValues> | undefined>(undefined)

  useEffect(() => {
    const raw = sessionStorage.getItem(PREFILL_STORAGE_KEY)
    if (raw) {
      try {
        setPrefillValues(JSON.parse(raw))
      } catch {
        // ignore malformed prefill data
      } finally {
        sessionStorage.removeItem(PREFILL_STORAGE_KEY)
      }
    }
  }, [])

  async function handleSubmit(values: CompetitionFormValues) {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const created = await mutateAsync({ ...values, user_id: user.id })
    router.push(`/competitions/${created.id}`)
  }

  return (
    <div className="mx-auto max-w-2xl py-8">
      <h1 className="mb-6 text-lg font-semibold text-zinc-900 dark:text-zinc-50">New Competition</h1>
      <CompetitionForm defaultValues={prefillValues} onSubmit={handleSubmit} submitLabel="Create competition" />
    </div>
  )
}
