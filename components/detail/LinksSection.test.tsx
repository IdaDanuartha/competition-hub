import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { LinksSection } from './LinksSection'

describe('LinksSection', () => {
  it('renders both links when present', () => {
    render(<LinksSection instagramUrl="https://instagram.com/x" websiteUrl="https://x.com" />)
    expect(screen.getByRole('link', { name: /instagram/i })).toHaveAttribute('href', 'https://instagram.com/x')
    expect(screen.getByRole('link', { name: /website/i })).toHaveAttribute('href', 'https://x.com')
  })

  it('shows a placeholder when neither link is set', () => {
    render(<LinksSection instagramUrl={null} websiteUrl={null} />)
    expect(screen.getByText(/no links/i)).toBeInTheDocument()
  })
})
