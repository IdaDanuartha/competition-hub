'use client'

import { useState } from 'react'
import { Plus } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { PortfolioList } from '@/components/portfolio/PortfolioList'
import { PortfolioForm } from '@/components/portfolio/PortfolioForm'
import { usePortfolio, useCreatePortfolioEntry, useDeletePortfolioEntry } from '@/hooks/usePortfolio'

export default function PortfolioPage() {
  const [showForm, setShowForm] = useState(false)
  const { data: entries = [], isLoading } = usePortfolio()
  const { mutate: createEntry } = useCreatePortfolioEntry()
  const { mutate: deleteEntry } = useDeletePortfolioEntry()

  function handleCreate(values: any) {
    createEntry(values, {
      onSuccess: () => setShowForm(false),
    })
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6 py-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">Project Portfolio</h1>
          <p className="text-xs text-zinc-500 dark:text-zinc-400">
            Keep track of past project ideas, tech stacks, and competition submissions to detect reuse opportunities &amp; IP rules.
          </p>
        </div>
        <Button size="sm" onClick={() => setShowForm(!showForm)}>
          <Plus className="h-3.5 w-3.5" />
          {showForm ? 'Close' : 'Add Project'}
        </Button>
      </div>

      {showForm && (
        <PortfolioForm onSubmit={handleCreate} onCancel={() => setShowForm(false)} />
      )}

      <PortfolioList entries={entries} isLoading={isLoading} onDelete={(id) => deleteEntry(id)} />
    </div>
  )
}
