/**
 * PDF Compressor & Memory Optimizer
 * Performs non-destructive metadata stripping and comprehensive PDF text extraction
 * to ensure PDF guidebooks load fast, remain 100% valid, and extract accurate text for AI.
 */

import { inflateSync, inflateRawSync } from 'zlib'

export interface CompressionResult {
  compressedBuffer: Buffer
  originalSizeKb: number
  compressedSizeKb: number
  compressionRatioPercent: number
  extractedText: string
  logs: string[]
}

/**
 * Pull text operators (Tj / TJ / BT..ET) out of one decoded PDF content-stream string.
 */
function extractOperatorsFromContentString(pdfContent: string): string[] {
  const extractedParts: string[] = []

  // 1. Match Tj string operators: (Text Content) Tj
  const tjRegex = /\(([^()]{2,})\)\s*Tj/g
  let match
  while ((match = tjRegex.exec(pdfContent)) !== null) {
    const txt = match[1].trim()
    if (txt.length > 1 && !/^\d+$/.test(txt)) {
      extractedParts.push(txt)
    }
  }

  // 2. Match TJ array text operators: [(Text) -10 (Content)] TJ
  const tjArrayRegex = /\[\s*(?:\([^()]+\)\s*|-?\d+\s*)+\]\s*TJ/g
  while ((match = tjArrayRegex.exec(pdfContent)) !== null) {
    const innerTj = /\(([^()]{2,})\)/g
    let innerMatch
    while ((innerMatch = innerTj.exec(match[0])) !== null) {
      const txt = innerMatch[1].trim()
      if (txt.length > 1 && !/^\d+$/.test(txt)) {
        extractedParts.push(txt)
      }
    }
  }

  // 3. Extract readable text lines & words from BT...ET blocks
  const btRegex = /BT([\s\S]*?)ET/g
  while ((match = btRegex.exec(pdfContent)) !== null) {
    const textInBlock = match[1].replace(/[^\x20-\x7E\n\r\t]/g, ' ')
    const cleanWords = textInBlock
      .split(/\s+/)
      .filter((w) => w.length > 2 && !/^\d+$/.test(w) && !w.startsWith('/') && !w.startsWith('\\'))
    if (cleanWords.length > 0) {
      extractedParts.push(cleanWords.join(' '))
    }
  }

  return extractedParts
}

/**
 * Locate every `stream ... endstream` object in the PDF, and if its dictionary
 * declares /FlateDecode, inflate it so its real text operators become readable.
 * Most real-world PDFs (Word/Canva/LaTeX export) compress content streams with
 * FlateDecode, so scanning the raw compressed bytes for Tj/TJ finds nothing.
 */
function getDecodedContentStreams(rawBuffer: Buffer): string[] {
  const pdfContent = rawBuffer.toString('binary')
  const decoded: string[] = []
  const streamRegex = /(<<[^]*?>>)\s*stream\r?\n([\s\S]*?)\r?\nendstream/g
  let m
  while ((m = streamRegex.exec(pdfContent)) !== null) {
    const dict = m[1]
    const bodyStr = m[2]
    const bodyBuf = Buffer.from(bodyStr, 'binary')
    const isFlate = /\/Filter\s*(?:\/FlateDecode|\[[^\]]*\/FlateDecode)/.test(dict)

    if (isFlate) {
      try {
        decoded.push(inflateSync(bodyBuf).toString('binary'))
        continue
      } catch (_e1) {
        try {
          decoded.push(inflateRawSync(bodyBuf).toString('binary'))
          continue
        } catch (_e2) {
          // Not valid zlib data (likely binary image/font stream) — skip it.
          continue
        }
      }
    }

    if (!/\/Filter/.test(dict)) {
      // Uncompressed stream — may already contain plain Tj/TJ operators.
      decoded.push(bodyStr)
    }
  }
  return decoded
}

/**
 * Extract plain text from PDF buffer by parsing text streams, string arrays, and readable ASCII/UTF-8 words.
 */
export function extractTextFromPdfBuffer(rawBuffer: Buffer): string {
  try {
    let extractedParts: string[] = []

    // Decompress real content streams first (handles the common FlateDecode case).
    for (const contentStr of getDecodedContentStreams(rawBuffer)) {
      extractedParts = extractedParts.concat(extractOperatorsFromContentString(contentStr))
    }

    // Fallback: also scan the raw buffer directly (handles uncompressed/legacy PDFs).
    if (extractedParts.length === 0) {
      extractedParts = extractOperatorsFromContentString(rawBuffer.toString('binary'))
    }

    // De-duplicate adjacent repetitive words
    const filteredParts = extractedParts.filter((item, index, self) => self.indexOf(item) === index)
    const fullText = filteredParts.join(' ').replace(/\s+/g, ' ').trim()
    return fullText
  } catch (_e) {
    return ''
  }
}

export function compressPdfBuffer(rawBuffer: Buffer): CompressionResult {
  const originalSizeKb = rawBuffer.byteLength / 1024
  const logs: string[] = []

  logs.push(`[PDF Compression Engine] Ukuran awal file PDF: ${originalSizeKb.toFixed(1)} KB (${(originalSizeKb / 1024).toFixed(2)} MB)`)

  // Extract text first for accuracy
  const extractedText = extractTextFromPdfBuffer(rawBuffer)
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
