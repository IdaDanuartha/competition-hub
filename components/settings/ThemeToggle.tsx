'use client'

import { useEffect, useState } from 'react'
import { Sun, Moon } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { useUserSettings, useUpdateUserSettings } from '@/hooks/useUserSettings'

export function ThemeToggle() {
  const { data: settings } = useUserSettings()
  const { mutate } = useUpdateUserSettings()
  const [isDark, setIsDark] = useState(false)

  useEffect(() => {
    // Determine theme priority: 1. DB settings -> 2. localStorage -> 3. default LIGHT
    let dark = false
    if (settings?.theme_preference) {
      dark = settings.theme_preference === 'dark'
    } else {
      const stored = localStorage.getItem('theme-preference')
      if (stored === null) {
        // Explicit default is LIGHT mode per PRD Section 6
        localStorage.setItem('theme-preference', 'light')
        dark = false
      } else {
        dark = stored === 'dark'
      }
    }

    setIsDark(dark)
    if (dark) {
      document.documentElement.classList.add('dark')
    } else {
      document.documentElement.classList.remove('dark')
    }
  }, [settings?.theme_preference])

  function toggle() {
    const nextIsDark = !document.documentElement.classList.contains('dark')
    setIsDark(nextIsDark)
    const nextTheme = nextIsDark ? 'dark' : 'light'

    if (nextIsDark) {
      document.documentElement.classList.add('dark')
    } else {
      document.documentElement.classList.remove('dark')
    }

    try {
      localStorage.setItem('theme-preference', nextTheme)
    } catch (e) {}

    mutate({ theme_preference: nextTheme })
  }

  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={toggle}
      aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
    >
      {isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4 text-zinc-600 hover:text-zinc-900" />}
    </Button>
  )
}
