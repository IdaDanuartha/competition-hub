import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export async function GET(req: Request) {
  return handleSendReminders(req)
}

export async function POST(req: Request) {
  return handleSendReminders(req)
}

async function handleSendReminders(req: Request) {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    const fonnteToken = process.env.FONNTE_TOKEN?.replace(/^"|"$/g, '').trim()

    if (!supabaseUrl || !serviceRoleKey) {
      return NextResponse.json({ error: 'Supabase URL or Service Role Key missing' }, { status: 500 })
    }

    if (!fonnteToken) {
      return NextResponse.json({ error: 'FONNTE_TOKEN is missing' }, { status: 500 })
    }

    // Use Admin client to process all users' upcoming rundown items
    const adminSupabase = createClient(supabaseUrl, serviceRoleKey)

    const now = new Date()
    const nowMs = now.getTime()

    // 1. Query upcoming & recent rundown items (from past 2 days to future)
    const { data: items, error: fetchErr } = await adminSupabase
      .from('rundown_items')
      .select('id, title, description, event_at, reminder_offsets_minutes, competition_id, competitions(name, user_id)')
      .gte('event_at', new Date(nowMs - 48 * 3600_000).toISOString())
      .order('event_at', { ascending: true })

    if (fetchErr) {
      console.error('[send-reminders cron] DB Error:', fetchErr)
      return NextResponse.json({ error: fetchErr.message }, { status: 500 })
    }

    const processedLogs: any[] = []

    for (const item of (items ?? []) as any[]) {
      const comp = item.competitions
      if (!comp?.user_id) continue

      // 2. Fetch user settings for WhatsApp number and default offsets
      const { data: settings } = await adminSupabase
        .from('user_settings')
        .select('whatsapp_number, default_reminder_offsets_minutes')
        .eq('id', comp.user_id)
        .single()

      if (!settings?.whatsapp_number) continue

      let cleanNumber = String(settings.whatsapp_number).replace(/[^0-9]/g, '')
      if (cleanNumber.startsWith('0')) {
        cleanNumber = '62' + cleanNumber.slice(1)
      }

      // Default offsets: e.g. 1 day (1440 mins), 3 days (4320 mins), 7 days (10080 mins)
      const offsets: number[] = item.reminder_offsets_minutes ?? settings.default_reminder_offsets_minutes ?? [1440, 4320, 10080]
      const eventTimeMs = new Date(item.event_at).getTime()

      for (const offsetMins of offsets) {
        const triggerTimeMs = eventTimeMs - offsetMins * 60_000

        // A reminder is due if:
        // 1. The trigger time has arrived (nowMs >= triggerTimeMs)
        // 2. The event hasn't already passed by more than 24 hours (eventTimeMs >= nowMs - 24 * 3600_000)
        const isDue = nowMs >= triggerTimeMs && eventTimeMs >= nowMs - 24 * 3600_000

        if (!isDue) continue

        // Format offset nicely for message
        let timeLabel = `${offsetMins} menit`
        if (offsetMins >= 1440) {
          const days = Math.round(offsetMins / 1440)
          timeLabel = `${days} hari`
        } else if (offsetMins >= 60) {
          const hours = Math.round(offsetMins / 60)
          timeLabel = `${hours} jam`
        }

        const dateFormatted = new Date(item.event_at).toLocaleString('id-ID', {
          dateStyle: 'full',
          timeStyle: 'short',
        })

        const message = `⏰ *[PENGINGAT LOMBA]*\n\n🏆 *${comp.name}*\n📅 *${item.title}*\n⏱️ *Jadwal:* ${dateFormatted}\n\n📢 *Pengingat:* Agenda H-${timeLabel} sebelum batas waktu.\n\nSemangat mempersiapkan!`

        // 3. Check if this exact reminder was already logged/sent
        const { data: existing } = await adminSupabase
          .from('notification_logs')
          .select('id, status, attempt_count')
          .eq('rundown_item_id', item.id)
          .eq('message', message)
          .maybeSingle()

        if (existing && (existing.status === 'sent' || existing.attempt_count >= 3)) {
          continue
        }

        // 4. Send WhatsApp via Fonnte API
        let sendStatus: 'sent' | 'failed' = 'failed'
        let apiError: string | null = null

        try {
          const fonnteRes = await fetch('https://api.fonnte.com/send', {
            method: 'POST',
            headers: { Authorization: fonnteToken },
            body: new URLSearchParams({
              target: cleanNumber,
              message,
              countryCode: '62',
            }),
          })

          const fonnteData = await fonnteRes.json().catch(() => ({}))
          if (fonnteRes.ok && fonnteData.status !== false) {
            sendStatus = 'sent'
          } else {
            apiError = fonnteData.reason || fonnteData.message || 'Fonnte error'
          }
        } catch (e: any) {
          apiError = e?.message || 'Network fetch error'
        }

        // 5. Insert or update notification_logs table
        if (existing) {
          await adminSupabase
            .from('notification_logs')
            .update({
              status: sendStatus,
              attempt_count: existing.attempt_count + 1,
              sent_at: new Date().toISOString(),
            })
            .eq('id', existing.id)
        } else {
          await adminSupabase.from('notification_logs').insert({
            rundown_item_id: item.id,
            channel: 'whatsapp',
            message,
            status: sendStatus,
            attempt_count: 1,
            sent_at: new Date().toISOString(),
          })
        }

        processedLogs.push({
          competition: comp.name,
          title: item.title,
          target: cleanNumber,
          offset: timeLabel,
          status: sendStatus,
          error: apiError,
        })
      }
    }

    return NextResponse.json({
      timestamp: new Date().toISOString(),
      processedCount: processedLogs.length,
      logs: processedLogs,
    })
  } catch (err: any) {
    console.error('[send-reminders cron] Unhandled error:', err)
    return NextResponse.json({ error: err?.message || 'Internal server error' }, { status: 500 })
  }
}
