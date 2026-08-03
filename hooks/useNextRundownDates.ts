'use client'

import { useQuery } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'

export interface NextRundownEntry {
  title: string
  event_at: string
}

/**
 * Fetches the next upcoming rundown_items event for each competition
 * in a single query and returns a Map keyed by competition_id.
 *
 * Only events in the future are included. The earliest future event
 * per competition is used as "Next".
 */
export function useNextRundownDates(competitionIds: string[]) {
  return useQuery({
    queryKey: ['next-rundown-dates', competitionIds],
    enabled: competitionIds.length > 0,
    queryFn: async () => {
      const supabase = createClient()
      const now = new Date().toISOString()

      const { data, error } = await supabase
        .from('rundown_items')
        .select('competition_id, title, event_at')
        .in('competition_id', competitionIds)
        .gte('event_at', now)
        .order('event_at', { ascending: true })

      if (error) throw error

      // Build a map: take only the first (earliest) event per competition
      const map = new Map<string, NextRundownEntry>()
      for (const row of data ?? []) {
        if (!map.has(row.competition_id)) {
          map.set(row.competition_id, { title: row.title, event_at: row.event_at })
        }
      }
      return map
    },
  })
}
