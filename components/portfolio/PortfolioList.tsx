'use client'

import { useState } from 'react'
import { Trash2, Tag, Layers, Trophy } from 'lucide-react'
import { Card } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Skeleton } from '@/components/ui/Skeleton'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import type { PortfolioEntry } from '@/lib/types/database'

interface PortfolioListProps {
  entries: PortfolioEntry[]
  isLoading: boolean
  onDelete: (id: string) => void
}

export function PortfolioList({ entries, isLoading, onDelete }: PortfolioListProps) {
  const [deleteTarget, setDeleteTarget] = useState<PortfolioEntry | null>(null)

  if (isLoading) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-20 w-full" />
        <Skeleton className="h-20 w-full" />
      </div>
    )
  }

  if (entries.length === 0) {
    return (
      <Card className="p-8 text-center text-sm text-zinc-500 dark:text-zinc-400">
        No portfolio projects saved yet. Add your past ideas and concepts to enable AI reuse matching!
      </Card>
    )
  }

  return (
    <div className="space-y-3">
      {entries.map((entry) => (
        <Card key={entry.id} className="p-4 space-y-3">
          <div className="flex items-start justify-between">
            <div>
              <h3 className="font-semibold text-zinc-900 dark:text-zinc-50">{entry.name}</h3>
              {entry.description && (
                <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">{entry.description}</p>
              )}
            </div>
            <Button variant="ghost" size="sm" onClick={() => setDeleteTarget(entry)} aria-label="Delete project">
              <Trash2 className="h-4 w-4 text-red-500 hover:text-red-600" />
            </Button>
          </div>

          <div className="flex flex-wrap items-center gap-4 text-xs text-zinc-500">
            {entry.tags.length > 0 && (
              <div className="flex items-center gap-1.5">
                <Tag className="h-3.5 w-3.5" />
                <div className="flex flex-wrap gap-1">
                  {entry.tags.map((tag) => (
                    <Badge key={tag} className="bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300 text-[11px]">{tag}</Badge>
                  ))}
                </div>
              </div>
            )}

            {entry.tech_stack.length > 0 && (
              <div className="flex items-center gap-1.5">
                <Layers className="h-3.5 w-3.5" />
                <span>{entry.tech_stack.join(', ')}</span>
              </div>
            )}

            {entry.used_in_competitions.length > 0 && (
              <div className="flex items-center gap-1.5 text-purple-700 dark:text-purple-400">
                <Trophy className="h-3.5 w-3.5" />
                <span>Used in: {entry.used_in_competitions.join(', ')}</span>
              </div>
            )}
          </div>
        </Card>
      ))}

      <ConfirmDialog
        isOpen={Boolean(deleteTarget)}
        title="Delete Portfolio Project"
        description={`Are you sure you want to delete "${deleteTarget?.name}"?`}
        confirmLabel="Delete Project"
        onConfirm={() => {
          if (deleteTarget) {
            onDelete(deleteTarget.id)
            setDeleteTarget(null)
          }
        }}
        onClose={() => setDeleteTarget(null)}
      />
    </div>
  )
}
