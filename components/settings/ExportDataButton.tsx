'use client'

import { Download } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { useDataExport } from '@/hooks/useDataExport'

export function ExportDataButton() {
  const { exportData, isExporting } = useDataExport()

  return (
    <Button
      variant="secondary"
      size="sm"
      onClick={exportData}
      disabled={isExporting}
      className="flex items-center gap-1.5"
    >
      <Download className={`h-4 w-4 ${isExporting ? 'animate-bounce' : ''}`} />
      {isExporting ? 'Exporting...' : 'Export all data (JSON)'}
    </Button>
  )
}
