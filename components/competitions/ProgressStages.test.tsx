import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { ProgressStages } from './ProgressStages'

describe('ProgressStages', () => {
  it('shows stage 3 of 6 for submitted', () => {
    render(<ProgressStages status="submitted" />)
    expect(screen.getByText('4 of 6')).toBeInTheDocument()
  })

  it('shows stage 1 of 6 for researching', () => {
    render(<ProgressStages status="researching" />)
    expect(screen.getByText('1 of 6')).toBeInTheDocument()
  })
})
