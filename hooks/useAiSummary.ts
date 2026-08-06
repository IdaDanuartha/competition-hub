'use client'

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import type { AiSummary } from '@/lib/types/database'

export function useAiSummary(competitionId: string) {
  return useQuery({
    queryKey: ['ai-summary', competitionId],
    queryFn: async (): Promise<AiSummary | null> => {
      const supabase = createClient()
      const { data, error } = await supabase
        .from('ai_summaries')
        .select('*')
        .eq('competition_id', competitionId)
        .maybeSingle()

      if (error) throw error
      return data as AiSummary | null
    },
    enabled: !!competitionId,
  })
}

export function useGenerateAiSummary() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (args: string | { competitionId: string; preferredModel?: string; replaceFields?: string[] }) => {
      const competitionId = typeof args === 'string' ? args : args.competitionId
      const preferredModel = typeof args === 'string' ? undefined : args.preferredModel
      const replaceFields = typeof args === 'string' ? undefined : args.replaceFields

      const res = await fetch('/api/generate-ai-summary', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          competition_id: competitionId,
          preferred_model: preferredModel,
          replace_fields: replaceFields,
        }),
      })

      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}))
        throw new Error(errJson.error || 'Failed to generate AI summary')
      }

      return (await res.json()) as AiSummary
    },

    onSuccess: (_, args) => {
      const competitionId = typeof args === 'string' ? args : args.competitionId
      queryClient.invalidateQueries({ queryKey: ['ai-summary', competitionId] })
      queryClient.invalidateQueries({ queryKey: ['rundown-items', competitionId] })
      queryClient.invalidateQueries({ queryKey: ['competitions', competitionId] })
      queryClient.invalidateQueries({ queryKey: ['competitions'] })
    },
  })
}
