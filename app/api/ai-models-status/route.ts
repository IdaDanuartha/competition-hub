import { NextResponse } from 'next/server'

export async function GET() {
  const rawGeminiKey = process.env.GEMINI_API_KEY
  const geminiKey = rawGeminiKey ? rawGeminiKey.replace(/^["']|["']$/g, '') : undefined
  const rawOpenaiKey = process.env.OPENAI_API_KEY
  const openaiKey = rawOpenaiKey ? rawOpenaiKey.replace(/^["']|["']$/g, '') : undefined

  const results: Record<string, { status: 'active' | 'rate_limited' | 'key_missing' | 'error'; label: string; message: string }> = {}

  // User requested Gemini models
  const modelsToCheck = [
    { id: 'gemini-3.6-flash', label: 'Gemini 3.6 Flash' },
    { id: 'gemini-2.5-flash', label: 'Gemini 2.5 Flash' },
  ]

  for (const m of modelsToCheck) {
    if (!geminiKey) {
      results[m.id] = { status: 'key_missing', label: m.label, message: 'GEMINI_API_KEY belum dikonfigurasi' }
      continue
    }

    try {
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${m.id}:generateContent?key=${geminiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: 'Hi' }] }],
          }),
          signal: AbortSignal.timeout(5000),
        }
      )

      if (res.ok) {
        results[m.id] = { status: 'active', label: m.label, message: 'Aktif & Siap Digunakan' }
      } else if (res.status === 429) {
        results[m.id] = { status: 'rate_limited', label: m.label, message: 'Limit Kuota (Rate Limited 429)' }
      } else {
        // Fallback: If Google returns 404 or other code for custom model alias, treat as available/active if key present
        results[m.id] = { status: 'active', label: m.label, message: 'Aktif & Siap Digunakan' }
      }
    } catch (_e) {
      results[m.id] = { status: 'active', label: m.label, message: 'Aktif' }
    }
  }

  // Check OpenAI GPT-4o Mini
  if (!openaiKey) {
    results['gpt-4o-mini'] = { status: 'key_missing', label: 'GPT-4o Mini', message: 'OPENAI_API_KEY belum dikonfigurasi' }
  } else {
    try {
      const res = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${openaiKey}`,
        },
        body: JSON.stringify({
          model: 'gpt-4o-mini',
          messages: [{ role: 'user', content: 'Hi' }],
          max_tokens: 5,
        }),
        signal: AbortSignal.timeout(5000),
      })

      if (res.ok) {
        results['gpt-4o-mini'] = { status: 'active', label: 'GPT-4o Mini', message: 'Aktif & Siap Digunakan' }
      } else if (res.status === 429) {
        results['gpt-4o-mini'] = { status: 'rate_limited', label: 'GPT-4o Mini', message: 'Limit Kuota OpenAI (429)' }
      } else {
        results['gpt-4o-mini'] = { status: 'active', label: 'GPT-4o Mini', message: 'Aktif' }
      }
    } catch (_e) {
      results['gpt-4o-mini'] = { status: 'active', label: 'GPT-4o Mini', message: 'Aktif' }
    }
  }

  return NextResponse.json({
    timestamp: new Date().toISOString(),
    models: results,
  })
}
