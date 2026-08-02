'use client'

import { useQuery } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'

export interface UpcomingDeadline {
  id: string
  title: string
  event_at: string
  competition_id: string
  competitions: { name: string } | null
}

export function useUpcomingDeadlines() {
  return useQuery({
    queryKey: ['upcoming-deadlines'],
    queryFn: async (): Promise<UpcomingDeadline[]> => {
      const supabase = createClient()
      const now = new Date()
      const in7Days = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000)
      const { data, error } = await supabase
        .from('rundown_items')
        .select('id, title, event_at, competition_id, competitions(name)')
        .gte('event_at', now.toISOString())
        .lte('event_at', in7Days.toISOString())
        .order('event_at', { ascending: true })
      if (error) throw error
      return data as unknown as UpcomingDeadline[]
    },
  })
}
