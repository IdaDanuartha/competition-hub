import { NextResponse } from 'next/server'
import { createClient as createServerClient } from '@/lib/supabase/server'
import { compressPdfBuffer } from '@/lib/pdf-compressor'
import { createClient as createAdminClient } from '@supabase/supabase-js'

function parseIndonesianDateToIso(dateStr: string): string | null {
  if (!dateStr) return null
  const months: Record<string, string> = {
    januari: '01', jan: '01',
    februari: '02', feb: '02',
    maret: '03', mar: '03',
    april: '04', apr: '04',
    mei: '05',
    juni: '06', jun: '06',
    juli: '07', jul: '07',
    agustus: '08', ags: '08', agu: '08',
    september: '09', sep: '09',
    oktober: '10', okt: '10',
    november: '11', nov: '11',
    desember: '12', des: '12',
  }

  const strLower = dateStr.toLowerCase()

  // Match e.g. "31 Juli - 09 Agustus 2026" or "23 September 2026" or "31 Oktober 2026"
  const match = strLower.match(/(?:(\d{1,2})\s+)?([a-z]+)(?:\s*(?:-|s\/d|\s)\s*\d{1,2}\s+[a-z]+)?\s+(\d{4})/)
  if (match) {
    const day = match[1] ? match[1].padStart(2, '0') : '01'
    const monthName = match[2]
    const year = match[3]
    const month = months[monthName]
    if (month && year) {
      return `${year}-${month}-${day}T08:00:00.000Z`
    }
  }

  // Fallback match e.g. "21-22 September 2026"
  const matchRange = strLower.match(/(\d{1,2})\s*(?:-|\s*s\/d\s*)\s*\d{1,2}\s+([a-z]+)\s+(\d{4})/)
  if (matchRange) {
    const day = matchRange[1].padStart(2, '0')
    const monthName = matchRange[2]
    const year = matchRange[3]
    const month = months[monthName]
    if (month && year) {
      return `${year}-${month}-${day}T08:00:00.000Z`
    }
  }

  return null
}

