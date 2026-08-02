import { NextResponse } from 'next/server'
import { createClient as createServerClient } from '@/lib/supabase/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'

function parseIndonesianDate(dateStr: string | null | undefined, fallbackIso: string): string {
  if (!dateStr) return fallbackIso

  const parsedDirect = Date.parse(dateStr)
  if (!isNaN(parsedDirect)) {
    return new Date(parsedDirect).toISOString()
  }

  const months: Record<string, string> = {
    januari: '01', jan: '01',
    februari: '02', feb: '02',
    maret: '03', mar: '03',
    april: '04', apr: '04',
    mei: '05',
    juni: '06', jun: '06',
    juli: '07', jul: '07',
    agustus: '08', agu: '08', ags: '08',
    september: '09', sep: '09',
    oktober: '10', okt: '10',
    november: '11', nov: '11',
    desember: '12', des: '12',
  }

  const lower = dateStr.toLowerCase()
  for (const [mName, mNum] of Object.entries(months)) {
    if (lower.includes(mName)) {
      const matchDay = lower.match(/\b(\d{1,2})\b/)
      const day = matchDay ? matchDay[1].padStart(2, '0') : '01'
      const yearMatch = lower.match(/\b(20\d{2})\b/)
      const year = yearMatch ? yearMatch[1] : new Date().getFullYear().toString()
      return `${year}-${mNum}-${day}T08:00:00.000Z`
    }
  }

  return fallbackIso
}

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}))
    const competition_id = body.competition_id || body.competitionId || body.id
    const preferred_model = body.preferred_model || body.preferredModel
    if (!competition_id) {
      return NextResponse.json({ error: 'competition_id required' }, { status: 400 })
    }

    const rawGeminiKey = process.env.GEMINI_API_KEY
    const geminiKey = rawGeminiKey ? rawGeminiKey.replace(/^["']|["']$/g, '') : undefined
    const rawOpenaiKey = process.env.OPENAI_API_KEY
    const openaiKey = rawOpenaiKey ? rawOpenaiKey.replace(/^["']|["']$/g, '') : undefined

    // 1. Try server client with cookies first for RLS auth
    let supabase = await createServerClient()

    let { data: competition, error: compErr } = await supabase
      .from('competitions')
      .select('*')
      .eq('id', competition_id)
      .single()

    // Fallback: Try admin service role client if RLS blocked cookie client
    if (compErr || !competition) {
      const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
      if (serviceRoleKey) {
        const adminSupabase = createAdminClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, serviceRoleKey)
        const res = await adminSupabase.from('competitions').select('*').eq('id', competition_id).single()
        if (res.data) {
          competition = res.data
          compErr = null
          supabase = adminSupabase as any
        }
      }
    }

    if (compErr || !competition) {
      return NextResponse.json({ error: 'Competition not found' }, { status: 404 })
    }

    // 2. Fetch latest guidebook document
    const { data: docs } = await supabase
      .from('competition_documents')
      .select('*')
      .eq('competition_id', competition_id)
      .order('uploaded_at', { ascending: false })
      .limit(1)

    const latestDoc = docs?.[0]
    let pdfBase64: string | null = null
    let pdfMimeType = 'application/pdf'

    const cloudName = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME || 'dypcf3xsh'
    const apiKey = process.env.NEXT_PUBLIC_CLOUDINARY_API_KEY || process.env.CLOUDINARY_API_KEY
    const apiSecret = process.env.NEXT_PUBLIC_CLOUDINARY_API_SECRET || process.env.CLOUDINARY_API_SECRET
    const authHeader = apiKey && apiSecret ? `Basic ${Buffer.from(`${apiKey.trim()}:${apiSecret.trim()}`).toString('base64')}` : undefined

    if (latestDoc?.cloudinary_url) {
      const docUrl = latestDoc.cloudinary_url

      // Build candidate URLs to try
      // New uploads: Supabase Storage public URLs (directly accessible)
      // Old uploads: Cloudinary URLs (may or may not be accessible)
      const urlsToTry = [
        docUrl,
        // Legacy Cloudinary fallbacks
        docUrl.includes('/image/upload/') ? docUrl.replace('/image/upload/', '/raw/upload/') : null,
      ].filter(Boolean) as string[]

      for (const candidateUrl of urlsToTry) {
        try {
          const res = await fetch(candidateUrl)
          console.log(`[AI Route] Tried ${candidateUrl} → HTTP ${res.status}`)
          if (res.ok) {
            const buf = await res.arrayBuffer()
            if (buf.byteLength > 1000) {
              pdfBase64 = Buffer.from(buf).toString('base64')
              pdfMimeType = 'application/pdf'
              console.log(`[AI Route] ✓ PDF fetched (${buf.byteLength} bytes)`)
              break
            }
          }
        } catch (e) {
          console.warn(`[AI Route] fetch error for ${candidateUrl}:`, e)
        }
      }

      // Admin API fallback for legacy Cloudinary authenticated assets
      if (!pdfBase64 && latestDoc.cloudinary_public_id && apiKey && apiSecret) {
        const cleanApiSecret = (apiSecret as string).replace(/^"|"$/g, '').trim()
        const cleanApiKey = (apiKey as string).trim()
        const basicAuth = `Basic ${Buffer.from(`${cleanApiKey}:${cleanApiSecret}`).toString('base64')}`
        const cloudName = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME || 'dypcf3xsh'

        try {
          const cleanId = latestDoc.cloudinary_public_id.replace(/\.pdf$/i, '')
          for (const rType of ['raw', 'image']) {
            const resourceUrl = `https://api.cloudinary.com/v1_1/${cloudName}/resources/${rType}/upload/${encodeURIComponent(cleanId)}`
            const res = await fetch(resourceUrl, { headers: { Authorization: basicAuth } })
            console.log(`[AI Route] Cloudinary Admin API: HTTP ${res.status}`)
            if (res.ok) {
              const details = await res.json()
              if (details.secure_url) {
                const downloadRes = await fetch(details.secure_url)
                if (downloadRes.ok) {
                  const buf = await downloadRes.arrayBuffer()
                  if (buf.byteLength > 1000) {
                    pdfBase64 = Buffer.from(buf).toString('base64')
                    pdfMimeType = 'application/pdf'
                    console.log(`[AI Route] ✓ Cloudinary Admin API PDF (${buf.byteLength} bytes)`)
                    break
                  }
                }
              }
            }
          }
        } catch (err) {
          console.warn('[AI Route] Cloudinary Admin API fallback failed:', err)
        }
      }

      if (!pdfBase64) {
        console.error('[AI Route] All PDF download attempts failed for URL:', docUrl)
      }
    }


    if (!pdfBase64 && latestDoc) {
      return NextResponse.json(
        { error: 'Gagal mengunduh file PDF dari Cloudinary untuk dianalisis AI. Silakan periksa kredensial Cloudinary atau unggah ulang file guidebook.' },
        { status: 400 }
      )
    }

    const systemPromptText = `You are an expert competition document analyzer. Your task is to analyze the entire attached competition guidebook PDF and return a 100% accurate analysis in Bahasa Indonesia.

CRITICAL MANDATES FOR ABSOLUTE ACCURACY:
1. READ ALL PAGES OF THE ATTACHED PDF DOCUMENT CAREFULLY.
2. EXTRACT OVERVIEW, TEMA UTAMA, SUB-TEMA, AND TIMELINE STRICTLY AND EXCLUSIVELY FROM THE TEXT INSIDE THE ATTACHED DOCUMENT.
   DO NOT INVENT, GUESS, OR USE GENERIC PLACEHOLDERS!

   For example, if Section B / Tema Lomba in the PDF states:
   TEMA: "Driving Sustainability in Nature Through Digital Innovation"
   SUBTEMA:
   - Green Economy: Berfokus pada pengembangan inovasi digital...
   - Smart Small Island: Menitikberatkan pada penerapan teknologi digital...
   - Smart Agroindustry and Logistic System: Berfokus pada optimalisasi...

   You MUST output:
   summary: Deskripsi murni dari Section A Deskripsi Lomba di PDF.
   theme_and_subtheme:
   Tema Utama: Driving Sustainability in Nature Through Digital Innovation
   Sub-Tema:
   - Green Economy: Berfokus pada pengembangan inovasi digital yang mendukung pertumbuhan ekonomi berkelanjutan dengan tetap menjaga kelestarian lingkungan.
   - Smart Small Island: Menitikberatkan pada penerapan teknologi digital untuk mendukung pembangunan berkelanjutan di wilayah kepulauan kecil.
   - Smart Agroindustry and Logistic System: Berfokus pada optimalisasi proses produksi, pengolahan, penyimpanan, dan distribusi hasil agro melalui integrasi sistem digital.

   DO NOT output generic subthemes like "Kecerdasan Buatan", "IoT", "Keamanan Siber" unless they are explicitly written in the PDF!

3. LOOK FOR THE OFFICIAL TIMELINE TABLE / SECTION (e.g. "K. TIMELINE LOMBA", "Jadwal", "Agenda", or any table with columns: Kegiatan, Tanggal, Keterangan).
   EXTRACT EVERY SINGLE ROW FROM THE OFFICIAL TIMELINE TABLE EXACTLY AS WRITTEN IN THE DOCUMENT.
   For example, if the table inside the PDF contains:
   - Pendaftaran: 1 Juni – 5 Agustus 2026 (Keterangan: Online)
   - Pengumpulan Karya: 16 Juli – 5 Agustus 2026 (Keterangan: Online)
   - Penilaian Karya: 6 Agustus – 10 Agustus 2026 (Keterangan: Online)
   - Pengumuman Finalis: 11 Agustus 2026 (Keterangan: Online)
   - Technical Meeting Finalis: 12 Agustus 2026 (Keterangan: Online)
   - Final Presentasi: 22 Agustus 2026 (Keterangan: Offline)
   - Seminar, Expo & Pengumuman: 23 Agustus 2026 (Keterangan: Offline)

   You MUST extract EXACTLY those rows and dates!

4. For each item in rundown_timeline:
   - title: Exact row name under "Kegiatan" (e.g. "Pendaftaran", "Pengumpulan Karya", "Penilaian Karya", "Pengumuman Finalis", "Technical Meeting Finalis", "Final Presentasi", "Seminar, Expo & Pengumuman").
   - date_str: Exact text under "Tanggal" (e.g. "1 Juni – 5 Agustus 2026", "11 Agustus 2026", "22 Agustus 2026").
   - description: Text under "Keterangan" or details (e.g. "Online", "Offline").
   - iso_date: Precise ISO 8601 timestamp string for the start date (e.g. "2026-06-01T08:00:00.000Z", "2026-08-11T08:00:00.000Z", "2026-08-22T08:00:00.000Z").

Provide ALL text in Bahasa Indonesia.

Return ONLY a valid JSON object with EXACTLY these keys:
{
  "summary": "Deskripsi murni kompetisi dari Section A dokumen.",
  "theme_and_subtheme": "Tema Utama: Driving Sustainability in Nature Through Digital Innovation\nSub-Tema:\n- Green Economy: ...\n- Smart Small Island: ...\n- Smart Agroindustry and Logistic System: ...",
  "key_requirements": ["Persyaratan 1", "Persyaratan 2"],
  "important_dates": ["Tanggal 1", "Tanggal 2"],
  "judging_criteria": ["Kriteria 1 (bobot %)"],
  "project_idea_suggestions": [
    {
      "title": "Judul Ide Proyek Spesifik Berdasarkan Subtema Dokumen",
      "description": "Cara kerja proyek",
      "rationale": "Alasan ide ini kompetitif"
    }
  ],
  "rundown_timeline": [
    {
      "title": "Nama Kegiatan Resmi",
      "date_str": "Tanggal Resmi dari Dokumen",
      "description": "Keterangan (Online/Offline) atau detail kegiatan",
      "iso_date": "ISO 8601 date string presisi"
    }
  ]
}`

    const userPromptText = `Analyze all pages of the attached PDF document for competition "${competition.name}".
Extract Theme & Subthemes strictly from Section B, Timeline rows strictly from Section K table, and Overview strictly from Section A.`

    let parsedResult: any = null
    let modelUsed = preferred_model || 'gemini-3.6-flash'

    let geminiModels = ['gemini-3.6-flash', 'gemini-3.5-flash-lite', 'gemini-2.5-flash', 'gemini-1.5-flash']
    if (preferred_model && preferred_model.startsWith('gemini')) {
      geminiModels = [preferred_model, ...geminiModels.filter((m) => m !== preferred_model)]
    }

    // Try OpenAI first if requested
    if (preferred_model === 'gpt-4o-mini' && openaiKey) {
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
              { role: 'system', content: systemPromptText },
              { role: 'user', content: userPromptText },
            ],
            response_format: { type: 'json_object' },
          }),
        })

        if (res.ok) {
          const data = await res.json()
          const rawText = data.choices?.[0]?.message?.content
          if (rawText) {
            parsedResult = JSON.parse(rawText)
            modelUsed = 'gpt-4o-mini'
          }
        }
      } catch (_e) {
        console.warn('OpenAI preferred model failed, falling back to Gemini...')
      }
    }

    // Try Gemini models
    if (!parsedResult && geminiKey) {
      for (const modelName of geminiModels) {
        try {
          const parts: any[] = []
          if (pdfBase64) {
            parts.push({
              inlineData: { mimeType: pdfMimeType, data: pdfBase64 },
            })
          }
          parts.push({ text: userPromptText })

          const res = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${geminiKey}`,
            {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                systemInstruction: { parts: [{ text: systemPromptText }] },
                contents: [{ parts }],
                generationConfig: { responseMimeType: 'application/json' },
              }),
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
          }
        } catch (e) {
          console.warn(`Gemini model ${modelName} failed in API route:`, e)
        }
      }
    }

    // Fallback to OpenAI GPT if not preferred and Gemini failed
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
              { role: 'system', content: systemPromptText },
              { role: 'user', content: userPromptText },
            ],
            response_format: { type: 'json_object' },
          }),
        })

        if (res.ok) {
          const data = await res.json()
          const rawText = data.choices?.[0]?.message?.content
          if (rawText) {
            parsedResult = JSON.parse(rawText)
            modelUsed = 'gpt-4o-mini'
          }
        }
      } catch (_e) {
        console.error('OpenAI fallback failed in API route')
      }
    }

    if (!parsedResult) {
      return NextResponse.json({ error: 'AI generation failed' }, { status: 400 })
    }

    // Save AI summary to DB
    const { data: summaryRow, error: saveErr } = await supabase
      .from('ai_summaries')
      .upsert(
        {
          competition_id,
          summary: parsedResult.summary ?? '',
          key_requirements: parsedResult.key_requirements ?? [],
          important_dates: parsedResult.important_dates ?? [],
          judging_criteria: parsedResult.judging_criteria ?? [],
          theme_and_subtheme: parsedResult.theme_and_subtheme ?? null,
          project_idea_suggestions: parsedResult.project_idea_suggestions ?? [],
          model_used: modelUsed,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'competition_id' }
      )
      .select()
      .single()

    if (saveErr) throw saveErr

    // Clear ALL auto-generated rundowns for this competition
    await supabase
      .from('rundown_items')
      .delete()
      .eq('competition_id', competition_id)
      .eq('is_auto_generated', true)

    // Insert new rundown items from AI analysis
    const rundownTimeline: any[] = parsedResult.rundown_timeline ?? []
    const importantDates: string[] = parsedResult.important_dates ?? []
    const fallbackIso = competition.submission_deadline || new Date().toISOString()
    const newRundowns: any[] = []

    if (rundownTimeline.length > 0) {
      for (let i = 0; i < rundownTimeline.length; i++) {
        const item = rundownTimeline[i]
        const title = item.title ?? `Agenda ${i + 1}`
        const dateStr = item.date_str ? `[${item.date_str}] ` : ''
        const desc = `${dateStr}${item.description ?? ''}`.trim()
        const eventAt = parseIndonesianDate(item.iso_date || item.date_str, fallbackIso)

        newRundowns.push({
          competition_id,
          title: title.slice(0, 100),
          description: desc,
          event_at: eventAt,
          is_auto_generated: true,
          auto_source: 'ai_summary',
        })
      }
    } else if (importantDates.length > 0) {
      for (const itemStr of importantDates) {
        const parts = itemStr.split(':')
        const title = parts.length > 1 ? parts.slice(1).join(':').trim() : itemStr
        const desc = parts[0].trim()
        const eventAt = parseIndonesianDate(itemStr, fallbackIso)

        newRundowns.push({
          competition_id,
          title: title.slice(0, 100),
          description: desc,
          event_at: eventAt,
          is_auto_generated: true,
          auto_source: 'ai_summary',
        })
      }
    }

    if (newRundowns.length > 0) {
      await supabase.from('rundown_items').insert(newRundowns)
    }

    return NextResponse.json(summaryRow)
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
