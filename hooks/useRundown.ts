'use client'

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { createClient } from '@/lib/supabase/client'
import type { NotificationLog, RundownItem } from '@/lib/types/database'
import type { RundownItemFormValues } from '@/lib/validation'

export function useRundownItems(competitionId: string) {
  return useQuery({
    queryKey: ['rundown-items', competitionId],
    queryFn: async (): Promise<RundownItem[]> => {
      const supabase = createClient()
      const { data, error } = await supabase
        .from('rundown_items')
        .select('*')
        .eq('competition_id', competitionId)
        .order('event_at', { ascending: true })
      if (error) throw error
      return data as RundownItem[]
    },
    enabled: Boolean(competitionId),
  })
}

export function useCreateRundownItem(competitionId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (values: RundownItemFormValues) => {
      const supabase = createClient()
      const eventAtIso = values.event_at
        ? new Date(values.event_at).toISOString()
        : values.event_at
      const { error } = await supabase
        .from('rundown_items')
        .insert({ ...values, event_at: eventAtIso, competition_id: competitionId })
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['rundown-items', competitionId] })
      toast.success('Agenda lomba berhasil ditambahkan!')
    },
    onError: (err: any) => {
      toast.error(err?.message || 'Gagal menambahkan agenda.')
    },
  })
}

export function useUpdateRundownItem(competitionId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, values }: { id: string; values: RundownItemFormValues }) => {
      const supabase = createClient()
      const eventAtIso = values.event_at
        ? new Date(values.event_at).toISOString()
        : values.event_at
      const { error } = await supabase
        .from('rundown_items')
        .update({ title: values.title, description: values.description, event_at: eventAtIso })
        .eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['rundown-items', competitionId] })
      queryClient.invalidateQueries({ queryKey: ['next-rundown-dates'] })
      toast.success('Agenda lomba berhasil diperbarui!')
    },
    onError: (err: any) => {
      toast.error(err?.message || 'Gagal memperbarui agenda.')
    },
  })
}

export function useDeleteRundownItem(competitionId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const supabase = createClient()
      const { error } = await supabase.from('rundown_items').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['rundown-items', competitionId] })
      toast.success('Agenda lomba berhasil dihapus!')
    },
    onError: (err: any) => {
      toast.error(err?.message || 'Gagal menghapus agenda.')
    },
  })
}

export function useNotificationLogs(rundownItemIds: string[]) {
  return useQuery({
    queryKey: ['notification-logs', rundownItemIds],
    queryFn: async (): Promise<NotificationLog[]> => {
      if (rundownItemIds.length === 0) return []
      const supabase = createClient()
      const { data, error } = await supabase
        .from('notification_logs')
        .select('*')
        .in('rundown_item_id', rundownItemIds)
        .order('sent_at', { ascending: false })
      if (error) throw error
      return data as NotificationLog[]
    },
    enabled: rundownItemIds.length > 0,
  })
}
