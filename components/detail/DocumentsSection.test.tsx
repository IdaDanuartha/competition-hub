import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import { DocumentsSection } from './DocumentsSection'
import type { CompetitionDocument } from '@/lib/types/database'

function wrapper({ children }: { children: ReactNode }) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
}

function doc(overrides: Partial<CompetitionDocument>): CompetitionDocument {
  return {
    id: '1', competition_id: 'c1', file_name: 'guidebook.pdf',
    cloudinary_public_id: 'x', cloudinary_url: 'https://res.cloudinary.com/x.pdf',
    doc_type: 'guidebook', extracted_text: null, uploaded_at: '2026-01-01T00:00:00Z',
    ...overrides,
  }
}

describe('DocumentsSection', () => {
  it('lists documents newest-first with a download link', () => {
    const docs = [
      doc({ id: '1', file_name: 'old.pdf', uploaded_at: '2026-01-01T00:00:00Z' }),
      doc({ id: '2', file_name: 'new.pdf', uploaded_at: '2026-02-01T00:00:00Z' }),
    ]
    render(<DocumentsSection competitionId="c1" documents={docs} />, { wrapper })
    const links = screen.getAllByRole('link')
    expect(links[0]).toHaveTextContent('new.pdf')
    expect(links[2]).toHaveTextContent('old.pdf') // 2 links per document item (title link + icon download link)
  })

  it('shows an empty state with the dropzone when there are no documents', () => {
    render(<DocumentsSection competitionId="c1" documents={[]} />, { wrapper })
    expect(screen.getByText(/drop a pdf/i)).toBeInTheDocument()
  })
})
