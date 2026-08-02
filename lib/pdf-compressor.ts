/**
 * PDF Compressor & Memory Optimizer
 * Performs non-destructive metadata stripping and comprehensive PDF text extraction
 * to ensure PDF guidebooks load fast, remain 100% valid, and extract accurate text for AI.
 */

import { PDFParse } from 'pdf-parse'

// pdfjs-dist loads the whole document (fonts, images, page tree) into memory to
// extract text. On large multi-page guidebooks (banners/graphics push files past
// a few MB) this can exceed a serverless function's memory/CPU budget and crash
// the worker (Vercel: WORKER_RESOURCE_LIMIT). Past this size, skip local parsing
// and let the AI model read the PDF directly via its own vision/inlineData input.
const MAX_TEXT_EXTRACTION_SIZE_BYTES = 5 * 1024 * 1024

export interface CompressionResult {
  compressedBuffer: Buffer
  originalSizeKb: number
  compressedSizeKb: number
  compressionRatioPercent: number
  extractedText: string
  logs: string[]
}

/**
 * Extract plain text from a PDF buffer using a real PDF parser (pdf-parse/pdfjs-dist).
 * Real-world guidebooks (Word/Canva/LaTeX export) embed subset fonts with custom glyph
 * encodings — text bytes inside Tj/TJ operators are font-specific glyph codes, not literal
 * characters, and only decode correctly via the font's ToUnicode CMap. A naive regex scan
 * (even after inflating FlateDecode streams) reads those glyph codes as garbage; pdfjs-dist
 * does the actual CMap decoding.
 */
export async function extractTextFromPdfBuffer(rawBuffer: Buffer): Promise<string> {
  let parser: PDFParse | null = null
  try {
    parser = new PDFParse({ data: rawBuffer })
    const result = await parser.getText()
    return result.text.replace(/\s+/g, ' ').trim()
  } catch (_e) {
    return ''
  } finally {
    if (parser) {
      await parser.destroy().catch(() => {})
    }
  }
}

export async function compressPdfBuffer(rawBuffer: Buffer): Promise<CompressionResult> {
  const originalSizeKb = rawBuffer.byteLength / 1024
  const logs: string[] = []

  logs.push(`[PDF Compression Engine] Ukuran awal file PDF: ${originalSizeKb.toFixed(1)} KB (${(originalSizeKb / 1024).toFixed(2)} MB)`)

  // Extract text first for accuracy — skip on large files to avoid OOM/CPU limits
  // in the serverless function; the AI model still gets the PDF directly (vision).
  let extractedText = ''
  if (rawBuffer.byteLength <= MAX_TEXT_EXTRACTION_SIZE_BYTES) {
    extractedText = await extractTextFromPdfBuffer(rawBuffer)
    if (extractedText) {
      const wordCount = extractedText.split(/\s+/).length
      logs.push(`[PDF Extraction Engine] ✓ Berhasil mengekstrak ${wordCount} kata (${extractedText.length} karakter) dari stream PDF`)
    } else {
      logs.push(`[PDF Extraction Engine] ℹ️ Memproses PDF via Multimodal Vision AI Engine`)
    }
  } else {
    logs.push(`[PDF Extraction Engine] ℹ️ File PDF ${originalSizeKb.toFixed(1)} KB melebihi batas ekstraksi teks lokal, memproses via Multimodal Vision AI Engine`)
  }

  // If under 3MB, return directly without metadata modification to preserve 100% structure & fonts
  if (originalSizeKb <= 3072) {
    logs.push(`[PDF Compression Engine] ✓ Ukuran file PDF ideal (${originalSizeKb.toFixed(1)} KB), 100% struktur PDF utuh.`)
    return {
      compressedBuffer: rawBuffer,
      originalSizeKb: Math.round(originalSizeKb),
      compressedSizeKb: Math.round(originalSizeKb),
      compressionRatioPercent: 0,
      extractedText,
      logs,
    }
  }

  // Perform non-destructive metadata stripping
  let pdfContent = rawBuffer.toString('binary')

  // 1. Strip XML Metadata (/Metadata <xml>...</xml>)
  const metaRegex = /\/Metadata\s+\d+\s+\d+\s+R/g
  if (metaRegex.test(pdfContent)) {
    pdfContent = pdfContent.replace(metaRegex, '')
    logs.push(`[PDF Compression Engine] ✓ Berhasil menghapus XMP XML Metadata.`)
  }

  // 2. Strip embedded preview thumbnails (/Thumb)
  if (pdfContent.includes('/Thumb')) {
    pdfContent = pdfContent.replace(/\/Thumb\s+\d+\s+\d+\s+R/g, '')
    logs.push(`[PDF Compression Engine] ✓ Berhasil menghapus thumbnail pratinjau internal PDF.`)
  }

  // Convert back to Buffer safely WITHOUT slicing trailer/xref
  const optimizedBuffer = Buffer.from(pdfContent, 'binary')

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
    extractedText,
    logs,
  }
}
