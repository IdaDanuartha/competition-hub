// hooks/useCompetitions.ts
'use client'

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import type { Competition, CompetitionStatus } from '@/lib/types/database'
import type { CompetitionFormValues } from '@/lib/validation'

export function useCompetitions() {
  return useQuery({
    queryKey: ['competitions'],
    queryFn: async (): Promise<Competition[]> => {
      const supabase = createClient()
      const { data, error } = await supabase
        .from('competitions')
        .select('*')
        .order('created_at', { ascending: false })
      if (error) throw error
      return data as Competition[]
    },
  })
}

export function useCreateCompetition() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (values: CompetitionFormValues & { user_id: string }) => {
      const supabase = createClient()
      const { data, error } = await supabase
        .from('competitions')
        .insert(values)
        .select()
        .single()
      if (error) throw error
      return data as Competition
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['competitions'] })
    },
  })
}

export function useUpdateCompetitionStatus() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, status }: { id: string; status: CompetitionStatus }) => {
      const supabase = createClient()
      const { error } = await supabase.from('competitions').update({ status }).eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['competitions'] })
    },
  })
}

export function useDeleteCompetition() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const supabase = createClient()
      const { error } = await supabase.from('competitions').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['competitions'] })
    },
  })
}
