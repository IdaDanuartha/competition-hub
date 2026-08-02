import { createClient } from 'jsr:@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface RequestBody {
  competition_id: string
  extracted_text?: string
  preferred_model?: string
}

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

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const geminiKey = Deno.env.get('GEMINI_API_KEY')
    const openaiKey = Deno.env.get('OPENAI_API_KEY')

    const supabase = createClient(supabaseUrl, supabaseKey)
    const { competition_id, preferred_model }: RequestBody = await req.json()

    if (!competition_id) {
      return new Response(JSON.stringify({ error: 'competition_id required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Fetch competition info
    const { data: competition, error: compErr } = await supabase
      .from('competitions')
      .select('*')
      .eq('id', competition_id)
      .single()

    if (compErr || !competition) {
      return new Response(JSON.stringify({ error: 'Competition not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Fetch uploaded guidebook document if available
    const { data: docs } = await supabase
      .from('competition_documents')
      .select('*')
      .eq('competition_id', competition_id)
      .order('uploaded_at', { ascending: false })
      .limit(1)

    const latestDoc = docs?.[0]
    let pdfBase64: string | null = null
    let pdfMimeType = 'application/pdf'

    const cloudName = Deno.env.get('CLOUDINARY_CLOUD_NAME') || Deno.env.get('NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME') || 'dypcf3xsh'
    const apiKey = Deno.env.get('CLOUDINARY_API_KEY') || Deno.env.get('NEXT_PUBLIC_CLOUDINARY_API_KEY')
    const apiSecret = Deno.env.get('CLOUDINARY_API_SECRET') || Deno.env.get('NEXT_PUBLIC_CLOUDINARY_API_SECRET')
    const authHeader = apiKey && apiSecret ? `Basic ${btoa(`${apiKey.trim()}:${apiSecret.trim()}`)}` : undefined

    if (latestDoc?.cloudinary_url) {
      const rawUrl = latestDoc.cloudinary_url
      const publicId = latestDoc.cloudinary_public_id || rawUrl.split('/upload/')[1]?.replace(/^v\d+\//, '')

      const urlsToTry = [
        rawUrl,
        rawUrl.replace('/image/upload/', '/raw/upload/'),
        rawUrl.replace('/upload/', '/upload/fl_attachment/'),
        rawUrl.replace(/\.(png|jpg|jpeg)$/i, '.pdf'),
      ]

      for (const candidateUrl of urlsToTry) {
        try {
          const res = await fetch(candidateUrl)
          if (res.ok) {
            const buf = await res.arrayBuffer()
            if (buf.byteLength > 1000) {
              const bytes = new Uint8Array(buf)
              let binary = ''
              for (let i = 0; i < bytes.byteLength; i++) {
                binary += String.fromCharCode(bytes[i])
              }
              pdfBase64 = btoa(binary)
              pdfMimeType = 'application/pdf'
              console.log(`[Edge Function] Successfully fetched full multi-page PDF (${buf.byteLength} bytes) from ${candidateUrl}`)
              break
            }
          }
        } catch (_e) {
          // continue
        }
      }

      if (!pdfBase64 && publicId && authHeader) {
        try {
          const cleanId = publicId.replace(/\.pdf$/i, '')
          for (const rType of ['raw', 'image']) {
            const resourceUrl = `https://api.cloudinary.com/v1_1/${cloudName}/resources/${rType}/upload/${cleanId}`
            const res = await fetch(resourceUrl, { headers: { Authorization: authHeader } })
            if (res.ok) {
              const details = await res.json()
              if (details.secure_url) {
                const downloadRes = await fetch(details.secure_url, { headers: { Authorization: authHeader } })
                if (downloadRes.ok) {
                  const buf = await downloadRes.arrayBuffer()
                  if (buf.byteLength > 1000) {
                    const bytes = new Uint8Array(buf)
                    let binary = ''
                    for (let i = 0; i < bytes.byteLength; i++) {
                      binary += String.fromCharCode(bytes[i])
                    }
                    pdfBase64 = btoa(binary)
                    pdfMimeType = 'application/pdf'
                    console.log(`[Edge Function] Admin API fetched full PDF binary (${buf.byteLength} bytes)`)
                    break
                  }
                }
              }
            }
          }
        } catch (err) {
          console.warn('[Edge Function] Cloudinary Admin API fallback failed:', err)
        }
      }
    }

    if (!pdfBase64 && latestDoc) {
      return new Response(
        JSON.stringify({ error: 'Gagal mengunduh file PDF dari Cloudinary untuk dianalisis AI. Silakan periksa kredensial Cloudinary atau unggah ulang file guidebook.' }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
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

    // Try Gemini API first (Primary)
    if (geminiKey) {
      for (const modelName of geminiModels) {
        try {
          const requestBody: any = {
            systemInstruction: {
              parts: [{ text: systemPromptText }],
            },
            generationConfig: { responseMimeType: 'application/json' },
          }

          const parts: any[] = []
          if (pdfBase64) {
            parts.push({
              inlineData: {
                mimeType: pdfMimeType,
                data: pdfBase64,
              },
            })
          }
          parts.push({ text: userPromptText })
          requestBody.contents = [{ parts }]

          const geminiRes = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${geminiKey}`,
            {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(requestBody),
            }
          )

          if (geminiRes.ok) {
            const geminiData = await geminiRes.json()
            const rawText = geminiData.candidates?.[0]?.content?.parts?.[0]?.text
            if (rawText) {
              parsedResult = JSON.parse(rawText)
              modelUsed = modelName
              break
            }
          }
        } catch (e) {
          console.warn(`Gemini API call to ${modelName} failed:`, e)
        }
      }
    }

    // Fallback to OpenAI GPT (Secondary)
    if (!parsedResult && openaiKey) {
      try {
        const messages: any[] = [
          { role: 'system', content: systemPromptText },
          { role: 'user', content: userPromptText },
        ]

        const gptRes = await fetch('https://api.openai.com/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${openaiKey}`,
          },
          body: JSON.stringify({
            model: 'gpt-4o-mini',
            messages,
            response_format: { type: 'json_object' },
          }),
        })

        if (gptRes.ok) {
          const gptData = await gptRes.json()
          const rawText = gptData.choices?.[0]?.message?.content
          if (rawText) {
            parsedResult = JSON.parse(rawText)
            modelUsed = 'gpt-4o-mini'
          }
        }
      } catch (_e) {
        console.error('OpenAI API fallback also failed')
      }
    }

    if (!parsedResult) {
      return new Response(
        JSON.stringify({ error: 'AI analysis failed. Please check API keys or document format.' }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      )
    }

    // Upsert into ai_summaries table
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

    // Auto-generate structured rundown items from rundown_timeline or important_dates
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
      const { error: insertRundownErr } = await supabase.from('rundown_items').insert(newRundowns)
      if (insertRundownErr) {
        console.error('Failed to insert auto-generated rundown items:', insertRundownErr)
      }
    }

    return new Response(JSON.stringify(summaryRow), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})