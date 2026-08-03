import { NextResponse } from 'next/server'
import { getEffectiveApiKeys } from '@/lib/get-api-keys'
import type { DiscoveredCompetition } from '@/lib/discover'

const SYSTEM_PROMPT = `You are a research assistant that finds real, currently open or upcoming competitions, hackathons, and contests using Google Search.

Search the web for real competitions matching the user's keywords. Only include competitions you can find genuine evidence for via search results — never invent one. Prefer competitions that are currently open for registration or upcoming (not ones that have already ended).

For each competition found, extract:
- name: official competition name
- organizer: organizing body/institution, or null if unclear
- theme: the competition's theme or main focus, or null if unclear
- tags: 2-5 short category tags (e.g. "hackathon", "AI", "mahasiswa", "design")
- website_url: the official website or registration page URL
- registration_deadline: ISO 8601 date string if a registration deadline is stated, else null
- submission_deadline: ISO 8601 date string if a submission deadline is stated, else null
- summary_snippet: 1-2 sentence summary of what the competition is about

Return ONLY a valid JSON object matching this schema, with no markdown fences:
{
  "results": [
    {
      "name": "string",
      "organizer": "string or null",
      "theme": "string or null",
      "tags": ["string"],
      "website_url": "string or null",
      "registration_deadline": "ISO 8601 string or null",
      "submission_deadline": "ISO 8601 string or null",
      "summary_snippet": "string"
    }
  ]
}

If nothing relevant is found, return { "results": [] }.`

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}))
    const keywords = typeof body.keywords === 'string' ? body.keywords.trim() : ''
    const preferred_model = body.preferred_model || body.preferredModel

    if (!keywords) {
      return NextResponse.json({ error: 'keywords required' }, { status: 400 })
    }

    const currentDateObj = new Date()
    const currentYear = currentDateObj.getFullYear()
    const todayIso = currentDateObj.toISOString().split('T')[0] // e.g. "2026-08-04"

    const systemPrompt = `You are a research assistant that finds real, currently OPEN or UPCOMING competitions, hackathons, and contests.

CRITICAL DATE & YEAR CONSTRAINTS:
- Today's date is ${todayIso} (Year ${currentYear}).
- You MUST ONLY search for and return competitions that are CURRENTLY OPEN for registration or UPCOMING in ${currentYear} or ${currentYear + 1}.
- ABSOLUTELY DO NOT return any competition from past years (such as 2021, 2022, 2023, 2024, or 2025) or competitions whose deadlines have ALREADY PASSED before ${todayIso}.
- Every returned competition MUST have a registration deadline or submission deadline that is in the FUTURE (on or after ${todayIso}).
- Never invent deadlines. If unsure of exact date, state the estimated future month in ${currentYear}.

For each competition found, extract:
- name: official competition name (MUST be currently active in ${currentYear})
- organizer: organizing body/institution, or null if unclear
- theme: the competition's theme or main focus, or null if unclear
- tags: 2-5 short category tags (e.g. "hackathon", "AI", "mahasiswa", "design")
- website_url: official website or registration page URL
- registration_deadline: ISO 8601 date string of the FUTURE registration deadline, or null if unspecified
- submission_deadline: ISO 8601 date string of the FUTURE submission deadline, or null if unspecified
- summary_snippet: 1-2 sentence summary of what the competition is about

Return ONLY a valid JSON object matching this schema, with no markdown fences:
{
  "results": [
    {
      "name": "string",
      "organizer": "string or null",
      "theme": "string or null",
      "tags": ["string"],
      "website_url": "string or null",
      "registration_deadline": "ISO 8601 string or null",
      "submission_deadline": "ISO 8601 string or null",
      "summary_snippet": "string"
    }
  ]
}

If nothing relevant is currently open in ${currentYear}, return { "results": [] }.`

    const { geminiKeys, openaiKey } = await getEffectiveApiKeys()

    if (geminiKeys.length === 0 && !openaiKey) {
      return NextResponse.json(
        { error: 'Fitur ini membutuhkan Gemini atau OpenAI API Key. Silakan tambahkan API key di Settings.' },
        { status: 400 }
      )
    }

    const userPromptText = `Find real, currently open or upcoming competitions in ${currentYear} matching these keywords: "${keywords}". Ensure all deadlines are in ${currentYear} or ${currentYear + 1} and NOT expired.`

    let geminiModels = ['gemini-2.5-flash', 'gemini-1.5-flash', 'gemini-2.0-flash']
    if (preferred_model && preferred_model.startsWith('gemini')) {
      geminiModels = [preferred_model, ...geminiModels.filter((m) => m !== preferred_model)]
    }

    let parsedResult: { results: DiscoveredCompetition[] } | null = null
    let modelUsed = preferred_model || 'gemini-2.5-flash'
    let lastErrorMessage = 'Gagal mencari kompetisi'

    // Attempt 1: Gemini with Google Search Grounding
    if (geminiKeys.length > 0) {
      for (let keyIdx = 0; keyIdx < geminiKeys.length; keyIdx++) {
        const currentGeminiKey = geminiKeys[keyIdx]

        for (const modelName of geminiModels) {
          try {
            const res = await fetch(
              `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${currentGeminiKey}`,
              {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  systemInstruction: { parts: [{ text: systemPrompt }] },
                  contents: [{ parts: [{ text: userPromptText }] }],
                  tools: [{ google_search: {} }],
                  generationConfig: { responseMimeType: 'application/json' },
                }),
                signal: AbortSignal.timeout(25000),
              }
            )

            if (res.ok) {
              const data = await res.json()
              const rawText = data.candidates?.[0]?.content?.parts?.[0]?.text
              if (rawText) {
                parsedResult = JSON.parse(rawText)
                modelUsed = modelName
                break
              }
            } else if (res.status === 429) {
              lastErrorMessage = `Rate limit (HTTP 429) pada key #${keyIdx + 1}. Mencoba failover...`
              await new Promise((r) => setTimeout(r, 400))
            } else {
              lastErrorMessage = `Model ${modelName} mengembalikan HTTP status ${res.status}`
            }
          } catch (e: any) {
            lastErrorMessage = e?.message || 'Timeout'
          }
        }

        if (parsedResult) break
      }
    }

    // Attempt 2: Fallback without google_search tool if Grounding hit 429 Rate Limit
    if (!parsedResult && geminiKeys.length > 0) {
      for (let keyIdx = 0; keyIdx < geminiKeys.length; keyIdx++) {
        const currentGeminiKey = geminiKeys[keyIdx]
        try {
          const res = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${currentGeminiKey}`,
            {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                systemInstruction: { parts: [{ text: systemPrompt }] },
                contents: [{ parts: [{ text: userPromptText }] }],
                generationConfig: { responseMimeType: 'application/json' },
              }),
              signal: AbortSignal.timeout(25000),
            }
          )

          if (res.ok) {
            const data = await res.json()
            const rawText = data.candidates?.[0]?.content?.parts?.[0]?.text
            if (rawText) {
              parsedResult = JSON.parse(rawText)
              modelUsed = 'gemini-2.5-flash (knowledge)'
              break
            }
          }
        } catch {}
      }
    }

    // Attempt 3: OpenAI Fallback if available
    if (!parsedResult && openaiKey) {
      try {
        const res = await fetch('https://api.openai.com/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${openaiKey}`,
          },
          body: JSON.stringify({
            model: 'gpt-4o-mini',
            messages: [
              { role: 'system', content: systemPrompt },
              { role: 'user', content: userPromptText },
            ],
            response_format: { type: 'json_object' },
          }),
          signal: AbortSignal.timeout(25000),
        })

        if (res.ok) {
          const data = await res.json()
          const rawText = data.choices?.[0]?.message?.content
          if (rawText) {
            parsedResult = JSON.parse(rawText)
            modelUsed = 'gpt-4o-mini'
          }
        }
      } catch {}
    }

    if (!parsedResult) {
      return NextResponse.json(
        {
          error:
            'Batas kuota / Rate limit (HTTP 429) Gemini API tercapai pada seluruh key. Mohon tunggu ~10 detik dan klik "Coba lagi".',
        },
        { status: 429 }
      )
    }

    // Post-fetch Filter: Strictly remove past year competitions and expired deadlines
    const rawItems = Array.isArray(parsedResult.results) ? parsedResult.results : []
    const activeResults = rawItems.filter((item) => {
      // 1. Filter out if title or summary explicitly contains past years (2020-2025)
      const textToTest = `${item.name || ''} ${item.summary_snippet || ''}`
      if (/\b(2020|2021|2022|2023|2024|2025)\b/.test(textToTest)) {
        return false
      }

      // 2. Filter out if deadlines are in the past
      const regDate = item.registration_deadline ? item.registration_deadline.slice(0, 10) : null
      const subDate = item.submission_deadline ? item.submission_deadline.slice(0, 10) : null

      if (regDate && regDate < todayIso && subDate && subDate < todayIso) {
        return false
      }

      return true
    })

    return NextResponse.json({
      results: activeResults,
      model_used: modelUsed,
    })
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || 'Server error' }, { status: 500 })
  }
}
