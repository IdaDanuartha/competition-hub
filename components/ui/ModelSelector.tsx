'use client'

import { useState, useRef, useEffect } from 'react'
import { Cpu, ChevronDown, Check, CheckCircle2, AlertTriangle, XCircle, HelpCircle, Loader2 } from 'lucide-react'

export interface ModelOption {
  value: string
  label: string
  description?: string
}

export interface ModelStatus {
  status: 'active' | 'rate_limited' | 'key_missing' | 'error'
  message?: string
  credit?: string | null
}

interface ModelSelectorProps {
  options: ModelOption[]
  selectedModel: string
  modelStatuses?: Record<string, ModelStatus>
  isLoading?: boolean
  onSelectModel: (model: string) => void
  disabled?: boolean
  className?: string
  fullWidth?: boolean
}

export function ModelSelector({
  options,
  selectedModel,
  modelStatuses = {},
  isLoading = false,
  onSelectModel,
  disabled = false,
  className = '',
  fullWidth = false,
}: ModelSelectorProps) {
  const [isOpen, setIsOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  const isCheckingStatus = isLoading || Object.keys(modelStatuses).length === 0
  const selectedOpt = options.find((o) => o.value === selectedModel) || options[0]
  const currentSt = modelStatuses[selectedModel]?.status

  // Close on outside click
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  function renderStatusBadge(status?: string) {
    if (isCheckingStatus) {
      return (
        <span className="inline-flex items-center gap-1 rounded-md bg-zinc-100 px-1.5 py-0.5 text-[10px] font-medium text-zinc-400 dark:bg-zinc-800/80 dark:text-zinc-400">
          <Loader2 className="h-2.5 w-2.5 animate-spin text-sky-500" />
          <span>Cek...</span>
        </span>
      )
    }

    if (status === 'rate_limited') {
      return (
        <span className="inline-flex items-center gap-1 rounded-md bg-amber-50 px-1.5 py-0.5 text-[10px] font-semibold text-amber-700 dark:bg-amber-950/60 dark:text-amber-300">
          <AlertTriangle className="h-3 w-3 text-amber-500" />
          <span>Limit 429</span>
        </span>
      )
    }
    if (status === 'error') {
      return (
        <span className="inline-flex items-center gap-1 rounded-md bg-red-50 px-1.5 py-0.5 text-[10px] font-semibold text-red-700 dark:bg-red-950/60 dark:text-red-300">
          <XCircle className="h-3 w-3 text-red-500" />
          <span>Error</span>
        </span>
      )
    }
    if (status === 'key_missing') {
      return (
        <span className="inline-flex items-center gap-1 rounded-md bg-zinc-100 px-1.5 py-0.5 text-[10px] font-semibold text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400">
          <HelpCircle className="h-3 w-3 text-zinc-400" />
          <span>No Key</span>
        </span>
      )
    }
    return (
      <span className="inline-flex items-center gap-1 rounded-md bg-emerald-50 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300">
        <CheckCircle2 className="h-3 w-3 text-emerald-500" />
        <span>Aktif</span>
      </span>
    )
  }

  return (
    <div ref={containerRef} className={`relative ${fullWidth ? 'w-full' : 'inline-block'} text-left ${className}`}>
      {/* Trigger Button */}
      <button
        type="button"
        disabled={disabled}
        onClick={() => setIsOpen((prev) => !prev)}
        className={`flex items-center justify-between gap-2.5 rounded-xl border border-zinc-200/90 bg-white/90 px-3 py-1.5 text-xs font-medium text-zinc-800 shadow-xs hover:border-zinc-300 hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900/90 dark:text-zinc-200 dark:hover:border-zinc-700 dark:hover:bg-zinc-800/90 transition-all cursor-pointer disabled:opacity-50 ${
          fullWidth ? 'w-full' : ''
        }`}
      >
        <div className="flex items-center gap-2 min-w-0">
          <Cpu className="h-3.5 w-3.5 text-sky-500 shrink-0" />
          <span className="truncate font-medium">
            {selectedOpt?.value || selectedModel}
          </span>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          <span className="inline-flex">
            {renderStatusBadge(currentSt)}
          </span>
          <ChevronDown className={`h-3.5 w-3.5 text-zinc-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
        </div>
      </button>

      {/* Custom Popover Dropdown Menu */}
      {isOpen && (
        <div className="absolute right-0 top-full z-50 mt-1.5 w-72 rounded-2xl border border-zinc-200 bg-white/95 p-1.5 shadow-2xl backdrop-blur-md dark:border-zinc-800 dark:bg-zinc-950/95 animate-in fade-in zoom-in-95 duration-150">
          <div className="px-2 py-1.5 text-[11px] font-bold uppercase tracking-wider text-zinc-400 border-b border-zinc-100 dark:border-zinc-800/80 mb-1 flex items-center justify-between">
            <span>Pilih Model AI Engine</span>
            {isCheckingStatus ? (
              <span className="text-[10px] font-normal text-sky-600 dark:text-sky-400 flex items-center gap-1">
                <Loader2 className="h-2.5 w-2.5 animate-spin" />
                Cek Status...
              </span>
            ) : (
              <span className="text-[10px] font-normal text-zinc-400">Status</span>
            )}
          </div>

          <div className="space-y-1">
            {options.map((opt) => {
              const isSelected = opt.value === selectedModel
              const st = modelStatuses[opt.value]?.status
              const credit = modelStatuses[opt.value]?.credit
              return (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => {
                    onSelectModel(opt.value)
                    setIsOpen(false)
                  }}
                  className={`flex w-full items-center justify-between rounded-xl px-2.5 py-2 text-left text-xs transition-all ${
                    isSelected
                      ? 'bg-sky-50/80 font-semibold text-sky-900 dark:bg-sky-950/40 dark:text-sky-300'
                      : 'text-zinc-700 hover:bg-zinc-100/80 dark:text-zinc-300 dark:hover:bg-zinc-900/80'
                  }`}
                >
                  <div className="flex items-center gap-2 min-w-0 pr-2">
                    {isSelected ? (
                      <Check className="h-3.5 w-3.5 text-sky-600 dark:text-sky-400 shrink-0" />
                    ) : (
                      <div className="h-3.5 w-3.5 shrink-0" />
                    )}
                    <div className="min-w-0">
                      <p className="truncate font-medium leading-snug">{opt.label}</p>
                      {credit && (
                        <p className="text-[10px] text-zinc-400 dark:text-zinc-500 leading-tight truncate">
                          {credit}
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="shrink-0">
                    {isCheckingStatus ? (
                      <span className="h-4 w-12 rounded-md bg-zinc-200/80 dark:bg-zinc-800 animate-pulse block" />
                    ) : (
                      renderStatusBadge(st)
                    )}
                  </div>
                </button>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
