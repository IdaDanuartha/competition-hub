import { NextResponse } from 'next/server'
import { getEffectiveApiKeys } from '@/lib/get-api-keys'
import type { DiscoveredCompetition } from '@/lib/discover'

async function fetchInfoLombaIT(userKeywords: string): Promise<Array<{ title: string; link: string; desc: string }>> {
  const cleanKw = userKeywords.trim().replace(/^lomba\s*/i, '')
  const searchUrl = `http://infolombait.com/feeds/posts/default?alt=json&q=${encodeURIComponent(cleanKw)}&max-results=20`

  try {
    const res = await fetch(searchUrl, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
      },
      signal: AbortSignal.timeout(8000),
    })

    if (res.ok) {
      const data = await res.json()
      const entries = data.feed?.entry || []
      const items = entries.map((entry: any) => {
        const title = entry.title?.$t || ''
        const link = entry.link?.find((l: any) => l.rel === 'alternate')?.href || ''
        const content = entry.content?.$t || entry.summary?.$t || ''
        const cleanContent = content.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 500)
        return { title, link, desc: cleanContent }
      })
      if (items.length > 0) return items
    }
  } catch {
    // Fall through to recent posts fallback
  }

  // Fallback to recent posts if keyword search returned no items
  try {
    const recentUrl = 'http://infolombait.com/feeds/posts/default?alt=json&max-results=25'
    const res = await fetch(recentUrl, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
      },
      signal: AbortSignal.timeout(8000),
    })

    if (res.ok) {
      const data = await res.json()
      const entries = data.feed?.entry || []
      return entries.map((entry: any) => {
        const title = entry.title?.$t || ''
        const link = entry.link?.find((l: any) => l.rel === 'alternate')?.href || ''
        const content = entry.content?.$t || entry.summary?.$t || ''
        const cleanContent = content.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 500)
        return { title, link, desc: cleanContent }
      })
    }
  } catch {
    // Return empty array
  }

  return []
}

