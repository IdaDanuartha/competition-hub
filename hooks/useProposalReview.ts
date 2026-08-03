'use client'

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import type { ProposalReview } from '@/lib/types/database'

export function useProposalReviews(competitionId: string) {
  return useQuery({
    queryKey: ['proposal-reviews', competitionId],
    queryFn: async (): Promise<ProposalReview[]> => {
      const supabase = createClient()
      const { data, error } = await (supabase as any)
        .from('proposal_reviews')
        .select('*')
        .eq('competition_id', competitionId)
        .order('created_at', { ascending: false })

      if (error) throw error
      return (data || []) as ProposalReview[]
    },
    enabled: !!competitionId,
  })
}

export function useReviewProposal() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({
      competitionId,
      file,
      preferredModel,
    }: {
      competitionId: string
      file: File
      preferredModel?: string
    }): Promise<ProposalReview> => {
      const formData = new FormData()
      formData.append('file', file)
      formData.append('competition_id', competitionId)
      if (preferredModel) {
        formData.append('preferred_model', preferredModel)
      }

      const res = await fetch('/api/review-proposal', {
        method: 'POST',
        body: formData,
      })

      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}))
        throw new Error(errJson.error || 'Gagal mengevaluasi draf proposal.')
      }

      return (await res.json()) as ProposalReview
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['proposal-reviews', variables.competitionId] })
    },
  })
}
