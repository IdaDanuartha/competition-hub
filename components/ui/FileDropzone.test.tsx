import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { FileDropzone } from './FileDropzone'

function pdfFile(name = 'guidebook.pdf', sizeBytes = 1024) {
  const file = new File([new Uint8Array(sizeBytes)], name, { type: 'application/pdf' })
  return file
}

describe('FileDropzone', () => {
  it('accepts a valid PDF under the size limit', () => {
    const onFileSelected = vi.fn()
    render(
      <FileDropzone accept="application/pdf" maxSizeBytes={20 * 1024 * 1024} onFileSelected={onFileSelected} />
    )
    const input = screen.getByTestId('file-dropzone-input') as HTMLInputElement
    fireEvent.change(input, { target: { files: [pdfFile()] } })
    expect(onFileSelected).toHaveBeenCalledWith(expect.objectContaining({ name: 'guidebook.pdf' }))
  })

  it('rejects a non-PDF file', () => {
    const onFileSelected = vi.fn()
    render(
      <FileDropzone accept="application/pdf" maxSizeBytes={20 * 1024 * 1024} onFileSelected={onFileSelected} />
    )
    const input = screen.getByTestId('file-dropzone-input') as HTMLInputElement
    const file = new File(['x'], 'notes.docx', { type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' })
    fireEvent.change(input, { target: { files: [file] } })
    expect(onFileSelected).not.toHaveBeenCalled()
    expect(screen.getByText(/PDF/i)).toBeInTheDocument()
  })

  it('rejects a file over the size limit', () => {
    const onFileSelected = vi.fn()
    render(<FileDropzone accept="application/pdf" maxSizeBytes={10} onFileSelected={onFileSelected} />)
    const input = screen.getByTestId('file-dropzone-input') as HTMLInputElement
    fireEvent.change(input, { target: { files: [pdfFile('big.pdf', 1000)] } })
    expect(onFileSelected).not.toHaveBeenCalled()
    expect(screen.getByText(/too large/i)).toBeInTheDocument()
  })
})
