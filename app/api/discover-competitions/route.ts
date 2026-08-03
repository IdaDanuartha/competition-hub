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
    const systemPrompt = `You are an expert research assistant that finds real, currently OPEN or UPCOMING competitions, hackathons, and IT contests in INDONESIA.

SEARCH CONSTRAINTS & LOCATION:
1. LOCATION: Search ONLY for competitions held in INDONESIA or targeted for Indonesian students, developers, and participants (e.g., Gemastik, CompFest, KMIPN, HackFest, Lomba Web Development, Hackathon Indonesia, dsb.).
2. STATUS: Only return competitions that are currently open for registration or upcoming.
3. EXCLUDE: Do NOT return old past competitions from 2023 or earlier (2020, 2021, 2022, 2023).
4. LANGUAGE: Summary snippets and titles MUST be written in Bahasa Indonesia.
5. REALITY: Extract genuine competition names, organizers, and official website URLs.

For each competition found, extract:
- name: official competition name (in Indonesia)
- organizer: organizing body/institution (e.g. Universitas, Kemenkominfo, Puspresnas, Komunitas Tech Indonesia), or null if unclear
- theme: the competition's theme or main focus in Indonesian, or null if unclear
- tags: 2-5 short category tags (e.g. "hackathon", "web_development", "AI", "mahasiswa", "ui_ux_design")
- website_url: official website or registration page URL
- registration_deadline: ISO 8601 date string of the registration deadline, or null if unspecified
- submission_deadline: ISO 8601 date string of the submission deadline, or null if unspecified
- summary_snippet: 1-2 sentence summary in Bahasa Indonesia of what the competition is about

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

    const { geminiKeys, openaiKey } = await getEffectiveApiKeys()

    if (geminiKeys.length === 0 && !openaiKey) {
      return NextResponse.json(
        { error: 'Fitur ini membutuhkan Gemini atau OpenAI API Key. Silakan tambahkan API key di Settings.' },
        { status: 400 }
      )
    }

    const userPromptText = `Cari lomba, hackathon, atau kompetisi IT/teknologi terbaru di INDONESIA untuk kata kunci: "${keywords}". Utamakan lomba yang saat ini sedang buka pendaftaran atau akan datang untuk mahasiswa/umum di Indonesia.`

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

    // Post-fetch Filter: Only filter out explicit old years (2020-2023)
    const rawItems = Array.isArray(parsedResult.results) ? parsedResult.results : []
    const activeResults = rawItems.filter((item) => {
      const textToTest = `${item.name || ''} ${item.summary_snippet || ''}`
      // Filter out only old historical years (2018 - 2023)
      if (/\b(2018|2019|2020|2021|2022|2023)\b/.test(textToTest)) {
        return false
      }
      return true
    })

    const finalResults = activeResults.length > 0 ? activeResults : rawItems

    return NextResponse.json({
      results: finalResults,
      model_used: modelUsed,
    })
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || 'Server error' }, { status: 500 })
  }
}
