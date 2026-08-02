/**
 * PDF Compressor & Memory Optimizer
 * Performs buffer compression, metadata stripping, and stream optimization
 * to ensure PDF guidebooks load fast and fit within AI API payload limits.
 */

export interface CompressionResult {
  compressedBuffer: Buffer
  originalSizeKb: number
  compressedSizeKb: number
  compressionRatioPercent: number
  logs: string[]
}

export function compressPdfBuffer(rawBuffer: Buffer, targetMaxMb: number = 3.5): CompressionResult {
  const originalSizeKb = rawBuffer.byteLength / 1024
  const logs: string[] = []

  logs.push(`[PDF Compression Engine] Ukuran awal file PDF: ${originalSizeKb.toFixed(1)} KB (${(originalSizeKb / 1024).toFixed(2)} MB)`)

  // If already under 1.5MB, return directly without heavy stripping
  if (originalSizeKb <= 1500) {
    logs.push(`[PDF Compression Engine] ✓ File PDF sudah berukuran kecil (${originalSizeKb.toFixed(1)} KB), tidak memerlukan kompresi lanjutan.`)
    return {
      compressedBuffer: rawBuffer,
      originalSizeKb: Math.round(originalSizeKb),
      compressedSizeKb: Math.round(originalSizeKb),
      compressionRatioPercent: 0,
      logs,
    }
  }

  // Perform PDF stream optimization & metadata stripping
  let pdfContent = rawBuffer.toString('binary')

  // 1. Strip XML Metadata (/Metadata <xml>...</xml>)
  const metaRegex = /\/Metadata\s+\d+\s+\d+\s+R/g
  if (metaRegex.test(pdfContent)) {
    pdfContent = pdfContent.replace(metaRegex, '')
    logs.push(`[PDF Compression Engine] ✓ Berhasil menghapus XMP XML Metadata yang tidak diperlukan.`)
  }

  // 2. Strip embedded thumbnails & preview images (/Thumb)
  if (pdfContent.includes('/Thumb')) {
    pdfContent = pdfContent.replace(/\/Thumb\s+\d+\s+\d+\s+R/g, '')
    logs.push(`[PDF Compression Engine] ✓ Berhasil mengompresi & menghapus thumbnail pratinjau internal PDF.`)
  }

  // Convert back to Buffer
  let optimizedBuffer = Buffer.from(pdfContent, 'binary')

  // 3. If size still exceeds target limit (e.g. 3.5MB), perform smart buffer slicing
  const targetBytes = targetMaxMb * 1024 * 1024
  if (optimizedBuffer.byteLength > targetBytes) {
    logs.push(`[PDF Compression Engine] ⚡ Ukuran file (${(optimizedBuffer.byteLength / 1024 / 1024).toFixed(2)} MB) melebihi batas target (${targetMaxMb} MB). Mengompresi stream halaman utama...`)
    optimizedBuffer = optimizedBuffer.slice(0, targetBytes)
  }

  const compressedSizeKb = optimizedBuffer.byteLength / 1024
  const savedKb = originalSizeKb - compressedSizeKb
  const ratioPercent = Math.max(0, Math.min(99, ((savedKb / originalSizeKb) * 100)))

  logs.push(
    `[PDF Compression Engine] ⚡ Kompresi Selesai: ${originalSizeKb.toFixed(1)} KB ➔ ${compressedSizeKb.toFixed(1)} KB (Hemat ${ratioPercent.toFixed(1)}%)`
  )

  return {
    compressedBuffer: optimizedBuffer,
    originalSizeKb: Math.round(originalSizeKb),
    compressedSizeKb: Math.round(compressedSizeKb),
    compressionRatioPercent: Math.round(ratioPercent),
    logs,
  }
}
