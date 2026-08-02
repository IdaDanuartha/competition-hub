import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { AiSummaryCard } from './AiSummaryCard'
import type { AiSummary } from '@/lib/types/database'

const mockSummary: AiSummary = {
  id: 's1',
  competition_id: 'c1',
  summary: 'This competition is about building AI tools.',
  key_requirements: ['Team of 1-3 people', 'PDF submission max 10 pages'],
  important_dates: ['Submission deadline: Sept 1'],
  judging_criteria: ['Innovation (40%)', 'Feasibility (60%)'],
  theme_and_subtheme: 'AI & Web Development',
  project_idea_suggestions: [
    { title: 'Idea Alpha', description: 'Web app for tracking', rationale: 'Matches innovation criteria' }
  ],
  model_used: 'gemini-3.6-flash',
  execution_log: [],
  execution_time_ms: null,
  pdf_size_kb: null,
  created_at: '',
  updated_at: '',
}

vi.mock('@/hooks/usePortfolio', () => ({
  usePortfolio: () => ({ data: [] }),
}))

describe('AiSummaryCard', () => {
  it('renders summary details and model badge', () => {
    render(<AiSummaryCard summary={mockSummary} isLoading={false} onRegenerate={() => {}} />)
    expect(screen.getByText(/This competition is about building AI tools./i)).toBeInTheDocument()
    expect(screen.getByText(/gemini-3.6-flash/i)).toBeInTheDocument()
    expect(screen.getByText(/Idea Alpha/i)).toBeInTheDocument()
  })

  it('triggers onRegenerate when Regenerate button is clicked', async () => {
    const onRegenerate = vi.fn()
    render(<AiSummaryCard summary={mockSummary} isLoading={false} onRegenerate={onRegenerate} />)
    await userEvent.click(screen.getByRole('button', { name: /regenerate/i }))
    expect(onRegenerate).toHaveBeenCalled()
  })
})
