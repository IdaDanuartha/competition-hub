'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Plus, LayoutGrid, List } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Next7DaysWidget } from '@/components/dashboard/Next7DaysWidget'
import { DeadlineOverlapBanner } from '@/components/dashboard/DeadlineOverlapBanner'
import { TagFilterBar, applyCompetitionFilter, type CompetitionFilter } from '@/components/competitions/TagFilterBar'
import { CompetitionTable } from '@/components/competitions/CompetitionTable'
import { CompetitionBoard } from '@/components/competitions/CompetitionBoard'
import { useCompetitions } from '@/hooks/useCompetitions'
import { cn } from '@/lib/cn'

const EMPTY_FILTER: CompetitionFilter = { status: [], tags: [], team: null }

export default function DashboardPage() {
  const { data: competitions, isLoading } = useCompetitions()
  const [view, setView] = useState<'board' | 'list'>('board')
  const [filter, setFilter] = useState<CompetitionFilter>(EMPTY_FILTER)
  const [sortKey, setSortKey] = useState<'name' | 'nearestDeadline' | 'status'>('nearestDeadline')

  if (isLoading || !competitions) {
    return (
      <div className="mx-auto max-w-5xl space-y-6 py-8">
        <div className="h-40 rounded-2xl bg-zinc-100 animate-pulse dark:bg-zinc-900" />
        <div className="h-64 rounded-2xl bg-zinc-100 animate-pulse dark:bg-zinc-900" />
      </div>
    )
  }

  const filtered = applyCompetitionFilter(competitions, filter)

  return (
    <div className="mx-auto max-w-5xl space-y-6 py-6">
      {/* Top Section: Next 7 Days Widget */}
      <Next7DaysWidget />

      {/* Deadline Overlap Warning Banner */}
      <DeadlineOverlapBanner competitions={competitions} />

      {/* Competitions Section Header & Controls */}
      <div className="space-y-4 pt-2">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-xl font-bold text-zinc-900 dark:text-zinc-50">Competitions</h1>
            <p className="text-xs text-zinc-500 dark:text-zinc-400">
              Showing {filtered.length} of {competitions.length} competitions
            </p>
          </div>

          <div className="flex items-center justify-between gap-2 sm:justify-end">
            {/* View Switcher Toggle */}
            <div className="flex items-center rounded-xl border border-zinc-200 bg-white p-1 dark:border-zinc-800 dark:bg-zinc-950">
              <button
                type="button"
                onClick={() => setView('board')}
                className={cn(
                  'flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-all',
                  view === 'board'
                    ? 'bg-zinc-900 text-white shadow-xs dark:bg-zinc-100 dark:text-zinc-900'
                    : 'text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-200'
                )}
              >
                <LayoutGrid className="h-3.5 w-3.5" />
                Board
              </button>
              <button
                type="button"
                onClick={() => setView('list')}
                className={cn(
                  'flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-all',
                  view === 'list'
                    ? 'bg-zinc-900 text-white shadow-xs dark:bg-zinc-100 dark:text-zinc-900'
                    : 'text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-200'
                )}
              >
                <List className="h-3.5 w-3.5" />
                List
              </button>
            </div>

            {/* New Competition Button */}
            <Link href="/competitions/new">
              <Button size="sm" className="gap-1.5">
                <Plus className="h-4 w-4" />
                <span>New Competition</span>
              </Button>
            </Link>
          </div>
        </div>

        {/* Separated & Structured Filter Bar */}
        <TagFilterBar competitions={competitions} value={filter} onChange={setFilter} />
      </div>

      {/* Main Content View */}
      {view === 'board' ? (
        <CompetitionBoard competitions={filtered} />
      ) : (
        <CompetitionTable competitions={filtered} sortKey={sortKey} onSortKeyChange={setSortKey} />
      )}
    </div>
  )
}
