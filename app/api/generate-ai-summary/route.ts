import { NextResponse } from 'next/server'
import { createClient as createServerClient } from '@/lib/supabase/server'
import { compressPdfBuffer } from '@/lib/pdf-compressor'
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
  const startTime = Date.now()
  const logs: string[] = []
  const addLog = (msg: string) => {
    const time = new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
    logs.push(`[${time}] ${msg}`)
  }

  try {
    addLog('Menginisialisasi analisis AI...')
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

    // 1. Try server client with cookies first
    let supabase = await createServerClient()
    let { data: competition, error: compErr } = await supabase
      .from('competitions')
      .select('*')
      .eq('id', competition_id)
      .single()

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
      addLog('❌ Kompetisi tidak ditemukan')
      return NextResponse.json({ error: 'Competition not found' }, { status: 404 })
    }

    addLog(`Ditemukan kompetisi "${competition.name}"`)

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
    let pdfSizeBytes = 0
    let pdfExtractedText = ''

    if (latestDoc?.cloudinary_url) {
      addLog(`Mengunduh file dokumen "${latestDoc.file_name}"...`)
      const docUrl = latestDoc.cloudinary_url
      const urlsToTry = [
        docUrl,
        docUrl.includes('/image/upload/') ? docUrl.replace('/image/upload/', '/raw/upload/') : null,
      ].filter(Boolean) as string[]

      for (const candidateUrl of urlsToTry) {
        try {
          const res = await fetch(candidateUrl, { signal: AbortSignal.timeout(12000) })
          if (res.ok) {
            const buf = await res.arrayBuffer()
            if (buf.byteLength > 1000) {
              const comp = compressPdfBuffer(Buffer.from(buf))
              pdfBase64 = comp.compressedBuffer.toString('base64')
              pdfMimeType = 'application/pdf'
              pdfSizeBytes = comp.compressedBuffer.byteLength
              pdfExtractedText = comp.extractedText
              comp.logs.forEach((logMsg) => addLog(logMsg))
              addLog(`✓ PDF Siap dianalisis (${(comp.compressedSizeKb).toFixed(1)} KB)`)
              break
            }
          }
        } catch (_e) {
          addLog(`⚠️ Gagal fetch dari ${candidateUrl}, mencoba lokasi alternatif...`)
        }
      }

      // Cloudinary Admin API fallback
      if (!pdfBase64 && latestDoc.cloudinary_public_id) {
        const apiKey = process.env.NEXT_PUBLIC_CLOUDINARY_API_KEY || process.env.CLOUDINARY_API_KEY
        const apiSecret = process.env.NEXT_PUBLIC_CLOUDINARY_API_SECRET || process.env.CLOUDINARY_API_SECRET
        if (apiKey && apiSecret) {
          const cleanApiSecret = apiSecret.replace(/^"|"$/g, '').trim()
          const cleanApiKey = apiKey.trim()
          const basicAuth = `Basic ${Buffer.from(`${cleanApiKey}:${cleanApiSecret}`).toString('base64')}`
          const cloudName = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME || 'dypcf3xsh'
          const cleanId = latestDoc.cloudinary_public_id.replace(/\.pdf$/i, '')

          for (const rType of ['raw', 'image']) {
            try {
              const resourceUrl = `https://api.cloudinary.com/v1_1/${cloudName}/resources/${rType}/upload/${encodeURIComponent(cleanId)}`
              const res = await fetch(resourceUrl, { headers: { Authorization: basicAuth }, signal: AbortSignal.timeout(10000) })
              if (res.ok) {
                const details = await res.json()
                if (details.secure_url) {
                  const downloadRes = await fetch(details.secure_url, { signal: AbortSignal.timeout(12000) })
                  if (downloadRes.ok) {
                    const buf = await downloadRes.arrayBuffer()
                    if (buf.byteLength > 1000) {
                      const comp = compressPdfBuffer(Buffer.from(buf))
                      pdfBase64 = comp.compressedBuffer.toString('base64')
                      pdfMimeType = 'application/pdf'
                      pdfSizeBytes = comp.compressedBuffer.byteLength
                      pdfExtractedText = comp.extractedText
                      comp.logs.forEach((logMsg) => addLog(logMsg))
                      addLog(`✓ Cloudinary Admin API: PDF terkompresi & siap (${(comp.compressedSizeKb).toFixed(1)} KB)`)
                      break
                    }
                  }
                }
              }
            } catch (_err) {
              // fallback
            }
          }
        }
      }
    } else {
      addLog('Tanda: Tidak ada file dokumen PDF attached, analisis dilakukan berbasis metadata kompetisi')
    }

    if (!pdfBase64 && latestDoc) {
      addLog('❌ Gagal mengunduh isi file PDF dari storage')
      return NextResponse.json(
        { error: 'Gagal mengunduh file PDF untuk dianalisis. Silakan periksa atau unggah ulang file guidebook.' },
        { status: 400 }
      )
    }

    const systemPromptText = `You are an expert competition document analyzer. Your task is to analyze the entire attached competition guidebook PDF and return a 100% accurate analysis in Bahasa Indonesia.

CRITICAL MANDATES FOR ABSOLUTE ACCURACY:
1. READ ALL PAGES OF THE ATTACHED PDF DOCUMENT CAREFULLY.
2. EXTRACT OVERVIEW, TEMA UTAMA, SUB-TEMA, AND TIMELINE STRICTLY AND EXCLUSIVELY FROM THE TEXT INSIDE THE ATTACHED DOCUMENT.
   DO NOT INVENT, GUESS, OR USE GENERIC PLACEHOLDERS!

Return ONLY a valid JSON object with EXACTLY these keys:
{
  "summary": "Deskripsi murni kompetisi dari Section A dokumen.",
  "theme_and_subtheme": "Tema Utama: ...\nSub-Tema:\n- ...",
  "key_requirements": ["Persyaratan 1", "Persyaratan 2"],
  "important_dates": ["Tanggal 1", "Tanggal 2"],
  "judging_criteria": ["Kriteria 1 (bobot %)"],
  "project_idea_suggestions": [
    {
      "title": "Judul Ide Proyek Spesifik",
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

    const userPromptText = `Analyze the guidebook PDF document for competition "${competition.name}".
