import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { RundownItemForm } from './RundownItemForm'

describe('RundownItemForm', () => {
  it('rejects submission without a title', async () => {
    const onSubmit = vi.fn()
    render(<RundownItemForm onSubmit={onSubmit} />)
    await userEvent.type(screen.getByLabelText(/date/i), '2026-03-01T09:00')
    await userEvent.click(screen.getByRole('button', { name: /add/i }))
    expect(await screen.findByText(/title is required/i)).toBeInTheDocument()
    expect(onSubmit).not.toHaveBeenCalled()
  })

  it('submits valid values', async () => {
    const onSubmit = vi.fn()
    render(<RundownItemForm onSubmit={onSubmit} />)
    await userEvent.type(screen.getByLabelText(/title/i), 'Technical briefing')
    await userEvent.type(screen.getByLabelText(/date/i), '2026-03-01T09:00')
    await userEvent.click(screen.getByRole('button', { name: /add/i }))
    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({ title: 'Technical briefing', event_at: '2026-03-01T09:00' })
    )
  })
})
