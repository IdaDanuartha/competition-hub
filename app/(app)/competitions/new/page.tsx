'use client'

import { useRouter } from 'next/navigation'
import { CompetitionForm } from '@/components/competitions/CompetitionForm'
import { useCreateCompetition } from '@/hooks/useCompetitions'
import { createClient } from '@/lib/supabase/client'
import type { CompetitionFormValues } from '@/lib/validation'

export default function NewCompetitionPage() {
  const router = useRouter()
  const { mutateAsync } = useCreateCompetition()

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
      <CompetitionForm onSubmit={handleSubmit} submitLabel="Create competition" />
    </div>
  )
}
