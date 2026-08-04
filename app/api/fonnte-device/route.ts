import { NextResponse } from 'next/server'

export async function GET() {
  try {
    const fonnteToken = process.env.FONNTE_TOKEN?.replace(/^"|"$/g, '').trim()
    if (!fonnteToken) {
      return NextResponse.json({ error: 'FONNTE_TOKEN belum dikonfigurasi di server.' }, { status: 400 })
    }

    const res = await fetch('https://api.fonnte.com/device', {
      method: 'POST',
      headers: { Authorization: fonnteToken },
      cache: 'no-store',
    })

    const data = await res.json().catch(() => ({}))
    const isConnected = data.device_status === 'connect' || data.device_status === 'connected'

    return NextResponse.json({
      connected: isConnected,
      device_status: data.device_status || 'disconnect',
      device: data.device || null,
      name: data.name || null,
      package: data.package || null,
      quota: data.quota || null,
      expired: data.expired || null,
      raw: data,
    })
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || 'Gagal terhubung ke Fonnte' }, { status: 500 })
  }
}