async function fetchLiveWebSearch(userKeywords: string): Promise<Array<{ title: string; link: string; desc: string }>> {
  const cleanKw = userKeywords.trim()
  const hasLomba = /^lomba\b/i.test(cleanKw)
  const baseQuery = hasLomba ? cleanKw : `lomba ${cleanKw}`
  const currentYear = new Date().getFullYear()
  const nextYear = currentYear + 1

  const queries = [
    `${baseQuery} indonesia ${currentYear} ${nextYear}`,
    `kompetisi ${cleanKw.replace(/^lomba\s*/i, '')} indonesia ${currentYear} ${nextYear}`,
  ]

  const items: Array<{ title: string; link: string; desc: string }> = []

  for (const q of queries) {
    try {
      const url = `https://www.bing.com/search?q=${encodeURIComponent(q)}&format=rss`
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
      // Continue to next query
    }
  }

  return items
}

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

    // 1. Fetch from infolombait.com and general web search in parallel
    const [infoLombaItems, webSearchItems] = await Promise.all([
      fetchInfoLombaIT(keywords),
      fetchLiveWebSearch(keywords),
    ])

    const combinedItems = [
      ...infoLombaItems,
      ...webSearchItems.filter((w) => !infoLombaItems.some((i) => i.link === w.link)),
    ]

    const currentYear = new Date().getFullYear()
    const nextYear = currentYear + 1

    const systemPrompt = `You are an expert research assistant specializing in Indonesian competitions, hackathons, and IT contests.

JOB: Extract a list of MULTIPLE (4 to 10) real, distinct active competitions, hackathons, or contests in INDONESIA specifically matching the user's keyword "${keywords}".

STRICT CONSTRAINTS:
1. YEAR & TIMING: Only return LATEST competitions for ${currentYear} or ${nextYear}. Exclude all past/expired competitions from 2025, 2024, 2023 or earlier.
2. DEADLINE STATUS: Only return competitions whose registration is CURRENTLY OPEN or UPCOMING (deadline has NOT passed yet, at least open until H-1 hour before closing). Exclude closed/expired competitions.
3. DEADLINE EXTRACTION: Always extract registration_deadline as an ISO 8601 date string (e.g. "${currentYear}-08-30T23:59:00Z") if stated in the text.
4. KEYWORD RELEVANCE: Extract competitions directly relevant to "${keywords}".
5. LANGUAGE: Summary snippets and titles in Bahasa Indonesia.

For each competition, extract:
- name: official competition name (must be active for ${currentYear} or ${nextYear})
- organizer: organizing body/institution, or null if unclear
- theme: the competition's theme or main focus in Indonesian, or null if unclear
- tags: 2-5 short category tags (e.g. ["web_development", "hackathon", "mahasiswa"])
- website_url: official website URL or article URL
- registration_deadline: ISO 8601 date string if mentioned, else null
- submission_deadline: ISO 8601 date string if mentioned, else null
- summary_snippet: 1-2 sentence summary in Bahasa Indonesia

Return ONLY valid JSON matching this schema, with no markdown fences:
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

    const userPromptText = `User Keyword: "${keywords}"\n\n--- REAL COMPETITION ARTICLES FROM INFOLOMBAIT.COM & INDONESIAN WEBSITES ---\n${JSON.stringify(
      combinedItems,
      null,
      2
    )}\n--- END SEARCH RESULTS ---`

    let geminiModels = ['gemini-3.6-flash', 'gemini-2.5-flash', 'gemini-1.5-flash', 'gemini-2.0-flash']
    if (preferred_model && preferred_model.startsWith('gemini')) {
      geminiModels = [preferred_model, ...geminiModels.filter((m) => m !== preferred_model)]
    }

    let parsedResult: { results: DiscoveredCompetition[] } | null = null
    let modelUsed = preferred_model || 'gemini-3.6-flash'

    // Attempt 1: Process scraped articles via Gemini AI
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
              await new Promise((r) => setTimeout(r, 400))
            }
          } catch {}
        }

        if (parsedResult) break
      }
    }

    // Attempt 2: Process scraped articles via OpenAI API if available
    if (!parsedResult && openaiKey) {
      const openAiModel = preferred_model && preferred_model.startsWith('gpt-4') ? preferred_model : 'gpt-4o-mini'
      try {
        const res = await fetch('https://api.openai.com/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${openaiKey}`,
          },
          body: JSON.stringify({
            model: openAiModel,
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
            modelUsed = openAiModel
          }
        }
      } catch {}
    }

    // Attempt 3: Direct Scraped Fallback (if AI API key rate limits or fails)
    if (!parsedResult && combinedItems.length > 0) {
      const fallbackResults: DiscoveredCompetition[] = combinedItems.slice(0, 10).map((item) => ({
        name: item.title,
        organizer: 'Info Lomba IT',
        theme: null,
        tags: [keywords, 'IT', 'indonesia'],
        website_url: item.link,
        registration_deadline: null,
        submission_deadline: null,
        summary_snippet: item.desc.slice(0, 200),
      }))

      return NextResponse.json({
        results: fallbackResults,
        model_used: 'infolombait-direct-scraper',
      })
    }

    if (!parsedResult) {
      return NextResponse.json({ error: 'Gagal memproses data lomba' }, { status: 502 })
    }

    // Post-fetch Filter: Strictly exclude old ended competitions (2018-2025) or expired registration deadlines
    const now = new Date()
    const todayStr = now.toISOString().split('T')[0]
    const oneHourAgoMs = now.getTime() - 60 * 60 * 1000

    const rawItems = Array.isArray(parsedResult.results) ? parsedResult.results : []
    const activeResults = rawItems.filter((item) => {
      const textToTest = `${item.name || ''} ${item.summary_snippet || ''}`

      // Reject all past years (2018, 2019, 2020, 2021, 2022, 2023, 2024, 2025)
      if (/\b(2018|2019|2020|2021|2022|2023|2024|2025)\b/.test(textToTest)) {
        return false
      }

      // Filter registration_deadline threshold: must not be expired (at least H-1 hour before closing)
      if (item.registration_deadline) {
        try {
          const regDate = new Date(item.registration_deadline)
          if (!isNaN(regDate.getTime()) && regDate.getTime() < oneHourAgoMs) {
            return false
          }
        } catch {
          const regDateStr = item.registration_deadline.split('T')[0]
          if (regDateStr < todayStr) {
            return false
          }
        }
      }

      // Filter submission_deadline threshold
      if (item.submission_deadline) {
        try {
          const subDate = new Date(item.submission_deadline)
          if (!isNaN(subDate.getTime()) && subDate.getTime() < oneHourAgoMs) {
            return false
          }
        } catch {
          const subDateStr = item.submission_deadline.split('T')[0]
          if (subDateStr < todayStr) {
            return false
          }
        }
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
