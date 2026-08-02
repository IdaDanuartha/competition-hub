import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ThemeToggle } from './ThemeToggle'

const mutate = vi.fn()
const mockSettings = { theme_preference: 'light' }

vi.mock('@/hooks/useUserSettings', () => ({
  useUserSettings: () => ({ data: mockSettings }),
  useUpdateUserSettings: () => ({ mutate }),
}))

beforeEach(() => {
  document.documentElement.classList.remove('dark')
  mutate.mockClear()
})

describe('ThemeToggle', () => {
  it('switches to dark mode, updates the DOM class, and persists the preference', async () => {
    render(<ThemeToggle />)
    await userEvent.click(screen.getByRole('button', { name: /switch to dark/i }))
    expect(document.documentElement.classList.contains('dark')).toBe(true)
    expect(mutate).toHaveBeenCalledWith({ theme_preference: 'dark' })
  })
})
