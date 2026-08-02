import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { RundownModeToggle } from './RundownModeToggle'

describe('RundownModeToggle', () => {
  it('calls onChange with manual when toggled from auto', async () => {
    const onChange = vi.fn()
    render(<RundownModeToggle mode="auto" onChange={onChange} />)
    await userEvent.click(screen.getByRole('switch'))
    expect(onChange).toHaveBeenCalledWith('manual')
  })

  it('reflects the current mode as checked when auto', () => {
    render(<RundownModeToggle mode="auto" onChange={() => {}} />)
    expect(screen.getByRole('switch')).toHaveAttribute('aria-checked', 'true')
  })
})
