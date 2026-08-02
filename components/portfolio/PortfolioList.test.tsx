import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { PortfolioList } from './PortfolioList'
import type { PortfolioEntry } from '@/lib/types/database'

const mockEntries: PortfolioEntry[] = [
  {
    id: 'p1', user_id: 'u1', name: 'WasteWise', description: 'Smart recycling app',
    tags: ['AI', 'Sustainability'], tech_stack: ['Flutter', 'Python'],
    used_in_competitions: ['BYTESFEST 2025'], created_at: '', updated_at: ''
  }
]

describe('PortfolioList', () => {
  it('renders project list items with name and tags', () => {
    render(<PortfolioList entries={mockEntries} isLoading={false} onDelete={() => {}} />)
    expect(screen.getByText(/WasteWise/i)).toBeInTheDocument()
    expect(screen.getByText(/Sustainability/i)).toBeInTheDocument()
    expect(screen.getByText(/Flutter/i)).toBeInTheDocument()
  })
})
