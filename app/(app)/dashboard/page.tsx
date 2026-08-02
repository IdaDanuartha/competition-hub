'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Plus } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Next7DaysWidget } from '@/components/dashboard/Next7DaysWidget'
import { DeadlineOverlapBanner } from '@/components/dashboard/DeadlineOverlapBanner'
import { TagFilterBar, applyCompetitionFilter, type CompetitionFilter } from '@/components/competitions/TagFilterBar'
import { CompetitionTable } from '@/components/competitions/CompetitionTable'
import { CompetitionBoard } from '@/components/competitions/CompetitionBoard'
import { useCompetitions } from '@/hooks/useCompetitions'

const EMPTY_FILTER: CompetitionFilter = { status: [], tags: [], team: null }

export default function DashboardPage() {
  const { data: competitions, isLoading } = useCompetitions()
  const [view, setView] = useState<'board' | 'list'>('board')
  const [filter, setFilter] = useState<CompetitionFilter>(EMPTY_FILTER)
  const [sortKey, setSortKey] = useState<'name' | 'nearestDeadline' | 'status'>('nearestDeadline')

  if (isLoading || !competitions) return null

  const filtered = applyCompetitionFilter(competitions, filter)

  return (
    <div className="mx-auto max-w-5xl space-y-6 py-8">
      <Next7DaysWidget />
      <DeadlineOverlapBanner competitions={competitions} />

      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">Competitions</h1>
        <div className="flex items-center gap-2">
          <Button variant={view === 'board' ? 'primary' : 'secondary'} size="sm" onClick={() => setView('board')}>
            Board
          </Button>
          <Button variant={view === 'list' ? 'primary' : 'secondary'} size="sm" onClick={() => setView('list')}>
            List
          </Button>
          <Link href="/competitions/new">
            <Button size="sm">
              <Plus className="h-3.5 w-3.5" />
              New
            </Button>
          </Link>
        </div>
      </div>

      <TagFilterBar competitions={competitions} value={filter} onChange={setFilter} />

      {view === 'board' ? (
        <CompetitionBoard competitions={filtered} />
      ) : (
        <CompetitionTable competitions={filtered} sortKey={sortKey} onSortKeyChange={setSortKey} />
      )}
    </div>
  )
}