export async function POST(req: Request) {
  const startTime = Date.now()
  const logs: string[] = []

  const addLog = (msg: string) => {
    const timeStr = new Date().toLocaleTimeString('id-ID', { hour12: false })
    logs.push(`[${timeStr}] ${msg}`)
  }

  try {
    addLog('[1/6] Inisialisasi pipeline analisis AI guidebook...')
    const body = await req.json().catch(() => ({}))
    const competition_id = body.competition_id || body.competitionId || body.id
    const preferred_model = body.preferred_model || body.preferredModel

    if (!competition_id) {
      addLog('❌ Error: competition_id tidak diberikan')
      return NextResponse.json({ error: 'competition_id required' }, { status: 400 })
    }

    const rawGeminiKey = process.env.GEMINI_API_KEY
    const geminiKey = rawGeminiKey ? rawGeminiKey.replace(/^["']|["']$/g, '') : undefined
    const rawOpenaiKey = process.env.OPENAI_API_KEY
    const openaiKey = rawOpenaiKey ? rawOpenaiKey.replace(/^["']|["']$/g, '') : undefined

    // 1. Supabase client setup with Admin fallback
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
      addLog('❌ Error: Kompetisi tidak ditemukan di database')
      return NextResponse.json({ error: 'Competition not found' }, { status: 404 })
    }

    addLog(`[2/6] Ditemukan data kompetisi: "${competition.name}" (ID: ${competition_id})`)

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

    if (latestDoc) {
      addLog(`[3/6] Mengunduh file dokumen guidebook: "${latestDoc.file_name}"...`)

      // Attempt 1: Direct Supabase Storage download (most reliable)
      if (latestDoc.cloudinary_public_id) {
        try {
          addLog(`[3/6] Membaca via Supabase Storage API (bucket: "guidebooks", path: "${latestDoc.cloudinary_public_id}")...`)
          const { data: fileData, error: downloadErr } = await supabase.storage
            .from('guidebooks')
            .download(latestDoc.cloudinary_public_id)

          if (!downloadErr && fileData) {
            const buf = await fileData.arrayBuffer()
            if (buf.byteLength > 1000) {
              const comp = compressPdfBuffer(Buffer.from(buf))
              pdfBase64 = comp.compressedBuffer.toString('base64')
              pdfMimeType = 'application/pdf'
              pdfSizeBytes = comp.compressedBuffer.byteLength
              pdfExtractedText = comp.extractedText
              comp.logs.forEach((l) => addLog(l))
              addLog(`✓ Supabase Storage Download Sukses: Buffer PDF ${(buf.byteLength / 1024).toFixed(1)} KB (Base64: ${(pdfBase64.length / 1024).toFixed(1)} KB)`)
            }
          } else if (downloadErr) {
            addLog(`⚠️ Supabase Storage download error: ${downloadErr.message}, mencoba via Public HTTP URL...`)
          }
        } catch (e: any) {
          addLog(`⚠️ Supabase Storage download exception: ${e?.message || 'Error'}, mencoba via Public HTTP URL...`)
        }
      }

      // Attempt 2: Public HTTP URL download fallback
      if (!pdfBase64 && latestDoc.cloudinary_url) {
        const docUrl = latestDoc.cloudinary_url
        const urlsToTry = [
          docUrl,
          docUrl.includes('/image/upload/') ? docUrl.replace('/image/upload/', '/raw/upload/') : null,
        ].filter(Boolean) as string[]

        for (const candidateUrl of urlsToTry) {
          try {
            addLog(`[3/6] Membaca via Public URL: ${candidateUrl}...`)
            const res = await fetch(candidateUrl, { signal: AbortSignal.timeout(12000) })
            if (res.ok) {
              const buf = await res.arrayBuffer()
              if (buf.byteLength > 1000) {
                const comp = compressPdfBuffer(Buffer.from(buf))
                pdfBase64 = comp.compressedBuffer.toString('base64')
                pdfMimeType = 'application/pdf'
                pdfSizeBytes = comp.compressedBuffer.byteLength
                pdfExtractedText = comp.extractedText
                comp.logs.forEach((l) => addLog(l))
                addLog(`✓ Public URL Download Sukses: Buffer PDF ${(buf.byteLength / 1024).toFixed(1)} KB`)
                break
              }
            }
          } catch (_e) {
            addLog(`⚠️ Gagal fetch dari URL ${candidateUrl}`)
          }
        }
      }
    }

    if (!pdfBase64 && latestDoc) {
      addLog('❌ AKURASI ENGINE ERROR: Gagal membaca file PDF dari storage. Analisis dibatalkan untuk mencegah data generik/palsu.')
      return NextResponse.json(
        { error: 'Gagal membaca file PDF guidebook dari storage. Harap periksa atau unggah ulang file PDF.', logs },
        { status: 400 }
      )
    }

    if (!pdfBase64 && !latestDoc) {
      addLog('ℹ️ Tidak ada file guidebook attached, menganalisis berbasis metadata kompetisi')
    }

    const wordCount = pdfExtractedText ? pdfExtractedText.split(/\s+/).length : 0
    addLog(`[4/6] Mesin Ekstraksi Teks: ${wordCount} kata terekstrak dari PDF (${pdfExtractedText.length} karakter)`)

    const systemPromptText = `You are a strict, highly meticulous competition guidebook parser.
Your task is to analyze the attached competition guidebook PDF file (both visually and from text) and extract 100% truthful, precise facts in Bahasa Indonesia.

CRITICAL MANDATES FOR ABSOLUTE ACCURACY:
1. OVERVIEW: Write a concise overview (3-5 sentences) summarizing the exact competition background, organizer, and target audience directly written in the guidebook.
2. TEMA UTAMA & SUB-TEMA:
   - Extract the EXACT main theme stated in the document under "TEMA" or "FOKUS UTAMA".
   - Extract all specific sub-themes / categories listed in the document. Do NOT make up generic categories.
3. KEY REQUIREMENTS: Extract all specific eligibility requirements, team sizes, mandatory submission files, and rules mentioned in the guidebook.
4. JUDGING CRITERIA: Extract all judging criteria and their exact percentage weights written in the document (e.g. "Inovasi & Kesesuaian Solusi (25%)", "Implementasi Teknologi & AI (30%)", "Fungsionalitas Website (30%)", "Desain Antarmuka / UI/UX (15%)").
5. RUNDOWN TIMELINE TABLE (CRITICAL):
   - Look specifically for the official schedule table titled "TIMELINE PELAKSANAAN", "JADWAL KEGIATAN", or "AGENDA LOMBA".
   - Extract EVERY row of the table line by line.
   - For example, extract exact rows like:
     * Pendaftaran dan Pengumpulan Gelombang 1 (31 Juli - 09 Agustus 2026)
     * Pendaftaran dan Pengumpulan Gelombang 2 (10 Agustus - 24 Agustus 2026)
     * Pendaftaran dan Pengumpulan Gelombang 3 (25 Agustus - 20 September 2026)
     * Penjurian Finalis (Online) (21-22 September 2026)
     * Pengumuman Finalis (23 September 2026)
     * Technical Meeting Finalis (Online) (25 September 2026)
     * Registrasi Ulang Finalis (26 September - 27 Oktober 2026)
     * Presentasi, Seminar, Awarding (Offline) (31 Oktober 2026)
   - Do NOT omit any rows from the table, and do NOT make up fictitious dates in January/March/May!

Return ONLY a valid JSON object matching this schema:
{
  "summary": "Deskripsi murni kompetisi berdasarkan dokumen resmi.",
  "theme_and_subtheme": "Tema Utama: [Tema Resmi Dokumen]\nSub-Tema:\n- [Sub-Tema 1]\n- [Sub-Tema 2]",
  "key_requirements": ["Syarat 1", "Syarat 2", "Syarat 3"],
  "important_dates": ["Tanggal 1", "Tanggal 2"],
  "judging_criteria": ["Kriteria 1 (bobot %)", "Kriteria 2 (bobot %)"],
  "project_idea_suggestions": [
    {
      "title": "Judul Rekomendasi Ide Proyek",
      "description": "Deskripsi solusi proyek yang sangat relevan dengan tema kompetisi ini",
      "rationale": "Alasan ide ini kuat"
    }
  ],
  "rundown_timeline": [
    {
      "title": "Nama Agenda Resmi dari Tabel Dokumen",
      "date_str": "Tanggal Resmi dari Tabel Dokumen (contoh: 31 Juli - 09 Agustus 2026)",
      "description": "Keterangan pelaksanaan (Online/Offline) atau detail kegiatan",
      "iso_date": "ISO date string presisi (contoh: 2026-07-31T08:00:00Z)"
    }
  ]
}`

    const userPromptText = `Analyze the attached guidebook PDF document for competition "${competition.name}".
${pdfExtractedText ? `\n--- EXTRACTED TEXT CONTENT FROM PDF GUIDEBOOK ---\n${pdfExtractedText.slice(0, 18000)}\n--- END EXTRACTED TEXT ---\n` : ''}
Inspect all pages and tables in the PDF document. Extract the real, actual overview, main theme, subthemes, key requirements, judging criteria, and ALL timeline rundown dates strictly from the PDF document content above.`

    let parsedResult: any = null
    let modelUsed = preferred_model || 'gemini-3.6-flash'

    let geminiModels = ['gemini-3.6-flash', 'gemini-2.5-flash']
    if (preferred_model && preferred_model.startsWith('gemini')) {
      geminiModels = [preferred_model, ...geminiModels.filter((m) => m !== preferred_model)]
    }

    // Try OpenAI if requested
    if (preferred_model === 'gpt-4o-mini' && openaiKey) {
      try {
        const modelReqStart = Date.now()
        addLog(`[5/6] Mengirimkan payload ke OpenAI GPT-4o Mini...`)
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
          signal: AbortSignal.timeout(25000),
        })

        const reqDuration = ((Date.now() - modelReqStart) / 1000).toFixed(2)

        if (res.ok) {
          const data = await res.json()
          const rawText = data.choices?.[0]?.message?.content
          if (rawText) {
            parsedResult = JSON.parse(rawText)
            modelUsed = 'gpt-4o-mini'
            addLog(`✓ GPT-4o Mini selesai memproses analisis (${reqDuration} detik)`)
          }
        } else {
          addLog(`⚠️ OpenAI GPT-4o Mini mengembalikan HTTP status ${res.status}`)
        }
      } catch (e: any) {
        addLog(`⚠️ OpenAI GPT-4o Mini error/timeout: ${e?.message || 'Error'}, beralih ke Gemini...`)
      }
    }

    // Try Gemini models
    if (!parsedResult && geminiKey) {
      for (const modelName of geminiModels) {
        try {
          const modelReqStart = Date.now()
          addLog(`[5/6] Mengirimkan payload ke Gemini AI Model: ${modelName}...`)
          const apiEndpointModel = modelName
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
              signal: AbortSignal.timeout(25000),
            }
          )

          const reqDuration = ((Date.now() - modelReqStart) / 1000).toFixed(2)

          if (res.ok) {
            const data = await res.json()
            const rawText = data.candidates?.[0]?.content?.parts?.[0]?.text
            if (rawText) {
              parsedResult = JSON.parse(rawText)
              modelUsed = modelName
              addLog(`✓ ${modelName} berhasil memproses analisis dokumen (${reqDuration} detik)`)
              break
            }
          } else {
            addLog(`⚠️ Model ${modelName} mengembalikan HTTP status ${res.status}`)
          }
        } catch (e: any) {
          addLog(`⚠️ Model ${modelName} timeout/error: ${e?.message || 'Error'}`)
        }
      }
    }

    // OpenAI fallback
    if (!parsedResult && openaiKey) {
      try {
        const modelReqStart = Date.now()
        addLog('[5/6] Mencoba fallback ke OpenAI GPT-4o Mini...')
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
          signal: AbortSignal.timeout(25000),
        })

        const reqDuration = ((Date.now() - modelReqStart) / 1000).toFixed(2)

        if (res.ok) {
          const data = await res.json()
          const rawText = data.choices?.[0]?.message?.content
          if (rawText) {
            parsedResult = JSON.parse(rawText)
            modelUsed = 'gpt-4o-mini'
            addLog(`✓ Fallback GPT-4o Mini berhasil (${reqDuration} detik)`)
          }
        }
      } catch (_e) {
        addLog('❌ Fallback OpenAI gagal')
      }
    }

    if (!parsedResult) {
      addLog('❌ ERROR KRITIS: Seluruh model AI gagal memproses payload PDF')
      return NextResponse.json({ error: 'AI generation failed', logs }, { status: 400 })
    }

    // Save AI summary to DB
    const totalDurationSec = ((Date.now() - startTime) / 1000).toFixed(2)
    addLog(`[6/6] Menyimpan analisis & ${(parsedResult.rundown_timeline || []).length} agenda timeline ke database...`)

    const { data: summaryRow, error: saveErr } = await (supabase as any)
      .from('ai_summaries')
      .upsert(
        {
          competition_id,
          summary: parsedResult.summary ?? '',
          theme_and_subtheme: parsedResult.theme_and_subtheme ?? null,
          key_requirements: parsedResult.key_requirements ?? [],
          important_dates: parsedResult.important_dates ?? [],
          judging_criteria: parsedResult.judging_criteria ?? [],
          project_idea_suggestions: parsedResult.project_idea_suggestions ?? [],
          pdf_size_kb: pdfSizeBytes ? Math.round(pdfSizeBytes / 1024) : null,
          model_used: modelUsed,
          execution_time_ms: Date.now() - startTime,
          execution_log: logs,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'competition_id' }
      )
      .select('*')
      .single()

    if (saveErr) {
      addLog(`❌ Error menyimpan ke ai_summaries: ${saveErr.message}`)
    }

    // Save rundown timeline items if present
    if (Array.isArray(parsedResult.rundown_timeline) && parsedResult.rundown_timeline.length > 0) {
      // Delete old auto-generated items first
      await supabase.from('rundown_items').delete().eq('competition_id', competition_id).eq('is_auto_generated', true)

      const rundownInserts = parsedResult.rundown_timeline.map((item: any) => {
        let validIsoDate = item.iso_date
        const parsedIso = parseIndonesianDateToIso(item.date_str || item.title || '')
        if (parsedIso) {
          validIsoDate = parsedIso
        } else if (!validIsoDate || isNaN(Date.parse(validIsoDate))) {
          validIsoDate = new Date().toISOString()
        }

        return {
          competition_id,
          title: item.title || 'Agenda Lomba',
          description: item.description ? `[${item.date_str || ''}] ${item.description}` : item.date_str || '',
          event_at: validIsoDate,
          is_auto_generated: true,
          auto_source: `guidebook_${modelUsed}`,
        }
      })

      const { error: rundownErr } = await supabase.from('rundown_items').insert(rundownInserts)
      if (rundownErr) {
        addLog(`⚠️ Gagal menyisipkan agenda rundown: ${rundownErr.message}`)
      } else {
        addLog(`✓ ${rundownInserts.length} agenda rundown timeline resmi berhasil ditambahkan ke kalender`)
      }
    }

    addLog(`[SELESAI] Pipeline analisis AI sukses 100% (Total waktu: ${totalDurationSec} detik)`)

    // Update execution_log with final complete logs
    if (summaryRow?.id) {
      await (supabase as any).from('ai_summaries').update({ execution_log: logs }).eq('id', summaryRow.id)
    }

    return NextResponse.json({
      ...(summaryRow || parsedResult),
      execution_log: logs,
    })
  } catch (err: any) {
    addLog(`❌ Unhandled Error: ${err?.message || 'Unknown failure'}`)
    return NextResponse.json({ error: err?.message || 'Server error', logs }, { status: 500 })
  }
}
