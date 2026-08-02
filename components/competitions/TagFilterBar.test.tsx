import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { TagFilterBar } from './TagFilterBar'
import type { Competition } from '@/lib/types/database'

function comp(overrides: Partial<Competition>): Competition {
  return {
    id: overrides.id ?? '1', user_id: 'u', name: 'Comp', organizer: null, theme: null,
    status: overrides.status ?? 'researching', team_name: overrides.team_name ?? null,
    instagram_url: null, website_url: null, registration_deadline: null, submission_deadline: null,
    event_start_at: null, event_end_at: null, location: null, tags: overrides.tags ?? [],
    cloned_from_id: null, notes: null, created_at: '', updated_at: '', ...overrides,
  }
}

const rows = [
  comp({ id: '1', tags: ['hackathon'], team_name: 'REGEX', status: 'in_progress' }),
  comp({ id: '2', tags: ['ui_ux'], team_name: 'Solo', status: 'researching' }),
]

describe('TagFilterBar', () => {
  it('lists tag options derived from the competitions', () => {
    render(<TagFilterBar competitions={rows} value={{ status: [], tags: [], team: null }} onChange={() => {}} />)
    expect(screen.getByRole('checkbox', { name: 'Hackathon' })).toBeInTheDocument()
    expect(screen.getByRole('checkbox', { name: 'UI/UX Design' })).toBeInTheDocument()
  })

  it('calls onChange with the toggled tag added', async () => {
    const onChange = vi.fn()
    render(<TagFilterBar competitions={rows} value={{ status: [], tags: [], team: null }} onChange={onChange} />)
    await userEvent.click(screen.getByRole('checkbox', { name: 'Hackathon' }))
    expect(onChange).toHaveBeenCalledWith({ status: [], tags: ['hackathon'], team: null })
  })

  it('calls onChange with the tag removed when toggled off', async () => {
    const onChange = vi.fn()
    render(<TagFilterBar competitions={rows} value={{ status: [], tags: ['hackathon'], team: null }} onChange={onChange} />)
    await userEvent.click(screen.getByRole('checkbox', { name: 'Hackathon' }))
    expect(onChange).toHaveBeenCalledWith({ status: [], tags: [], team: null })
  })
})
