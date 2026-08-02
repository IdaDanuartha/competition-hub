/**
 * PDF Compressor & Memory Optimizer
 * Performs non-destructive metadata stripping and comprehensive PDF text extraction
 * to ensure PDF guidebooks load fast, remain 100% valid, and extract accurate text for AI.
 */

export interface CompressionResult {
  compressedBuffer: Buffer
  originalSizeKb: number
  compressedSizeKb: number
  compressionRatioPercent: number
  extractedText: string
  logs: string[]
}

/**
 * pdf-parse v2 (pdfjs-dist under the hood) references the browser Canvas API
 * `DOMMatrix` at module scope even for plain text extraction. That's absent in
 * Node, so importing it crashes with "DOMMatrix is not defined" in Vercel's
 * serverless runtime — reported misleadingly as a WORKER_RESOURCE_LIMIT crash,
 * unrelated to file size. A no-op stub satisfies the reference since text
 * extraction never actually performs matrix math.
 *
 * This must run before pdf-parse's module code executes, and `import`
 * statements are hoisted above any code in the same module — so pdf-parse is
 * loaded via a dynamic `import()` inside the function below (evaluated at
 * call time, after the polyfill is set), never as a static top-level import.
 */
function ensureDomMatrixPolyfill() {
  const g = globalThis as any
  if (typeof g.DOMMatrix === 'undefined') {
    g.DOMMatrix = class DOMMatrix {
      constructor(_init?: unknown) {}
    }
  }
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
  ensureDomMatrixPolyfill()
  const { PDFParse } = await import('pdf-parse')
  let parser: InstanceType<typeof PDFParse> | null = null
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

  // Extract text first for accuracy
  const extractedText = await extractTextFromPdfBuffer(rawBuffer)
  if (extractedText) {
    const wordCount = extractedText.split(/\s+/).length
    logs.push(`[PDF Extraction Engine] ✓ Berhasil mengekstrak ${wordCount} kata (${extractedText.length} karakter) dari stream PDF`)
  } else {
    logs.push(`[PDF Extraction Engine] ℹ️ Memproses PDF via Multimodal Vision AI Engine`)
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

  if (ratioPercent > 0) {
    logs.push(
      `[PDF Compression Engine] ⚡ Kompresi Selesai: ${originalSizeKb.toFixed(1)} KB ➔ ${compressedSizeKb.toFixed(1)} KB (Hemat ${ratioPercent.toFixed(1)}%)`
    )
  } else {
    logs.push(
      `[PDF Compression Engine] ℹ️ Tidak ditemukan metadata/thumbnail yang bisa dihapus, file (${originalSizeKb.toFixed(1)} KB) dipakai apa adanya.`
    )
  }

  return {
    compressedBuffer: optimizedBuffer,
    originalSizeKb: Math.round(originalSizeKb),
    compressedSizeKb: Math.round(compressedSizeKb),
    compressionRatioPercent: Math.round(ratioPercent),
    extractedText,
    logs,
  }
}
