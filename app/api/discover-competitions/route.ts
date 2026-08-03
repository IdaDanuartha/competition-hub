import { NextResponse } from 'next/server'
import { getEffectiveApiKeys } from '@/lib/get-api-keys'
import type { DiscoveredCompetition } from '@/lib/discover'

async function fetchLiveWebSearch(query: string): Promise<Array<{ title: string; link: string; desc: string }>> {
  const urls = [
    `https://www.bing.com/search?q=${encodeURIComponent(query)}&format=rss`,
    `https://www.bing.com/search?q=${encodeURIComponent(query + ' indonesia 2024 2025 2026')}&format=rss`,
  ]

  const items: Array<{ title: string; link: string; desc: string }> = []

  for (const url of urls) {
    try {
      const res = await fetch(url, {
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
          'Accept-Language': 'id-ID,id;q=0.9,en-US;q=0.8,en;q=0.7',
        },
        signal: AbortSignal.timeout(8000),
      })

      if (!res.ok) continue
      const xmlText = await res.text()
      const itemRegex =
        /<item>[\s\S]*?<title>([\s\S]*?)<\/title>[\s\S]*?<link>([\s\S]*?)<\/link>[\s\S]*?<description>([\s\S]*?)<\/description>[\s\S]*?<\/item>/gi
      let match

      while ((match = itemRegex.exec(xmlText)) !== null) {
        const title = match[1].replace(/<!\[CDATA\[|\]\]>/g, '').replace(/<[^>]+>/g, '').trim()
        const link = match[2].replace(/<!\[CDATA\[|\]\]>/g, '').trim()
        const desc = match[3].replace(/<!\[CDATA\[|\]\]>/g, '').replace(/<[^>]+>/g, '').trim()
        if (title && link && !items.some((i) => i.link === link)) {
          items.push({ title, link, desc })
        }
      }
    } catch {
      // Continue to next URL
    }
  }

  return items
}

const SYSTEM_PROMPT = `You are an expert research assistant. Analyze the provided live web search results for Indonesian competitions, hackathons, and IT contests matching the user's query.

CONSTRAINTS:
1. LOCATION: Extract ONLY real competitions held in INDONESIA or open for Indonesian students, developers, and participants.
2. RELEVANCE: Extract genuine competition names, organizing institutions, themes, and official website URLs.
3. LANGUAGE: Write summary snippets in Bahasa Indonesia.
4. EXCLUDE: Exclude old ended competitions from 2023 or earlier.

For each competition found in the live search results or relevant to the query, extract:
- name: official competition name
- organizer: organizing body/institution (e.g. Universitas, Kemenkominfo, Puspresnas, Komunitas Tech), or null if unclear
- theme: the competition's theme or main focus in Indonesian, or null if unclear
- tags: 2-5 short category tags (e.g. ["web_development", "hackathon", "mahasiswa"])
- website_url: official website URL (prefer direct link to competition page or portal)
- registration_deadline: ISO 8601 string if mentioned, else null
- submission_deadline: ISO 8601 string if mentioned, else null
- summary_snippet: 1-2 sentence summary in Bahasa Indonesia

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

    const { geminiKeys, openaiKey } = await getEffectiveApiKeys()

    if (geminiKeys.length === 0 && !openaiKey) {
      return NextResponse.json(
        { error: 'Fitur ini membutuhkan Gemini atau OpenAI API Key. Silakan tambahkan API key di Settings.' },
        { status: 400 }
      )
    }

    // 1. Scraping live web search results for Indonesian competitions matching keywords
    const liveSearchResults = await fetchLiveWebSearch(`lomba ${keywords} indonesia 2024 2025 2026`)

    const userPromptText = `Cari dan ekstrak lomba/hackathon di INDONESIA untuk kata kunci: "${keywords}".
${
  liveSearchResults.length > 0
    ? `\n--- HASIL PENCARIAN WEB LANGSUNG (LIVE SEARCH RESULTS) ---\n${JSON.stringify(
        liveSearchResults,
        null,
        2
      )}\n--- END SEARCH RESULTS ---\n`
    : ''
}
Utamakan lomba aktif/terbaru di Indonesia untuk mahasiswa & umum.`

    let geminiModels = ['gemini-2.5-flash', 'gemini-1.5-flash', 'gemini-2.0-flash']
    if (preferred_model && preferred_model.startsWith('gemini')) {
      geminiModels = [preferred_model, ...geminiModels.filter((m) => m !== preferred_model)]
    }

    let parsedResult: { results: DiscoveredCompetition[] } | null = null
    let modelUsed = preferred_model || 'gemini-2.5-flash'
    let lastErrorMessage = 'Gagal mencari kompetisi'

    // Attempt 1: Process live search results via Gemini AI
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
                  systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
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
                modelUsed = modelName
                break
              }
            } else if (res.status === 429) {
              lastErrorMessage = `Rate limit (HTTP 429) pada key #${keyIdx + 1}. Mencoba failover...`
              await new Promise((r) => setTimeout(r, 400))
            }
          } catch (e: any) {
            lastErrorMessage = e?.message || 'Timeout'
          }
        }

        if (parsedResult) break
      }
    }

    // Attempt 2: Process live search results via OpenAI API if available
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
              { role: 'system', content: SYSTEM_PROMPT },
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
      } catch (e: any) {
        lastErrorMessage = e?.message || 'OpenAI error'
      }
    }

    if (!parsedResult) {
      return NextResponse.json({ error: lastErrorMessage }, { status: 502 })
    }

    // Post-fetch Filter: Only filter out explicit old years (2018-2023)
    const rawItems = Array.isArray(parsedResult.results) ? parsedResult.results : []
    const activeResults = rawItems.filter((item) => {
      const textToTest = `${item.name || ''} ${item.summary_snippet || ''}`
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
