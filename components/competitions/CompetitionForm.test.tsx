import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { CompetitionForm } from './CompetitionForm'

describe('CompetitionForm', () => {
  it('shows a validation error and does not submit when name is empty', async () => {
    const onSubmit = vi.fn()
    render(<CompetitionForm onSubmit={onSubmit} submitLabel="Create" />)
    await userEvent.click(screen.getByRole('button', { name: 'Create' }))
    expect(await screen.findByText(/name is required/i)).toBeInTheDocument()
    expect(onSubmit).not.toHaveBeenCalled()
  })

  it('submits parsed values when the form is valid', async () => {
    const onSubmit = vi.fn()
    render(<CompetitionForm onSubmit={onSubmit} submitLabel="Create" />)
    await userEvent.type(screen.getByLabelText(/^name/i), 'BYTESFEST 2026')
    await userEvent.click(screen.getByRole('button', { name: 'Create' }))
    expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({ name: 'BYTESFEST 2026' }))
  })

  it('pre-fills fields from defaultValues', () => {
    render(<CompetitionForm onSubmit={() => {}} submitLabel="Save" defaultValues={{ name: 'Existing Comp' }} />)
    expect(screen.getByLabelText(/^name/i)).toHaveValue('Existing Comp')
  })
})
