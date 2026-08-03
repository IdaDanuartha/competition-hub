'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { LayoutDashboard, Settings, Sparkles, CalendarDays, Compass } from 'lucide-react'
import { cn } from '@/lib/cn'
import { ThemeToggle } from '@/components/settings/ThemeToggle'
import { OfflineBanner } from './OfflineBanner'
import { InstallPrompt } from './InstallPrompt'
import { AiHubSelectorModal } from './AiHubSelectorModal'

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const isAuthPage = pathname === '/login' || pathname === '/register'

  if (isAuthPage) {
    return (
      <div className="flex h-screen w-screen flex-col bg-zinc-50 dark:bg-black">
        <OfflineBanner />
        <div className="absolute top-4 right-4 z-50">
          <ThemeToggle />
        </div>
        <main className="flex-1">{children}</main>
      </div>
    )
  }

  const isDashboardActive = pathname === '/dashboard' || pathname.startsWith('/competitions')
  const isCalendarActive = pathname === '/calendar'
  const isDiscoverActive = pathname === '/discover'
  const isSettingsActive = pathname === '/settings'
  const isCompetitionDetailPage = pathname.startsWith('/competitions/')

  return (
    <div className="flex min-h-screen flex-col bg-zinc-50 dark:bg-black">
      <OfflineBanner />
      
      {/* Top Header */}
      <header className="sticky top-0 z-30 flex items-center justify-between border-b border-zinc-200 bg-white/90 px-4 py-3 backdrop-blur-md dark:border-zinc-800 dark:bg-zinc-950/90 sm:px-6">
        <Link href="/dashboard" className="text-base font-semibold text-zinc-900 dark:text-zinc-50">
          Competition Hub
        </Link>

        {/* Desktop Navigation */}
        <nav className="hidden items-center gap-5 md:flex">
          <Link
            href="/dashboard"
            className={cn(
              'flex items-center gap-1.5 text-sm transition-colors hover:text-zinc-900 dark:hover:text-zinc-50',
              isDashboardActive ? 'font-semibold text-sky-600 dark:text-sky-400' : 'text-zinc-600 dark:text-zinc-400'
            )}
          >
            <LayoutDashboard className="h-4 w-4" />
            Dashboard
          </Link>
          <Link
            href="/calendar"
            className={cn(
              'flex items-center gap-1.5 text-sm transition-colors hover:text-zinc-900 dark:hover:text-zinc-50',
              isCalendarActive ? 'font-semibold text-sky-600 dark:text-sky-400' : 'text-zinc-600 dark:text-zinc-400'
            )}
          >
            <CalendarDays className="h-4 w-4" />
            Calendar
          </Link>
          <Link
            href="/discover"
            className={cn(
              'flex items-center gap-1.5 text-sm transition-colors hover:text-zinc-900 dark:hover:text-zinc-50',
              isDiscoverActive ? 'font-semibold text-sky-600 dark:text-sky-400' : 'text-zinc-600 dark:text-zinc-400'
            )}
          >
            <Compass className="h-4 w-4" />
            Discover
          </Link>
          <button
            type="button"
            onClick={() => {
              if (isCompetitionDetailPage) {
                window.dispatchEvent(new CustomEvent('open-ai-chat'))
              } else {
                window.dispatchEvent(new CustomEvent('open-ai-hub-selector'))
              }
            }}
            className="flex items-center gap-1.5 text-sm text-emerald-600 hover:text-emerald-700 dark:text-emerald-400 dark:hover:text-emerald-300 font-semibold cursor-pointer transition-colors"
          >
            <Sparkles className="h-4 w-4 text-emerald-500 animate-pulse" />
            Tanya AI
          </button>
          <Link
            href="/settings"
            className={cn(
              'flex items-center gap-1.5 text-sm transition-colors hover:text-zinc-900 dark:hover:text-zinc-50',
              isSettingsActive ? 'font-semibold text-sky-600 dark:text-sky-400' : 'text-zinc-600 dark:text-zinc-400'
            )}
          >
            <Settings className="h-4 w-4" />
            Settings
          </Link>
          <ThemeToggle />
        </nav>

        {/* Mobile Theme Toggle */}
        <div className="flex items-center gap-2 md:hidden">
          <ThemeToggle />
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 px-4 py-4 sm:px-6 pb-24 md:pb-8">{children}</main>

      {/* Mobile Fixed Bottom Navigation Bar (5 Items with Elevated Center FAB) */}
      <nav className="fixed bottom-0 left-0 right-0 z-40 grid grid-cols-5 items-center justify-items-center border-t border-zinc-200/80 bg-white/95 px-1 py-1.5 backdrop-blur-md dark:border-zinc-800/80 dark:bg-zinc-950/95 md:hidden">
        {/* 1. Dashboard */}
        <Link
          href="/dashboard"
          className={cn(
            'flex flex-col items-center gap-0.5 py-1 text-[10px] font-medium transition-colors w-full',
            isDashboardActive && !isCompetitionDetailPage
              ? 'text-sky-600 dark:text-sky-400 font-semibold'
              : 'text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-200'
          )}
        >
          <LayoutDashboard className="h-5 w-5" />
          <span>Dashboard</span>
        </Link>

        {/* 2. Calendar */}
        <Link
          href="/calendar"
          className={cn(
            'flex flex-col items-center gap-0.5 py-1 text-[10px] font-medium transition-colors w-full',
            isCalendarActive
              ? 'text-sky-600 dark:text-sky-400 font-semibold'
              : 'text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-200'
          )}
        >
          <CalendarDays className="h-5 w-5" />
          <span>Calendar</span>
        </Link>

        {/* 3. Elevated Center Circular Button (AI Hub) */}
        <div className="relative flex flex-col items-center justify-center -mt-6">
          <button
            type="button"
            onClick={() => {
              if (isCompetitionDetailPage) {
                window.dispatchEvent(new CustomEvent('open-ai-chat'))
              } else {
                window.dispatchEvent(new CustomEvent('open-ai-hub-selector'))
              }
            }}
            className="flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-tr from-emerald-600 via-teal-600 to-emerald-500 text-white shadow-lg shadow-emerald-600/30 border-4 border-zinc-50 dark:border-zinc-950 hover:scale-105 active:scale-95 transition-all group cursor-pointer"
            aria-label="Tanya AI Guidebook"
          >
            <Sparkles className="h-5 w-5 text-white group-hover:rotate-12 transition-transform animate-pulse" />
          </button>
          <span className="mt-0.5 text-[10px] font-bold text-emerald-600 dark:text-emerald-400">
            {isCompetitionDetailPage ? 'Tanya AI' : 'AI Hub'}
          </span>
        </div>

        {/* 4. Discover */}
        <Link
          href="/discover"
          className={cn(
            'flex flex-col items-center gap-0.5 py-1 text-[10px] font-medium transition-colors w-full',
            isDiscoverActive
              ? 'text-sky-600 dark:text-sky-400 font-semibold'
              : 'text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-200'
          )}
        >
          <Compass className="h-5 w-5" />
          <span>Discover</span>
        </Link>

        {/* 5. Settings */}
        <Link
          href="/settings"
          className={cn(
            'flex flex-col items-center gap-0.5 py-1 text-[10px] font-medium transition-colors w-full',
            isSettingsActive
              ? 'text-sky-600 dark:text-sky-400 font-semibold'
              : 'text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-200'
          )}
        >
          <Settings className="h-5 w-5" />
          <span>Settings</span>
        </Link>
      </nav>

      <InstallPrompt />
      <AiHubSelectorModal />
    </div>
  )
}

