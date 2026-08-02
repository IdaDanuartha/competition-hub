'use client'

import { useRef, useState, type DragEvent } from 'react'
import { Upload } from 'lucide-react'
import { cn } from '@/lib/cn'

interface FileDropzoneProps {
  accept: string
  maxSizeBytes: number
  onFileSelected: (file: File) => void
  disabled?: boolean
}

function validate(file: File, accept: string, maxSizeBytes: number): string | null {
  if (file.type !== accept) return 'Only PDF files are accepted.'
  if (file.size > maxSizeBytes) return `File is too large (max ${Math.round(maxSizeBytes / 1024 / 1024)}MB).`
  return null
}

export function FileDropzone({ accept, maxSizeBytes, onFileSelected, disabled }: FileDropzoneProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [error, setError] = useState<string | null>(null)
  const [isDragging, setIsDragging] = useState(false)

  function handleFile(file: File | undefined) {
    if (!file) return
    const validationError = validate(file, accept, maxSizeBytes)
    if (validationError) {
      setError(validationError)
      return
    }
    setError(null)
    onFileSelected(file)
  }

  return (
    <div
      onDragOver={(e: DragEvent) => {
        e.preventDefault()
        setIsDragging(true)
      }}
      onDragLeave={() => setIsDragging(false)}
      onDrop={(e: DragEvent) => {
        e.preventDefault()
        setIsDragging(false)
        handleFile(e.dataTransfer.files?.[0])
      }}
      onClick={() => !disabled && inputRef.current?.click()}
      className={cn(
        'flex cursor-pointer flex-col items-center gap-2 rounded-lg border-2 border-dashed border-zinc-300 p-6 text-center text-sm text-zinc-500 dark:border-zinc-700 dark:text-zinc-400',
        isDragging && 'border-zinc-500 bg-zinc-50 dark:bg-zinc-900',
        disabled && 'cursor-not-allowed opacity-50'
      )}
    >
      <Upload className="h-5 w-5" />
      {!error && <span>Drop a PDF here, or click to browse</span>}
      <input
        ref={inputRef}
        data-testid="file-dropzone-input"
        type="file"
        accept={accept}
        disabled={disabled}
        className="hidden"
        onChange={(e) => handleFile(e.target.files?.[0])}
      />
      {error && <p className="text-red-600">{error}</p>}
    </div>
  )
}
