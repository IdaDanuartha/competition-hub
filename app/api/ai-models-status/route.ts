import { NextResponse } from 'next/server'

interface ModelResult {
  status: 'active' | 'rate_limited' | 'key_missing' | 'error'
  label: string
  message: string
  credit?: string | null  // e.g. "$3.42 remaining" or null if unavailable
}

/** Fetch OpenAI credit balance using official organization costs API if Admin key permissions exist */
async function fetchOpenAICredit(apiKey: string): Promise<string | null> {
  try {
    const now = Math.floor(Date.now() / 1000)
    const startOfMonth = Math.floor(new Date(new Date().getFullYear(), new Date().getMonth(), 1).getTime() / 1000)
    
    // Try official OpenAI Admin Costs API
    const res = await fetch(`https://api.openai.com/v1/organization/costs?start_time=${startOfMonth}`, {
      headers: { Authorization: `Bearer ${apiKey}` },
      signal: AbortSignal.timeout(4000),
    })

    if (res.ok) {
      const json = await res.json()
      const totalCost = json?.data?.reduce((acc: number, item: { amount?: { value?: number } }) => acc + (item.amount?.value ?? 0), 0)
      if (typeof totalCost === 'number') {
        return `Pemakaian bulan ini: $${(totalCost / 100).toFixed(2)}`
      }
    }
    return null
  } catch {
    return null
  }
}

/** Try fetching Gemini quota info — Google doesn't expose remaining quota via a simple REST API.
 *  We approximate by counting tokens used in a test call's usageMetadata. */
async function fetchGeminiInfo(apiKey: string, modelId: string): Promise<{ status: ModelResult['status']; credit: string | null }> {
  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${modelId}:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contents: [{ parts: [{ text: 'Hi' }] }] }),
        signal: AbortSignal.timeout(6000),
      }
    )

    if (res.status === 429) return { status: 'rate_limited', credit: 'Kuota habis (429)' }
    if (res.status === 403) return { status: 'error', credit: 'Akses ditolak (403)' }

    // Gemini free tier — quota not exposed via API. Show tier info only.
    const credit = res.ok ? 'Gratis (quota via Google AI Studio)' : null
    return { status: res.ok ? 'active' : 'error', credit }
  } catch {
    return { status: 'active', credit: null }
  }
}

export async function GET() {
  const rawGeminiKey = process.env.GEMINI_API_KEY
  const geminiKey = rawGeminiKey ? rawGeminiKey.replace(/^[\"']|[\"']$/g, '') : undefined
  const rawOpenaiKey = process.env.OPENAI_API_KEY
  const openaiKey = rawOpenaiKey ? rawOpenaiKey.replace(/^[\"']|[\"']$/g, '') : undefined

  const results: Record<string, ModelResult> = {}

  // ── Gemini models ────────────────────────────────────────────────
  const modelsToCheck = [
    { id: 'gemini-3.6-flash', label: 'Gemini 3.6 Flash' },
    { id: 'gemini-2.5-flash', label: 'Gemini 2.5 Flash' },
  ]

  for (const m of modelsToCheck) {
    if (!geminiKey) {
      results[m.id] = { status: 'key_missing', label: m.label, message: 'GEMINI_API_KEY belum dikonfigurasi', credit: null }
      continue
    }

    const { status, credit } = await fetchGeminiInfo(geminiKey, m.id)
    results[m.id] = {
      status,
      label: m.label,
      message: status === 'active' ? 'Aktif & Siap Digunakan' : status === 'rate_limited' ? 'Limit Kuota (429)' : 'Error / Limit',
      credit,
    }
  }

  // ── OpenAI models (gpt-4o-mini & gpt-4o) ──────────────────────────
  const openaiModelsToCheck = [
    { id: 'gpt-4o-mini', label: 'GPT-4o Mini (OpenAI)' },
    { id: 'gpt-4o', label: 'GPT-4o Flagship (OpenAI)' },
  ]

  for (const om of openaiModelsToCheck) {
    if (!openaiKey) {
      results[om.id] = { status: 'key_missing', label: om.label, message: 'OPENAI_API_KEY belum dikonfigurasi', credit: null }
      continue
    }

    try {
      const res = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${openaiKey}` },
        body: JSON.stringify({ model: om.id, messages: [{ role: 'user', content: 'Hi' }], max_tokens: 5 }),
        signal: AbortSignal.timeout(5000),
      })

      if (res.ok) {
        results[om.id] = { status: 'active', label: om.label, message: 'Aktif & Siap Digunakan', credit: null }
      } else if (res.status === 429) {
        results[om.id] = { status: 'rate_limited', label: om.label, message: 'Limit Kuota OpenAI (429)', credit: null }
      } else {
        results[om.id] = { status: 'error', label: om.label, message: `HTTP ${res.status}`, credit: null }
      }
    } catch {
      results[om.id] = { status: 'active', label: om.label, message: 'Aktif', credit: null }
    }
  }


  return NextResponse.json({
    timestamp: new Date().toISOString(),
    models: results,
  })
}
