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

    const { geminiKeys } = await getEffectiveApiKeys()

    if (geminiKeys.length === 0) {
      return NextResponse.json(
        { error: 'Fitur ini butuh Gemini API key (untuk web search grounding). Tambahkan Gemini API key di Settings.' },
        { status: 400 }
      )
    }

    const userPromptText = `Find real competitions matching these keywords: "${keywords}".`

    let geminiModels = ['gemini-3.6-flash', 'gemini-2.5-flash']
    if (preferred_model && preferred_model.startsWith('gemini')) {
      geminiModels = [preferred_model, ...geminiModels.filter((m) => m !== preferred_model)]
    }

    let parsedResult: { results: DiscoveredCompetition[] } | null = null
    let modelUsed = preferred_model || 'gemini-3.6-flash'
    let lastErrorMessage = 'AI generation failed'

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
                systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
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
            lastErrorMessage = `Rate limit (HTTP 429) pada key #${keyIdx + 1}`
            break
          } else {
            lastErrorMessage = `Model ${modelName} mengembalikan HTTP status ${res.status}`
          }
        } catch (e: any) {
          lastErrorMessage = e?.message || 'Timeout'
        }
      }

      if (parsedResult) break
    }

    if (!parsedResult) {
      return NextResponse.json({ error: lastErrorMessage }, { status: 502 })
    }

    return NextResponse.json({
      results: Array.isArray(parsedResult.results) ? parsedResult.results : [],
      model_used: modelUsed,
    })
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || 'Server error' }, { status: 500 })
  }
}
