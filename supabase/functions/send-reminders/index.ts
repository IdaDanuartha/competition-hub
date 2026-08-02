import { createClient } from 'jsr:@supabase/supabase-js@2'

const FONNTE_TOKEN = Deno.env.get('FONNTE_TOKEN')!
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const MAX_ATTEMPTS = 3
const WINDOW_MINUTES = 15

interface DueItem {
  id: string
  title: string
  event_at: string
  reminder_offsets_minutes: number[] | null
  competition_id: string
  competitions: { name: string; user_id: string } | null
}

Deno.serve(async () => {
  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY)

  const { data: items, error } = await supabase
    .from('rundown_items')
    .select('id, title, event_at, reminder_offsets_minutes, competition_id, competitions(name, user_id)')
    .gte('event_at', new Date().toISOString())

  if (error) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500 })
  }

  const now = Date.now()
  const results: { rundown_item_id: string; status: 'sent' | 'failed' }[] = []

  for (const item of (items ?? []) as unknown as DueItem[]) {
    if (!item.competitions) continue

    const { data: settings } = await supabase
      .from('user_settings')
      .select('whatsapp_number, default_reminder_offsets_minutes, timezone')
      .eq('id', item.competitions.user_id)
      .single()

    if (!settings?.whatsapp_number) continue

    const offsets = item.reminder_offsets_minutes ?? settings.default_reminder_offsets_minutes
    const eventTime = new Date(item.event_at).getTime()

    for (const offsetMinutes of offsets) {
      const triggerAt = eventTime - offsetMinutes * 60_000
      const withinWindow = now >= triggerAt && now - triggerAt <= WINDOW_MINUTES * 60_000
      if (!withinWindow) continue

      const message = `${item.competitions.name}: ${item.title} in ${Math.round(offsetMinutes / 60)}h`

      const { data: existing } = await supabase
        .from('notification_logs')
        .select('id, status, attempt_count')
        .eq('rundown_item_id', item.id)
        .eq('message', message)
        .maybeSingle()

      if (existing && (existing.status === 'sent' || existing.attempt_count >= MAX_ATTEMPTS)) continue

      let sendStatus: 'sent' | 'failed' = 'failed'
      try {
        const res = await fetch('https://api.fonnte.com/send', {
          method: 'POST',
          headers: { Authorization: FONNTE_TOKEN },
          body: new URLSearchParams({
            target: settings.whatsapp_number,
            message,
            countryCode: '62',
          }),
        })
        sendStatus = res.ok ? 'sent' : 'failed'
      } catch {
        sendStatus = 'failed'
      }

      if (existing) {
        await supabase
          .from('notification_logs')
          .update({ status: sendStatus, attempt_count: existing.attempt_count + 1, sent_at: new Date().toISOString() })
          .eq('id', existing.id)
      } else {
        await supabase.from('notification_logs').insert({
          rundown_item_id: item.id,
          channel: 'whatsapp',
          message,
          status: sendStatus,
          attempt_count: 1,
        })
      }

      results.push({ rundown_item_id: item.id, status: sendStatus })
    }
  }

  return new Response(JSON.stringify({ processed: results.length, results }), {
    headers: { 'Content-Type': 'application/json' },
  })
})
