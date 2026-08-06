import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { RegenerateDataModal } from './RegenerateDataModal'

vi.mock('@/components/ui/ModelSelector', () => ({
  ModelSelector: () => <div data-testid="model-selector">ModelSelector</div>,
}))

describe('RegenerateDataModal', () => {
  it('renders modal with category checkboxes when isOpen is true', () => {
    render(
      <RegenerateDataModal
        isOpen={true}
        onClose={() => {}}
        onConfirm={() => {}}
      />
    )

    expect(screen.getByText('Pilih Data yang Diperbarui')).toBeInTheDocument()
    expect(screen.getByText('Ringkasan & Tema Lomba')).toBeInTheDocument()
    expect(screen.getByText('Biaya & Syarat Pendaftaran')).toBeInTheDocument()
    expect(screen.getByText('Kriteria Penilaian & Ide Proyek')).toBeInTheDocument()
    expect(screen.getByText('Metadata & Informasi Lomba')).toBeInTheDocument()
    expect(screen.getByText('Tanggal & Batas Waktu Utama')).toBeInTheDocument()
    expect(screen.getByText('Agenda Rundown & Timeline')).toBeInTheDocument()
  })

  it('calls onConfirm with selected categories when submitted', async () => {
    const onConfirm = vi.fn()
    render(
      <RegenerateDataModal
        isOpen={true}
        onClose={() => {}}
        onConfirm={onConfirm}
      />
    )

    await userEvent.click(screen.getByRole('button', { name: /perbarui data terpilih/i }))
    expect(onConfirm).toHaveBeenCalledWith({
      preferredModel: 'gemini-3.6-flash',
      replaceFields: [
        'summary_theme',
        'fee_requirements',
        'criteria_ideas',
        'metadata',
        'dates',
        'rundown',
      ],
    })
  })
})
