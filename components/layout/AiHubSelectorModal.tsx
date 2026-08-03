'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Sparkles, Search, X, Bot, ArrowRight, Trophy } from 'lucide-react'
import { useCompetitions } from '@/hooks/useCompetitions'
import { StatusBadge } from '@/components/competitions/StatusBadge'

export function AiHubSelectorModal() {
  const [isOpen, setIsOpen] = useState(false)
  const [search, setSearch] = useState('')
  const router = useRouter()
  const { data: competitions = [], isLoading } = useCompetitions()

  useEffect(() => {
    const handleOpenModal = () => setIsOpen(true)
    window.addEventListener('open-ai-hub-selector', handleOpenModal)
    return () => window.removeEventListener('open-ai-hub-selector', handleOpenModal)
  }, [])

  if (!isOpen) return null

  const filtered = competitions.filter((c) => {
    const q = search.toLowerCase().trim()
    if (!q) return true
    return c.name.toLowerCase().includes(q) || (c.organizer && c.organizer.toLowerCase().includes(q))
  })

  const handleSelect = (competitionId: string) => {
    setIsOpen(false)
    router.push(`/competitions/${competitionId}?chat=open`)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-sm p-0 sm:p-4 animate-in fade-in duration-200">
      <div className="relative flex w-full max-w-lg flex-col rounded-t-3xl sm:rounded-2xl bg-white shadow-2xl dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 max-h-[85vh] overflow-hidden animate-in slide-in-from-bottom-5 duration-300">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-zinc-200 bg-zinc-50/80 px-5 py-4 dark:border-zinc-800 dark:bg-zinc-900/80">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-600/10 text-emerald-600 dark:bg-emerald-500/20 dark:text-emerald-400">
              <Sparkles className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-zinc-900 dark:text-zinc-50">
                Pilih Lomba / Proyek
              </h3>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">
                Pilih kompetisi yang ingin ditanyakan ke AI Guidebook
              </p>
            </div>
          </div>

          <button
            onClick={() => setIsOpen(false)}
            className="rounded-lg p-1.5 text-zinc-400 hover:bg-zinc-200 hover:text-zinc-800 dark:hover:bg-zinc-800 dark:hover:text-zinc-200 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Search Bar */}
        <div className="p-4 border-b border-zinc-100 dark:border-zinc-900 bg-white dark:bg-zinc-950">
          <div className="relative">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Cari nama lomba atau penyelenggara..."
              className="w-full rounded-xl border border-zinc-200 bg-zinc-50 pl-10 pr-4 py-2.5 text-xs text-zinc-900 placeholder-zinc-400 focus:border-emerald-500 focus:bg-white focus:outline-none focus:ring-1 focus:ring-emerald-500 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-100 dark:placeholder-zinc-500 dark:focus:border-emerald-500 dark:focus:bg-zinc-950 transition-all"
            />
          </div>
        </div>

        {/* Competition List */}
        <div className="flex-1 overflow-y-auto p-4 space-y-2.5 max-h-[50vh]">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-12 text-zinc-400 space-y-2">
              <Bot className="h-8 w-8 animate-bounce text-emerald-500" />
              <p className="text-xs">Memuat daftar kompetisi...</p>
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 text-center space-y-3 text-zinc-400">
              <Trophy className="h-10 w-10 stroke-1 text-zinc-300 dark:text-zinc-700" />
              <p className="text-xs">
                {search ? 'Tidak ada lomba yang sesuai pencarian.' : 'Belum ada kompetisi yang terdaftar.'}
              </p>
            </div>
          ) : (
            filtered.map((comp) => (
              <button
                key={comp.id}
                onClick={() => handleSelect(comp.id)}
                className="group flex w-full items-center justify-between rounded-2xl border border-zinc-200/80 bg-zinc-50/50 p-3.5 text-left hover:border-emerald-500/70 hover:bg-emerald-50/40 dark:border-zinc-800 dark:bg-zinc-900/40 dark:hover:border-emerald-500/50 dark:hover:bg-emerald-950/30 transition-all cursor-pointer"
              >
                <div className="min-w-0 pr-3 space-y-1">
                  <div className="flex items-center gap-2">
                    <h4 className="text-xs font-semibold text-zinc-900 dark:text-zinc-100 truncate group-hover:text-emerald-700 dark:group-hover:text-emerald-400 transition-colors">
                      {comp.name}
                    </h4>
                    <StatusBadge status={comp.status} />
                  </div>

                  <p className="text-[11px] text-zinc-500 dark:text-zinc-400 truncate">
                    {comp.organizer ? `Penyelenggara: ${comp.organizer}` : comp.theme ? `Tema: ${comp.theme}` : 'Kompetisi'}
                  </p>
                </div>

                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-zinc-200/60 text-zinc-500 group-hover:bg-emerald-600 group-hover:text-white dark:bg-zinc-800 dark:text-zinc-400 dark:group-hover:bg-emerald-500 transition-all">
                  <ArrowRight className="h-4 w-4" />
                </div>
              </button>
            ))
          )}
        </div>
      </div>
    </div>
  )
}