${pdfExtractedText ? `\n--- EXTRACTED TEXT FROM PDF GUIDEBOOK ---\n${pdfExtractedText.slice(0, 16000)}\n--- END EXTRACTED TEXT ---\n` : ''}
Extract the real, actual overview, main theme, subthemes, key requirements, judging criteria, and ALL timeline rundown dates strictly from the PDF document content.`

    let parsedResult: any = null
    let modelUsed = preferred_model || 'gemini-3.6-flash'

    let geminiModels = ['gemini-3.6-flash', 'gemini-2.5-flash']
    if (preferred_model && preferred_model.startsWith('gemini')) {
      geminiModels = [preferred_model, ...geminiModels.filter((m) => m !== preferred_model)]
    }

    // Try OpenAI if requested
    if (preferred_model === 'gpt-4o-mini' && openaiKey) {
      try {
        addLog('Mengirimkan prompt & dokumen ke OpenAI GPT-4o Mini...')
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
          signal: AbortSignal.timeout(20000),
        })

        if (res.ok) {
          const data = await res.json()
          const rawText = data.choices?.[0]?.message?.content
          if (rawText) {
            parsedResult = JSON.parse(rawText)
            modelUsed = 'gpt-4o-mini'
            addLog('✓ GPT-4o Mini selesai memproses analisis')
          }
        }
      } catch (_e) {
        addLog('⚠️ OpenAI GPT-4o Mini gagal, beralih ke Gemini...')
      }
    }

    // Try Gemini models
    if (!parsedResult && geminiKey) {
      for (const modelName of geminiModels) {
        try {
          addLog(`Mengirimkan data ke model ${modelName}...`)
          const apiEndpointModel = modelName.includes('2.0') ? 'gemini-2.0-flash-exp' : 'gemini-1.5-flash'
          const parts: any[] = []
          if (pdfBase64) {
            parts.push({
              inlineData: { mimeType: pdfMimeType, data: pdfBase64 },
            })
          }
          parts.push({ text: userPromptText })

          const res = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/${apiEndpointModel}:generateContent?key=${geminiKey}`,
            {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                systemInstruction: { parts: [{ text: systemPromptText }] },
                contents: [{ parts }],
                generationConfig: { responseMimeType: 'application/json' },
              }),
              signal: AbortSignal.timeout(20000),
            }
          )

          if (res.ok) {
            const data = await res.json()
            const rawText = data.candidates?.[0]?.content?.parts?.[0]?.text
            if (rawText) {
              parsedResult = JSON.parse(rawText)
              modelUsed = modelName
              addLog(`✓ ${modelName} berhasil memproses analisis dokumen`)
              break
            }
          } else {
            addLog(`⚠️ Model ${modelName} mengembalikan HTTP ${res.status}`)
          }
        } catch (e: any) {
          addLog(`⚠️ Model ${modelName} timeout/error: ${e?.message || 'Error'}`)
        }
      }
    }

    // OpenAI fallback
    if (!parsedResult && openaiKey) {
      try {
        addLog('Mencoba fallback akhir ke OpenAI GPT-4o Mini...')
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
          signal: AbortSignal.timeout(20000),
        })

        if (res.ok) {
          const data = await res.json()
          const rawText = data.choices?.[0]?.message?.content
          if (rawText) {
            parsedResult = JSON.parse(rawText)
            modelUsed = 'gpt-4o-mini'
            addLog('✓ Fallback GPT-4o Mini berhasil')
          }
        }
      } catch (_e) {
        addLog('❌ OpenAI fallback gagal')
      }
    }

    if (!parsedResult) {
      addLog('❌ Semua model AI gagal merespon')
      return NextResponse.json({ error: 'AI generation failed', logs }, { status: 400 })
    }

    // Save AI summary to DB
    addLog('Menyimpan hasil analisis & ringkasan ke database...')
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

    // Insert new rundown items
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
      await supabase.from('rundown_items').delete().eq('competition_id', competition_id).eq('is_auto_generated', true)
      await supabase.from('rundown_items').insert(newRundowns)
      addLog(`✓ Memperbarui ${newRundowns.length} agenda rundown otomatis`)
    }

    const durationMs = Date.now() - startTime
    addLog(`🏁 Analisis Selesai! (Durasi: ${(durationMs / 1000).toFixed(2)} detik)`)

    return NextResponse.json({
      ...summaryRow,
      execution_log: logs,
      execution_time_ms: durationMs,
      pdf_size_kb: pdfSizeBytes ? Math.round(pdfSizeBytes / 1024) : 0,
      model_used: modelUsed,
    })
  } catch (err: any) {
    addLog(`❌ Error: ${err.message}`)
    return NextResponse.json({ error: err.message, logs }, { status: 500 })
  }
}
