'use client'

import { useState, useEffect } from 'react'
import { subscribeToasts, toast, type ToastItem } from '@/lib/toast'
import { CheckCircle2, AlertCircle, Info, X } from 'lucide-react'

export interface ToasterProps {
  position?: string
  richColors?: boolean
  closeButton?: boolean
}

export function Toaster(_props?: ToasterProps) {
  const [items, setItems] = useState<ToastItem[]>([])

  useEffect(() => {
    return subscribeToasts(setItems)
  }, [])

  if (items.length === 0) return null

  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 max-w-sm w-full pointer-events-none px-4 sm:px-0">
      {items.map((item) => (
        <div
          key={item.id}
          className={`pointer-events-auto flex items-center justify-between gap-3 rounded-2xl px-4 py-3 shadow-2xl border backdrop-blur-md text-xs font-semibold transition-all animate-in slide-in-from-bottom-3 duration-200 ${
            item.type === 'success'
              ? 'bg-emerald-950/90 text-emerald-100 border-emerald-800/80 dark:bg-emerald-950/95 dark:text-emerald-200'
              : item.type === 'error'
              ? 'bg-rose-950/90 text-rose-100 border-rose-800/80 dark:bg-rose-950/95 dark:text-rose-200'
              : 'bg-zinc-900/90 text-zinc-100 border-zinc-700/80 dark:bg-zinc-900/95 dark:text-zinc-200'
          }`}
        >
          <div className="flex items-center gap-2.5 min-w-0">
            {item.type === 'success' && <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />}
            {item.type === 'error' && <AlertCircle className="h-4 w-4 text-rose-400 shrink-0" />}
            {item.type === 'info' && <Info className="h-4 w-4 text-sky-400 shrink-0" />}
            <span className="truncate leading-relaxed">{item.message}</span>
          </div>

          <button
            type="button"
            onClick={() => toast.dismiss(item.id)}
            className="rounded-lg p-1 opacity-70 hover:opacity-100 hover:bg-white/10 transition-colors shrink-0 cursor-pointer"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      ))}
    </div>
  )
}
