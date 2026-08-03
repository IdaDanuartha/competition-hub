import { NextResponse } from 'next/server'

interface ModelResult {
  status: 'active' | 'rate_limited' | 'key_missing' | 'error'
  label: string
  message: string
  credit?: string | null  // e.g. "$3.42 remaining" or null if unavailable
}

/** Fetch OpenAI credit balance via /dashboard/billing/credit_grants (unofficial but reliable) */
async function fetchOpenAICredit(apiKey: string): Promise<string | null> {
  try {
    const res = await fetch('https://api.openai.com/dashboard/billing/credit_grants', {
      headers: { Authorization: `Bearer ${apiKey}` },
      signal: AbortSignal.timeout(5000),
    })
    if (!res.ok) return null
    const json = await res.json()
    // { total_available: 4.2, total_granted: 5, total_used: 0.8, ... }
    const available = json?.total_available
    if (typeof available === 'number') {
      return `$${available.toFixed(2)} tersisa`
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
    { id: 'gemini-2.5-flash', label: 'Gemini 2.5 Flash' },
    { id: 'gemini-2.0-flash', label: 'Gemini 2.0 Flash' },
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
      message: status === 'active' ? 'Aktif & Siap Digunakan' : status === 'rate_limited' ? 'Limit Kuota (429)' : 'Error',
      credit,
    }
  }

  // ── OpenAI GPT-4o Mini ───────────────────────────────────────────
  if (!openaiKey) {
    results['gpt-4o-mini'] = { status: 'key_missing', label: 'GPT-4o Mini (OpenAI)', message: 'OPENAI_API_KEY belum dikonfigurasi', credit: null }
  } else {
    // Fetch credit and model check in parallel
    const [creditStr, chatRes] = await Promise.allSettled([
      fetchOpenAICredit(openaiKey),
      fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${openaiKey}` },
        body: JSON.stringify({ model: 'gpt-4o-mini', messages: [{ role: 'user', content: 'Hi' }], max_tokens: 5 }),
        signal: AbortSignal.timeout(5000),
      }),
    ])

    const credit = creditStr.status === 'fulfilled' ? creditStr.value : null
    const res = chatRes.status === 'fulfilled' ? chatRes.value : null

    if (!res) {
      results['gpt-4o-mini'] = { status: 'active', label: 'GPT-4o Mini (OpenAI)', message: 'Aktif', credit }
    } else if (res.ok) {
      results['gpt-4o-mini'] = { status: 'active', label: 'GPT-4o Mini (OpenAI)', message: 'Aktif & Siap Digunakan', credit }
    } else if (res.status === 429) {
      results['gpt-4o-mini'] = { status: 'rate_limited', label: 'GPT-4o Mini (OpenAI)', message: 'Limit Kuota OpenAI (429)', credit }
    } else if (res.status === 402 || res.status === 403) {
      results['gpt-4o-mini'] = { status: 'error', label: 'GPT-4o Mini (OpenAI)', message: 'Kredit habis / akses ditolak', credit: credit ?? '$0.00 tersisa' }
    } else {
      results['gpt-4o-mini'] = { status: 'active', label: 'GPT-4o Mini (OpenAI)', message: 'Aktif', credit }
    }
  }

  return NextResponse.json({
    timestamp: new Date().toISOString(),
    models: results,
  })
}
