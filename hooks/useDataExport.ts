'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'

export function useDataExport() {
  const [isExporting, setIsExporting] = useState(false)

  async function exportData() {
    setIsExporting(true)
    try {
      const supabase = createClient()
      const [
        { data: competitions },
        { data: documents },
        { data: rundown_items },
        { data: ai_summaries },
        { data: portfolio_entries },
      ] = await Promise.all([
        supabase.from('competitions').select('*'),
        supabase.from('competition_documents').select('*'),
        supabase.from('rundown_items').select('*'),
        supabase.from('ai_summaries').select('*'),
        supabase.from('portfolio_entries').select('*'),
      ])

      const backup = {
        exported_at: new Date().toISOString(),
        version: '1.0',
        competitions: competitions ?? [],
        documents: documents ?? [],
        rundown_items: rundown_items ?? [],
        ai_summaries: ai_summaries ?? [],
        portfolio_entries: portfolio_entries ?? [],
      }

      const jsonStr = JSON.stringify(backup, null, 2)
      const blob = new Blob([jsonStr], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `competition-hub-export-${new Date().toISOString().slice(0, 10)}.json`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
    } finally {
      setIsExporting(false)
    }
  }

  return { exportData, isExporting }
}
