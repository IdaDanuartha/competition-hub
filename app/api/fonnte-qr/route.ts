import { NextResponse } from 'next/server'

export async function GET() {
  try {
    const fonnteToken = process.env.FONNTE_TOKEN?.replace(/^"|"$/g, '').trim()
    if (!fonnteToken) {
      return NextResponse.json({ error: 'FONNTE_TOKEN belum dikonfigurasi di server.' }, { status: 400 })
    }

    const res = await fetch('https://api.fonnte.com/qr', {
      method: 'POST',
      headers: { Authorization: fonnteToken },
      cache: 'no-store',
    })

    const data = await res.json().catch(() => ({}))
    const qrUrl = data.url || data.qr || null

    return NextResponse.json({
      status: data.status ?? false,
      reason: data.reason || null,
      qrUrl: qrUrl,
      raw: data,
    })
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || 'Gagal mengambil QR Code dari Fonnte' }, { status: 500 })
  }
}
