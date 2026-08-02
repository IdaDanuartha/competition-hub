import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(req: Request) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: userErr } = await supabase.auth.getUser()

    if (userErr || !user) {
      return NextResponse.json({ error: 'Unauthorized: Silakan login terlebih dahulu.' }, { status: 401 })
    }

    const { data: settings } = await supabase
      .from('user_settings')
      .select('whatsapp_number')
      .eq('id', user.id)
      .single()

    const body = await req.json().catch(() => ({}))
    const rawNumber = body.whatsapp_number || settings?.whatsapp_number

    if (!rawNumber) {
      return NextResponse.json(
        { error: 'Nomor WhatsApp belum diisi. Silakan masukkan nomor HP terlebih dahulu.' },
        { status: 400 }
      )
    }

    // Clean phone number format (remove +, spaces, dashes)
    let cleanNumber = String(rawNumber).replace(/[^0-9]/g, '')
    if (cleanNumber.startsWith('0')) {
      cleanNumber = '62' + cleanNumber.slice(1)
    }

    const fonnteToken = process.env.FONNTE_TOKEN?.replace(/^"|"$/g, '').trim()
    if (!fonnteToken) {
      console.error('[test-wa] FONNTE_TOKEN is missing in environment variables.')
      return NextResponse.json(
        { error: 'FONNTE_TOKEN belum dikonfigurasi di server env (.env).' },
        { status: 500 }
      )
    }

    const message = `🧪 [Competition Hub]\n\nIni adalah pesan uji coba pengingat WhatsApp!\n\nPengaturan WhatsApp Anda (${cleanNumber}) berhasil terhubung.`

    console.log(`[test-wa] Sending test WA to ${cleanNumber} via Fonnte...`)

    const fonnteRes = await fetch('https://api.fonnte.com/send', {
      method: 'POST',
      headers: {
        Authorization: fonnteToken,
      },
      body: new URLSearchParams({
        target: cleanNumber,
        message,
        countryCode: '62',
      }),
    })

    const fonnteData = await fonnteRes.json().catch(() => ({}))
    console.log('[test-wa] Fonnte API Response:', fonnteData)

    if (!fonnteRes.ok || fonnteData.status === false) {
      const errMsg = fonnteData.reason || fonnteData.message || fonnteData.detail || 'Fonnte menolak pengiriman pesan.'
      return NextResponse.json(
        { error: `Fonnte Error: ${errMsg}` },
        { status: 400 }
      )
    }

    return NextResponse.json({
      success: true,
      message: `Pesan uji coba WhatsApp berhasil dikirim ke ${cleanNumber}!`,
      fonnteResponse: fonnteData,
    })
  } catch (err: any) {
    console.error('[test-wa] Error sending WA test:', err)
    return NextResponse.json({ error: err?.message || 'Internal server error' }, { status: 500 })
  }
}
