import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ExportDataButton } from './ExportDataButton'

const exportData = vi.fn()
vi.mock('@/hooks/useDataExport', () => ({
  useDataExport: () => ({ exportData, isExporting: false }),
}))

describe('ExportDataButton', () => {
  it('triggers exportData on click', async () => {
    render(<ExportDataButton />)
    await userEvent.click(screen.getByRole('button', { name: /export all data/i }))
    expect(exportData).toHaveBeenCalled()
  })
})
