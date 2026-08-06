'use client'

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { createClient } from '@/lib/supabase/client'
import type { Competition, CompetitionDocument } from '@/lib/types/database'
import type { CompetitionFormValues } from '@/lib/validation'

export function useCompetitionDetail(id: string) {
  return useQuery({
    queryKey: ['competitions', id],
    queryFn: async (): Promise<Competition> => {
      const supabase = createClient()
      const { data, error } = await supabase.from('competitions').select('*').eq('id', id).single()
      if (error) throw error
      return data as Competition
    },
    enabled: Boolean(id),
  })
}

export function useCompetitionDocuments(competitionId: string) {
  return useQuery({
    queryKey: ['competition-documents', competitionId],
    queryFn: async (): Promise<CompetitionDocument[]> => {
      const supabase = createClient()
      const { data, error } = await supabase
        .from('competition_documents')
        .select('*')
        .eq('competition_id', competitionId)
        .order('uploaded_at', { ascending: false })
      if (error) throw error
      return (data ?? []) as CompetitionDocument[]
    },
    enabled: Boolean(competitionId),
  })
}

export function useUpdateCompetition(id: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (values: CompetitionFormValues) => {
      const supabase = createClient()
      const { data, error } = await supabase.from('competitions').update(values).eq('id', id).select().single()
      if (error) throw error
      return data as Competition
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['competitions', id] })
      queryClient.invalidateQueries({ queryKey: ['competitions'] })
      queryClient.invalidateQueries({ queryKey: ['rundown-items', id] })
      toast.success('Detail kompetisi berhasil diperbarui!')
    },
    onError: (err: any) => {
      toast.error(err?.message || 'Gagal memperbarui detail kompetisi.')
    },
  })
}

export function useDeleteDocument(competitionId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const supabase = createClient()
      const { error } = await supabase.from('competition_documents').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['competition-documents', competitionId] })
      toast.success('Dokumen berhasil dihapus!')
    },
    onError: (err: any) => {
      toast.error(err?.message || 'Gagal menghapus dokumen.')
    },
  })
}

