'use client'

import { useState } from 'react'
import { Share2, Check } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { generateShareableBrief } from '@/lib/shareable-export'
import type { Competition, AiSummary } from '@/lib/types/database'

interface ShareableExportActionProps {
  competition: Competition
  summary?: AiSummary | null
}

export function ShareableExportAction({ competition, summary }: ShareableExportActionProps) {
  const [copied, setCopied] = useState(false)

  function handleShare() {
    const text = generateShareableBrief(competition, summary)
    navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <Button variant="secondary" size="sm" onClick={handleShare}>
      {copied ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Share2 className="h-3.5 w-3.5" />}
      {copied ? 'Brief Copied!' : 'Share Brief'}
    </Button>
  )
}
