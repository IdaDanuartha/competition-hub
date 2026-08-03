'use client'

import { useState } from 'react'
import { CompetitionCard } from './CompetitionCard'
import { STATUS_ORDER, statusLabel } from '@/lib/status'
import { useUpdateCompetitionStatus } from '@/hooks/useCompetitions'
import { useNextRundownDates } from '@/hooks/useNextRundownDates'
import type { Competition, CompetitionStatus } from '@/lib/types/database'
import type { NextRundownEntry } from '@/hooks/useNextRundownDates'

function BoardColumn({
  status,
  items,
  onDropStatus,
  nextRundownMap,
}: {
  status: CompetitionStatus
  items: Competition[]
  onDropStatus: (id: string, newStatus: CompetitionStatus) => void
  nextRundownMap: Map<string, NextRundownEntry>
}) {
  const [isOver, setIsOver] = useState(false)

  return (
    <div
      onDragOver={(e) => {
        e.preventDefault()
        e.dataTransfer.dropEffect = 'move'
        if (!isOver) setIsOver(true)
      }}
      onDragLeave={(e) => {
        // Only turn off highlight when leaving the column container
        if (!e.currentTarget.contains(e.relatedTarget as Node)) {
          setIsOver(false)
        }
      }}
      onDrop={(e) => {
        e.preventDefault()
        setIsOver(false)
        const id = e.dataTransfer.getData('text/plain')
        if (id) {
          onDropStatus(id, status)
        }
      }}
      className={`w-64 shrink-0 rounded-xl p-2 transition-colors ${
        isOver
          ? 'bg-blue-50/70 ring-2 ring-blue-500/50 dark:bg-blue-950/40 dark:ring-blue-400/50'
          : 'bg-transparent'
      }`}
    >
      <h3 className="mb-2 text-sm font-semibold text-zinc-700 dark:text-zinc-300 px-1">
        {statusLabel(status)} <span className="text-zinc-400">({items.length})</span>
      </h3>
      <div className="space-y-2 min-h-[100px]">
        {items.length === 0 ? (
          <div className="flex h-24 flex-col items-center justify-center rounded-lg border border-dashed border-zinc-200 bg-zinc-50/50 p-3 text-center dark:border-zinc-800/80 dark:bg-zinc-900/30">
            <p className="text-xs text-zinc-400 dark:text-zinc-500">
              {isOver ? 'Drop competition here' : 'No competitions'}
            </p>
          </div>
        ) : (
          items.map((c) => (
            <CompetitionCard
              key={c.id}
              competition={c}
              nextRundown={nextRundownMap.get(c.id)}
            />
          ))
        )}
      </div>
    </div>
  )
}

export function CompetitionBoard({ competitions }: { competitions: Competition[] }) {
  const { mutate: updateStatus } = useUpdateCompetitionStatus()
  const ids = competitions.map((c) => c.id)
  const { data: nextRundownMap = new Map() } = useNextRundownDates(ids)

  function handleDropStatus(id: string, newStatus: CompetitionStatus) {
    updateStatus({ id, status: newStatus })
  }

  return (
    <div className="flex gap-3 overflow-x-auto pb-4 pt-1">
      {STATUS_ORDER.map((status) => {
        const items = competitions.filter((c) => c.status === status)
        return (
          <BoardColumn
            key={status}
            status={status}
            items={items}
            onDropStatus={handleDropStatus}
            nextRundownMap={nextRundownMap}
          />
        )
      })}
    </div>
  )
}
