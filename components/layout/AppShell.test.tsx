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
    const links = screen.getAllByRole('link', { name: /calendar/i })
    expect(links[0]).toHaveAttribute('href', '/calendar')
    expect(links[0].className).toMatch(/text-sky-600/)
  })
})
