'use client'

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { createClient } from '@/lib/supabase/client'
import type { UserSettings } from '@/lib/types/database'

export function useUserSettings() {
  return useQuery({
    queryKey: ['user-settings'],
    queryFn: async (): Promise<UserSettings | null> => {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return null
      const { data, error } = await supabase.from('user_settings').select('*').eq('id', user.id).maybeSingle()
      if (error) throw error
      return data as UserSettings | null
    },
    retry: false,
  })
}

export function useUpdateUserSettings() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (values: Partial<UserSettings>) => {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return null
      const { data, error } = await supabase
        .from('user_settings')
        .upsert({ id: user.id, ...values })
        .select()
        .single()
      if (error) throw error
      return data as UserSettings
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['user-settings'] })
      queryClient.invalidateQueries({ queryKey: ['rundown-items'] })
      toast.success('Pengaturan pengguna berhasil disimpan!')
    },
    onError: (err: any) => {
      toast.error(err?.message || 'Gagal menyimpan pengaturan pengguna.')
    },
  })
}
