'use client'

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from '@/lib/toast'
import { createClient } from '@/lib/supabase/client'
import type { PortfolioEntry } from '@/lib/types/database'

export function usePortfolio() {
  return useQuery({
    queryKey: ['portfolio'],
    queryFn: async (): Promise<PortfolioEntry[]> => {
      const supabase = createClient()
      const { data, error } = await supabase
        .from('portfolio_entries')
        .select('*')
        .order('created_at', { ascending: false })

      if (error) throw error
      return data as PortfolioEntry[]
    },
  })
}

export function useCreatePortfolioEntry() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (values: Partial<PortfolioEntry>) => {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Not authenticated')

      const { data, error } = await supabase
        .from('portfolio_entries')
        .insert({ user_id: user.id, ...values, name: values.name! })
        .select()
        .single()

      if (error) throw error
      return data as PortfolioEntry
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['portfolio'] })
      toast.success(`Portofolio "${data.name}" berhasil ditambahkan!`)
    },
    onError: (err: any) => {
      toast.error(err?.message || 'Gagal menambahkan portofolio.')
    },
  })
}

export function useDeletePortfolioEntry() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const supabase = createClient()
      const { error } = await supabase.from('portfolio_entries').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['portfolio'] })
      toast.success('Portofolio berhasil dihapus!')
    },
    onError: (err: any) => {
      toast.error(err?.message || 'Gagal menghapus portofolio.')
    },
  })
}
