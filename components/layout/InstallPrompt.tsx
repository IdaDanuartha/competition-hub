'use client'

import { useEffect, useState } from 'react'
import { Download, X } from 'lucide-react'
import { Button } from '@/components/ui/Button'

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

export function InstallPrompt() {
  const [deferredEvent, setDeferredEvent] = useState<BeforeInstallPromptEvent | null>(null)
  const [dismissed, setDismissed] = useState(false)

  useEffect(() => {
    function handler(e: Event) {
      e.preventDefault()
      setDeferredEvent(e as BeforeInstallPromptEvent)
    }
    window.addEventListener('beforeinstallprompt', handler)
    return () => window.removeEventListener('beforeinstallprompt', handler)
  }, [])

  if (!deferredEvent || dismissed) return null

  return (
    <div className="flex items-center justify-between gap-3 border-t border-zinc-200 bg-zinc-50 px-4 py-2 text-sm dark:border-zinc-800 dark:bg-zinc-900">
      <span className="text-zinc-700 dark:text-zinc-300">Install Competition Hub for quick access.</span>
      <div className="flex items-center gap-2">
        <Button
          size="sm"
          onClick={async () => {
            await deferredEvent.prompt()
            setDeferredEvent(null)
          }}
        >
          <Download className="h-3.5 w-3.5" />
          Install
        </Button>
        <button aria-label="Dismiss install prompt" onClick={() => setDismissed(true)}>
          <X className="h-4 w-4 text-zinc-500" />
        </button>
      </div>
    </div>
  )
}
