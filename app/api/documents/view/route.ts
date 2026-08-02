import { NextResponse } from 'next/server'

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const url = searchParams.get('url')
  const name = searchParams.get('name') || 'guidebook.pdf'

  if (!url) {
    return new Response('URL required', { status: 400 })
  }

  // 1. Proxy the file through the server so the browser receives it directly
  try {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 10000)

    const fileRes = await fetch(url, { signal: controller.signal })
    clearTimeout(timeoutId)

    if (fileRes.ok) {
      const contentType = fileRes.headers.get('content-type') || 'application/octet-stream'
      const buffer = await fileRes.arrayBuffer()
      const serveAs = contentType.includes('image') ? contentType : 'application/pdf'

      return new Response(buffer, {
        headers: {
          'Content-Type': serveAs,
          'Content-Disposition': `inline; filename="${encodeURIComponent(name)}"`,
          'Cache-Control': 'public, max-age=3600',
        },
      })
    }

    console.error('[documents/view] Cloudinary responded with', fileRes.status, fileRes.statusText)
  } catch (e) {
    console.error('[documents/view] Proxy fetch failed:', e)
  }

  // 2. Fallback: redirect directly to the original URL
  return NextResponse.redirect(url, 307)
}

