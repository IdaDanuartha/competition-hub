import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { AppShell } from './AppShell'

vi.mock('next/navigation', () => ({
  usePathname: () => '/calendar',
}))

vi.mock('./OfflineBanner', () => ({ OfflineBanner: () => null }))
vi.mock('./InstallPrompt', () => ({ InstallPrompt: () => null }))
vi.mock('./AiHubSelectorModal', () => ({ AiHubSelectorModal: () => null }))
vi.mock('@/components/settings/ThemeToggle', () => ({ ThemeToggle: () => null }))

describe('AppShell', () => {
  it('renders a Calendar link marked active on /calendar', () => {
    render(<AppShell>content</AppShell>)
    const link = screen.getByRole('link', { name: /calendar/i })
    expect(link).toHaveAttribute('href', '/calendar')
    expect(link.className).toMatch(/text-sky-600/)
  })
})
