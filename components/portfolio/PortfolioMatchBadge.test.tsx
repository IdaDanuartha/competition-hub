import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { PortfolioMatchBadge } from './PortfolioMatchBadge'
import type { PortfolioEntry } from '@/lib/types/database'

const mockMatches: PortfolioEntry[] = [
  {
    id: 'p1', user_id: 'u1', name: 'Project Alpha', description: 'AI Bot',
    tags: ['AI'], tech_stack: ['Next.js'], used_in_competitions: ['BYTESFEST 2025'],
    created_at: '', updated_at: ''
  }
]

describe('PortfolioMatchBadge', () => {
  it('renders reuse suggestion and IP warning when portfolio entry matches theme', () => {
    render(<PortfolioMatchBadge matches={mockMatches} />)
    expect(screen.getByText(/Possible fit: reuse\/adapt Project Alpha/i)).toBeInTheDocument()
    expect(screen.getByText(/Used in: BYTESFEST 2025/i)).toBeInTheDocument()
    expect(screen.getByText(/Check competition originality and IP rules before resubmitting/i)).toBeInTheDocument()
  })

  it('renders nothing when matches array is empty', () => {
    const { container } = render(<PortfolioMatchBadge matches={[]} />)
    expect(container).toBeEmptyDOMElement()
  })
})
