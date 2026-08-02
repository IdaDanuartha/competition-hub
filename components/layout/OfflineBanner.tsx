'use client'

import { useEffect, useState } from 'react'
import { WifiOff } from 'lucide-react'

export function OfflineBanner() {
  const [isOffline, setIsOffline] = useState(false)

  useEffect(() => {
    setIsOffline(!navigator.onLine)
    const goOffline = () => setIsOffline(true)
    const goOnline = () => setIsOffline(false)
    window.addEventListener('offline', goOffline)
    window.addEventListener('online', goOnline)
    return () => {
      window.removeEventListener('offline', goOffline)
      window.removeEventListener('online', goOnline)
    }
  }, [])

  if (!isOffline) return null

  return (
    <div className="flex items-center justify-center gap-2 bg-amber-100 py-1.5 text-xs text-amber-800 dark:bg-amber-950 dark:text-amber-300">
      <WifiOff className="h-3.5 w-3.5" />
      You&apos;re offline — showing previously loaded data.
    </div>
  )
}
