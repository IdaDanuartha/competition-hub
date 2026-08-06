'use client'

import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from '@/lib/toast'
import { createClient } from '@/lib/supabase/client'
import type { Competition } from '@/lib/types/database'

export function useDuplicateCompetition() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (source: Competition): Promise<Competition> => {
      const supabase = createClient()
      const { data, error } = await supabase
        .from('competitions')
        .insert({
          user_id: source.user_id,
          name: `${source.name} — Copy`,
          organizer: source.organizer,
          theme: source.theme,
          team_name: source.team_name,
          tags: source.tags,
          notes: source.notes,
          cloned_from_id: source.id,
          status: 'researching',
        })
        .select()
        .single()
      if (error) throw error
      return data as Competition
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['competitions'] })
      toast.success(`Berhasil menduplikasi ke "${data.name}"!`)
    },
    onError: (err: any) => {
      toast.error(err?.message || 'Gagal menduplikasi kompetisi.')
    },
  })
}

