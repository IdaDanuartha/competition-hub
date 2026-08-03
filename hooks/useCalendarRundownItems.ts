'use client'

import { useQuery } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'

export interface CalendarRundownItem {
  id: string
  title: string
  event_at: string
  competition_id: string
  auto_source: string | null
  competitions: { name: string; status: string } | null
}

export function useCalendarRundownItems(rangeStart: Date, rangeEnd: Date) {
  return useQuery({
    queryKey: ['calendar-rundown-items', rangeStart.toISOString(), rangeEnd.toISOString()],
    queryFn: async (): Promise<CalendarRundownItem[]> => {
      const supabase = createClient()
      const { data, error } = await supabase
        .from('rundown_items')
        .select('id, title, event_at, competition_id, auto_source, competitions(name, status)')
        .gte('event_at', rangeStart.toISOString())
        .lte('event_at', rangeEnd.toISOString())
        .order('event_at', { ascending: true })
      if (error) throw error
      return data as unknown as CalendarRundownItem[]
    },
  })
}
