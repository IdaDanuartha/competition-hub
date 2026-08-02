import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { StatusBadge } from './StatusBadge'

describe('StatusBadge', () => {
  it('renders the human label', () => {
    render(<StatusBadge status="in_progress" />)
    expect(screen.getByText('In Progress')).toBeInTheDocument()
  })

  it('applies the red color class for not_selected', () => {
    render(<StatusBadge status="not_selected" />)
    expect(screen.getByText('Not Selected').className).toContain('red')
  })
})
