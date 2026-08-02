'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { LayoutDashboard, Settings } from 'lucide-react'
import { cn } from '@/lib/cn'
import { ThemeToggle } from '@/components/settings/ThemeToggle'
import { OfflineBanner } from './OfflineBanner'
import { InstallPrompt } from './InstallPrompt'

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
  const isSettingsActive = pathname === '/settings'

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

      {/* Mobile Fixed Bottom Navigation Bar */}
      <nav className="fixed bottom-0 left-0 right-0 z-40 flex items-center justify-around border-t border-zinc-200 bg-white/95 px-2 py-2 backdrop-blur-md dark:border-zinc-800 dark:bg-zinc-950/95 md:hidden">
        <Link
          href="/dashboard"
          className={cn(
            'flex flex-1 flex-col items-center gap-1 py-1 text-[11px] font-medium transition-colors',
            isDashboardActive
              ? 'text-sky-600 dark:text-sky-400'
              : 'text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-200'
          )}
        >
          <LayoutDashboard className="h-5 w-5" />
          <span>Dashboard</span>
        </Link>
        <Link
          href="/settings"
          className={cn(
            'flex flex-1 flex-col items-center gap-1 py-1 text-[11px] font-medium transition-colors',
            isSettingsActive
              ? 'text-sky-600 dark:text-sky-400'
              : 'text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-200'
          )}
        >
          <Settings className="h-5 w-5" />
          <span>Settings</span>
        </Link>
      </nav>

      <InstallPrompt />
    </div>
  )
}
