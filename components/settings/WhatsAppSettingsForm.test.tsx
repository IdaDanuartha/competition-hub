import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { WhatsAppSettingsForm } from './WhatsAppSettingsForm'

describe('WhatsAppSettingsForm', () => {
  it('rejects a malformed phone number', async () => {
    const onSubmit = vi.fn()
    render(<WhatsAppSettingsForm defaultNumber="" defaultOffsets={[1440, 180]} onSubmit={onSubmit} />)
    await userEvent.type(screen.getByLabelText(/whatsapp number/i), '0812345')
    await userEvent.click(screen.getByRole('button', { name: /save/i }))
    expect(await screen.findByText(/use format/i)).toBeInTheDocument()
    expect(onSubmit).not.toHaveBeenCalled()
  })

  it('submits a valid number in 62xxxxxxxxxx format', async () => {
    const onSubmit = vi.fn()
    render(<WhatsAppSettingsForm defaultNumber="" defaultOffsets={[1440, 180]} onSubmit={onSubmit} />)
    await userEvent.type(screen.getByLabelText(/whatsapp number/i), '6281234567890')
    await userEvent.click(screen.getByRole('button', { name: /save/i }))
    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({ whatsapp_number: '6281234567890' })
    )
  })
})
