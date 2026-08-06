import { NextResponse } from 'next/server'
import { createClient as createServerClient } from '@/lib/supabase/server'
import { compressPdfBuffer } from '@/lib/pdf-compressor'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import { getEffectiveApiKeys } from '@/lib/get-api-keys'


function parseIndonesianDateToIso(dateStr: string): string | null {
  if (!dateStr) return null

  // If already a valid ISO or parseable date string
  if (!isNaN(Date.parse(dateStr)) && dateStr.length >= 10 && (dateStr.includes('-') || dateStr.includes('/'))) {
    const d = new Date(dateStr)
    if (!isNaN(d.getTime())) {
      return d.toISOString()
    }
  }

  const months: Record<string, string> = {
    januari: '01', jan: '01', january: '01',
    februari: '02', feb: '02', february: '02',
    maret: '03', mar: '03', march: '03',
    april: '04', apr: '04',
    mei: '05', may: '05',
    juni: '06', jun: '06', june: '06',
    juli: '07', jul: '07', july: '07',
    agustus: '08', ags: '08', agu: '08', august: '08', aug: '08',
    september: '09', sep: '09',
    oktober: '10', okt: '10', october: '10', oct: '10',
    november: '11', nov: '11',
    desember: '12', des: '12', december: '12', dec: '12',
  }

  const strLower = dateStr.toLowerCase().trim()

  // Pattern 1: ISO or Slash "2026-08-05" or "05/08/2026"
  const matchIso = strLower.match(/(\d{4})[-/](\d{1,2})[-/](\d{1,2})/)
  if (matchIso) {
    const year = matchIso[1]
    const month = matchIso[2].padStart(2, '0')
    const day = matchIso[3].padStart(2, '0')
    return `${year}-${month}-${day}T12:00:00.000Z`
  }

  // Pattern 2: Month Day Year "August 5, 2026" or "Aug 5 2026"
  const matchMonthFirst = strLower.match(/([a-z]+)\s+(\d{1,2})(?:st|nd|rd|th)?,?\s+(\d{4})/)
  if (matchMonthFirst) {
    const month = months[matchMonthFirst[1]]
    const day = matchMonthFirst[2].padStart(2, '0')
    const year = matchMonthFirst[3]
    if (month && year) return `${year}-${month}-${day}T12:00:00.000Z`
  }

  // Pattern 3: Cross-month range "31 Juli - 09 Agustus 2026" or "31 Juli s/d 09 Agustus 2026"
  const matchCrossMonth = strLower.match(/\d{1,2}\s+[a-z]+\s*(?:-|s\/d|\ss\/d\s|sampai)\s*(\d{1,2})\s+([a-z]+)\s+(\d{4})/)
  if (matchCrossMonth) {
    const day = matchCrossMonth[1].padStart(2, '0')
    const month = months[matchCrossMonth[2]]
    const year = matchCrossMonth[3]
    if (month && year) return `${year}-${month}-${day}T12:00:00.000Z`
  }

  // Pattern 4: Same-month range "14 - 31 Juli 2026" or "14 s/d 31 Juli 2026"
  const matchSameMonthRange = strLower.match(/\d{1,2}\s*(?:-|s\/d|\ss\/d\s|sampai)\s*(\d{1,2})\s+([a-z]+)\s+(\d{4})/)
  if (matchSameMonthRange) {
    const day = matchSameMonthRange[1].padStart(2, '0')
    const month = months[matchSameMonthRange[2]]
    const year = matchSameMonthRange[3]
    if (month && year) return `${year}-${month}-${day}T12:00:00.000Z`
  }

  // Pattern 5: Single date "31 Juli 2026" or "31 Jul 2026"
  const matchSingle = strLower.match(/(\d{1,2})\s+([a-z]+)\s+(\d{4})/)
  if (matchSingle) {
    const day = matchSingle[1].padStart(2, '0')
    const month = months[matchSingle[2]]
    const year = matchSingle[3]
    if (month && year) return `${year}-${month}-${day}T12:00:00.000Z`
  }

  return null
}

function computeCompetitionDates(parsedResult: any) {
  let registration_deadline: string | null = null
  let submission_deadline: string | null = null
  let event_start_at: string | null = null
  let event_end_at: string | null = null

  // 1. Direct from AI extracted_deadlines if provided and valid ISO or parseable
  if (parsedResult?.extracted_deadlines) {
    const ex = parsedResult.extracted_deadlines
    if (ex.registration_deadline_iso) {
      registration_deadline = parseIndonesianDateToIso(ex.registration_deadline_iso) || (!isNaN(Date.parse(ex.registration_deadline_iso)) ? ex.registration_deadline_iso : null)
    }
    if (ex.submission_deadline_iso) {
      submission_deadline = parseIndonesianDateToIso(ex.submission_deadline_iso) || (!isNaN(Date.parse(ex.submission_deadline_iso)) ? ex.submission_deadline_iso : null)
    }
    if (ex.event_start_at_iso) {
      event_start_at = parseIndonesianDateToIso(ex.event_start_at_iso) || (!isNaN(Date.parse(ex.event_start_at_iso)) ? ex.event_start_at_iso : null)
    }
    if (ex.event_end_at_iso) {
      event_end_at = parseIndonesianDateToIso(ex.event_end_at_iso) || (!isNaN(Date.parse(ex.event_end_at_iso)) ? ex.event_end_at_iso : null)
    }
  }

  // 2. Parse from important_dates array if any dates missing
  const importantDates: string[] = parsedResult?.important_dates || []
  for (const dateEntry of importantDates) {
    const iso = parseIndonesianDateToIso(dateEntry)
    if (iso) {
      const lower = dateEntry.toLowerCase()
      if (!registration_deadline && /pendaftaran|registrasi|registration|wave|gelombang|batch/i.test(lower)) {
        registration_deadline = iso
      } else if (!submission_deadline && /pengumpulan|submission|submit|unggah|upload|berkas|proposal|karya|project/i.test(lower)) {
        submission_deadline = iso
      } else if (!event_start_at && /mulai|start|opening|pembukaan/i.test(lower)) {
        event_start_at = iso
      } else if (!event_end_at && /selesai|end|closing|penutupan|awarding|pemenang/i.test(lower)) {
        event_end_at = iso
      }
    }
  }

  // 3. Fallback parse from rundown_timeline items
  const timeline: Array<{ title: string; iso_date?: string; date_str?: string; description?: string }> = parsedResult?.rundown_timeline || []
  const validItems = timeline
    .map((item) => {
      let iso: string | undefined = item.iso_date
      if (!iso || isNaN(Date.parse(iso))) {
        iso = parseIndonesianDateToIso(item.date_str || '') || parseIndonesianDateToIso(item.title || '') || parseIndonesianDateToIso(item.description || '') || undefined
      }
      return { title: (item.title || '').toLowerCase(), iso }
    })
    .filter((x): x is { title: string; iso: string } => Boolean(x.iso && !isNaN(Date.parse(x.iso))))

  if (validItems.length > 0) {
    validItems.sort((a, b) => new Date(a.iso).getTime() - new Date(b.iso).getTime())

    if (!event_start_at) {
      event_start_at = validItems[0].iso
    }

    if (!event_end_at) {
      event_end_at = validItems[validItems.length - 1].iso
    }

    if (!registration_deadline) {
      const regItems = validItems.filter((x) =>
        /pendaftaran|registrasi|registration|wave|gelombang|batch|tahap pendaftaran/i.test(x.title)
      )
      if (regItems.length > 0) {
        registration_deadline = regItems[regItems.length - 1].iso
      } else {
        registration_deadline = validItems[0].iso
      }
    }

    if (!submission_deadline) {
      const subItems = validItems.filter((x) =>
        /pengumpulan|submission|submit|unggah|upload|berkas|proposal|karya|project|bapp/i.test(x.title)
      )
      if (subItems.length > 0) {
        submission_deadline = subItems[subItems.length - 1].iso
      } else {
        submission_deadline = registration_deadline
      }
    }
  }

  return { registration_deadline, submission_deadline, event_start_at, event_end_at }
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
    const replace_fields: string[] | undefined = body.replace_fields || body.replaceFields

    if (!competition_id) {
      addLog('❌ Error: competition_id tidak diberikan')
      return NextResponse.json({ error: 'competition_id required' }, { status: 400 })
    }

    const { geminiKeys, openaiKey } = await getEffectiveApiKeys()



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
              const comp = await compressPdfBuffer(Buffer.from(buf))
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
                const comp = await compressPdfBuffer(Buffer.from(buf))
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

    const systemPromptText = `You are a world-class, extremely thorough competition guidebook parser.

Your task is to analyze the attached competition guidebook PDF file (both visually and from text) and extract 100% truthful, comprehensive facts in Bahasa Indonesia.

CRITICAL MANDATES FOR ABSOLUTE ACCURACY & COMPLETENESS:

1. OVERVIEW:
   - Write a clear, informative overview (3-5 sentences) summarizing the exact competition background, organizer name, target audience, and main objective stated in the guidebook.

2. TEMA UTAMA & SUB-TEMA / KATEGORI LOMBA:
   - "Tema Utama": Extract the overall theme or main focus of the competition event.
   - "Sub-Tema / Kategori Lomba": Extract ALL sub-themes, tracks, or specific competition categories listed in the document (e.g., "Software Development", "UI/UX Design", "Capture The Flag", "Smart City", etc.).
   - ALWAYS list every category or sub-theme separated by newlines with "-" prefix under "Sub-Tema:". Never skip them or write generic fallback if categories exist.

3. BIAYA PENDAFTARAN / REGISTRATION FEE (EXTREMELY CRITICAL):
   - Scour the ENTIRE document for any section, table, or paragraph discussing fees, pricing, HTM, investment, registration costs, or entry fees.
   - Look for terms like: "Biaya", "Pendaftaran", "HTM", "Registrasi", "Investasi", "Rp", "IDR", "Gratis", "Free", "Batch", "Early Bird", "Regular".
   - If fees vary by competition category or registration period (Batch 1, Batch 2, Early Bird, Regular, Mahasiswa vs Umum), list ALL options clearly formatted with newlines.
   - EXAMPLE: "Software Development: Rp 150.000 / tim\nCapture The Flag: Rp 100.000 / tim"
   - EXAMPLE: "Batch 1 (Early Bird): Rp 100.000 (1 - 15 Juli 2026)\nBatch 2 (Regular): Rp 150.000 (16 - 31 Juli 2026)"
   - ONLY if the document explicitly states it is free or no price appears anywhere in all pages, write "Gratis / Tidak dipungut biaya".

4. KEY REQUIREMENTS:
   - Extract ALL eligibility requirements, team size limits (min/max), required submission files/proposal formats, and mandatory rules stated in the guidebook.

5. JUDGING CRITERIA (KRITERIA PENILAIAN):
   - Extract EVERY judging criterion with its exact percentage weight.
   - IF the document specifies stages (e.g. Penyisihan vs Final), prefix each criterion with the stage name (e.g. "Babak Penyisihan - UI/UX (25%)", "Babak Final - Presentasi & Pitching (40%)").
   - IF no stages are mentioned, prefix with "Kriteria Umum - [Nama Kriteria] ([Bobot]%)".

6. COMPLETE RUNDOWN TIMELINE (EXTRACT ALL AGENDA STAGES):
   - Extract EVERY SINGLE event/stage in the official schedule (Pendaftaran, Pengumpulan Karya, Batas Pendaftaran, Technical Meeting, Babak Penyisihan, Pengumuman Finalis, Babak Final, Awarding/Pengumuman Pemenang).
   - DO NOT stop after 1 or 2 items. Extract the COMPLETE timeline from start to finish as listed in the PDF.
   - ONLY use real dates written in the PDF document.
   - For the iso_date field: convert the END DATE / DEADLINE of each agenda item to a precise ISO 8601 string with time default 12:00:00 PM (12 siang) (e.g., for "1 - 15 Juli 2026", use "2026-07-15T12:00:00.000Z").

7. EXTRACTED COMPETITION DEADLINES:
   - Carefully identify the 4 primary key milestone dates of the competition:
     1) "registration_deadline_iso": ISO 8601 date string of the LAST REGISTRATION WAVE/BATCH DEADLINE (e.g. Batch 2 / Gelombang 3 / Regular Deadline).
     2) "submission_deadline_iso": ISO 8601 date string of the FINAL SUBMISSION DEADLINE for proposal, project, or work submission.
     3) "event_start_at_iso": ISO 8601 date string of the FIRST EVENT START DATE / OPENING OF REGISTRATION.
     4) "event_end_at_iso": ISO 8601 date string of the FINAL EVENT END DATE / AWARDING CEREMONY.

Return ONLY a valid JSON object matching this schema:
{
  "summary": "Deskripsi murni kompetisi berdasarkan dokumen resmi.",
  "theme_and_subtheme": "Tema Utama: [Nama Tema Resmi dari Dokumen]\nSub-Tema:\n- [Nama Sub-Tema 1 dari Dokumen]\n- [Nama Sub-Tema 2 dari Dokumen]",
  "registration_fee": "Rincian biaya pendaftaran dari dokumen (contoh: 'Gelombang 1: Rp X / tim', atau 'Gratis / Tidak dipungut biaya')",
  "key_requirements": ["Persyaratan 1 dari dokumen", "Persyaratan 2 dari dokumen"],
  "important_dates": ["Tanggal 1 dari dokumen", "Tanggal 2 dari dokumen"],
  "judging_criteria": [
    "[Nama Babak/Tahap] - [Nama Kriteria Penilaian] ([Bobot Persentase]%)"
  ],
  "project_idea_suggestions": [
    {
      "title": "Judul Rekomendasi Ide Proyek",
      "description": "Deskripsi solusi proyek yang sangat relevan dengan tema kompetisi ini",
      "rationale": "Alasan ide ini kuat"
    }
  ],
  "extracted_info": {
    "organizer": "Nama pihak/lembaga penyelenggara resmi lomba (contoh: Puspresnas / Universitas Indonesia)",
    "theme": "Tema utama atau gambaran topik kompetisi (contoh: Digital Innovation for Sustainability)",
    "instagram_url": "URL Instagram resmi lomba jika ditemukan dalam dokumen (misal https://instagram.com/...), atau null jika tidak ada",
    "website_url": "URL website resmi lomba jika ditemukan dalam dokumen (misal https://...), atau null jika tidak ada",
    "location": "WAJIB DIISI! Tulis 'Online' jika seluruh kegiatan dilakukan secara daring/online/zoom/website, tulis 'Hybrid' jika kombinasi online & offline, atau tulis nama kota/tempat (misal: 'Jakarta' / 'Universitas Indonesia') jika luring. JANGAN diisi null jika ada petunjuk.",
    "notes": "Catatan ringkas penting tambahan (kontak person, email, discord, dll), atau null"
  },
  "extracted_deadlines": {
    "registration_deadline_iso": "ISO 8601 string tanggal akhir gelombang pendaftaran terakhir",
    "submission_deadline_iso": "ISO 8601 string tanggal terakhir submit proposal/project",
    "event_start_at_iso": "ISO 8601 string tanggal mulai pertama pendaftaran/event",
    "event_end_at_iso": "ISO 8601 string tanggal penutupan/awarding"
  },
  "rundown_timeline": [
    {
      "title": "Nama Agenda Resmi dari Tabel Dokumen",
      "date_str": "Tanggal lengkap persis seperti di dokumen (contoh: 1 - 15 Juli 2026)",
      "description": "Keterangan detail kegiatan dari dokumen",
      "iso_date": "ISO 8601 string dari tanggal AKHIR/DEADLINE event dengan jam default 12 siang"
    }
  ]
}`

    const userPromptText = `Analyze the attached guidebook PDF document for competition "${competition.name}".
${pdfExtractedText ? `\n--- EXTRACTED TEXT CONTENT FROM PDF GUIDEBOOK ---\n${pdfExtractedText}\n--- END EXTRACTED TEXT ---\n` : ''}
Inspect ALL pages, tables, images, and pricing sections in the PDF document.
Extract 100% of the real data: Overview, Main Theme, Subthemes/Categories, Registration Fees (for all categories/batches), Eligibility Requirements, ALL Judging Criteria (with stage prefixes and % weights), and ALL Rundown Timeline Dates from start to finish.`


    let parsedResult: any = null
    let modelUsed = preferred_model || 'gemini-3.6-flash'

    let geminiModels = ['gemini-3.6-flash', 'gemini-2.5-flash']
    if (preferred_model && preferred_model.startsWith('gemini')) {
      geminiModels = [preferred_model, ...geminiModels.filter((m) => m !== preferred_model)]
    }

    // Try OpenAI if requested
    if ((preferred_model === 'gpt-4o-mini' || preferred_model === 'gpt-4o') && openaiKey) {
      if (!pdfExtractedText || wordCount < 20) {
        addLog(`⚠️ OpenAI GPT API tidak mendukung pengiriman file PDF langsung dan teks PDF kosong/pendek (${wordCount} kata). Beralih ke Gemini Multimodal PDF Engine...`)
      } else {
        try {
          const modelReqStart = Date.now()
          addLog(`[5/6] Mengirimkan payload ke OpenAI (${preferred_model})...`)
          const res = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${openaiKey}`,
            },
            body: JSON.stringify({
              model: preferred_model,
              messages: [
                { role: 'system', content: systemPromptText },
                { role: 'user', content: userPromptText },
              ],
              response_format: { type: 'json_object' },
            }),
            signal: AbortSignal.timeout(30000),
          })

          const reqDuration = ((Date.now() - modelReqStart) / 1000).toFixed(2)

          if (res.ok) {
            const data = await res.json()
            const rawText = data.choices?.[0]?.message?.content
            if (rawText) {
              parsedResult = JSON.parse(rawText)
              modelUsed = preferred_model
              addLog(`✓ ${preferred_model} selesai memproses analisis (${reqDuration} detik)`)
            }
          } else {
            addLog(`⚠️ OpenAI ${preferred_model} mengembalikan HTTP status ${res.status}`)
          }
        } catch (e: any) {
          addLog(`⚠️ OpenAI ${preferred_model} error/timeout: ${e?.message || 'Error'}, beralih ke Gemini...`)
        }
      }
    }


    // Try Gemini models with multi-key failover
    if (!parsedResult && geminiKeys.length > 0) {
      for (let keyIdx = 0; keyIdx < geminiKeys.length; keyIdx++) {
        const currentGeminiKey = geminiKeys[keyIdx]
        const keyLabel = geminiKeys.length > 1 ? ` (Key #${keyIdx + 1})` : ''

        for (const modelName of geminiModels) {
          try {
            const modelReqStart = Date.now()
            addLog(`[5/6] Mengirimkan payload ke Gemini AI Model: ${modelName}${keyLabel}...`)
            const apiEndpointModel = modelName
            const parts: any[] = []
            if (pdfBase64) {
              parts.push({
                inlineData: { mimeType: pdfMimeType, data: pdfBase64 },
              })
            }
            parts.push({ text: userPromptText })

            const res = await fetch(
              `https://generativelanguage.googleapis.com/v1beta/models/${apiEndpointModel}:generateContent?key=${currentGeminiKey}`,
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
                addLog(`✓ ${modelName}${keyLabel} berhasil memproses analisis dokumen (${reqDuration} detik)`)
                break
              }
            } else if (res.status === 429) {
              addLog(`⚠️ Key #${keyIdx + 1} terkena Rate Limit (HTTP 429), berpindah ke Key berikutnya...`)
              break
            } else {
              addLog(`⚠️ Model ${modelName}${keyLabel} mengembalikan HTTP status ${res.status}`)
            }
          } catch (e: any) {
            addLog(`⚠️ Error pada model ${modelName}${keyLabel}: ${e?.message || 'Timeout'}`)
          }
        }

        if (parsedResult) break
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

    const shouldReplace = (key: string) => !replace_fields || replace_fields.length === 0 || replace_fields.includes(key)

    let existingAiSummary: any = null
    if (replace_fields && replace_fields.length > 0) {
      const { data } = await (supabase as any)
        .from('ai_summaries')
        .select('*')
        .eq('competition_id', competition_id)
        .maybeSingle()
      existingAiSummary = data
    }

    const summaryUpsertPayload: Record<string, any> = {
      competition_id,
      summary: shouldReplace('summary_theme') ? (parsedResult.summary ?? '') : (existingAiSummary?.summary ?? parsedResult.summary ?? ''),
      theme_and_subtheme: shouldReplace('summary_theme') ? (parsedResult.theme_and_subtheme ?? null) : (existingAiSummary?.theme_and_subtheme ?? null),
      registration_fee: shouldReplace('fee_requirements') ? (parsedResult.registration_fee ?? null) : (existingAiSummary?.registration_fee ?? null),
      key_requirements: shouldReplace('fee_requirements') ? (parsedResult.key_requirements ?? []) : (existingAiSummary?.key_requirements ?? []),
      important_dates: shouldReplace('dates') ? (parsedResult.important_dates ?? []) : (existingAiSummary?.important_dates ?? []),
      judging_criteria: shouldReplace('criteria_ideas') ? (parsedResult.judging_criteria ?? []) : (existingAiSummary?.judging_criteria ?? []),
      project_idea_suggestions: shouldReplace('criteria_ideas') ? (parsedResult.project_idea_suggestions ?? []) : (existingAiSummary?.project_idea_suggestions ?? []),
      pdf_size_kb: pdfSizeBytes ? Math.round(pdfSizeBytes / 1024) : (existingAiSummary?.pdf_size_kb ?? null),
      model_used: modelUsed,
      execution_time_ms: Date.now() - startTime,
      execution_log: logs,
      updated_at: new Date().toISOString(),
    }

    let { data: summaryRow, error: saveErr } = await (supabase as any)
      .from('ai_summaries')
      .upsert(summaryUpsertPayload, { onConflict: 'competition_id' })
      .select('*')
      .single()

    if (saveErr) {
      addLog(`⚠️ Error menyimpan dengan metadata logs (${saveErr.message}), mencoba fallback upsert standar...`)
      delete summaryUpsertPayload.execution_log
      delete summaryUpsertPayload.execution_time_ms
      delete summaryUpsertPayload.pdf_size_kb

      const fallbackRes = await (supabase as any)
        .from('ai_summaries')
        .upsert(summaryUpsertPayload, { onConflict: 'competition_id' })
        .select('*')
        .single()

      if (!fallbackRes.error) {
        summaryRow = fallbackRes.data
        addLog(`✓ Fallback upsert standar berhasil disimpan ke ai_summaries`)
      } else {
        addLog(`❌ Error fallback upsert: ${fallbackRes.error.message}`)
      }
    }

    // 1. Auto update competition dates & metadata columns from AI extraction
    const compUpdatePayload: Record<string, any> = {}

    const compDates = computeCompetitionDates(parsedResult)

    if (shouldReplace('dates')) {
      if (compDates.registration_deadline) compUpdatePayload.registration_deadline = compDates.registration_deadline
      if (compDates.submission_deadline) compUpdatePayload.submission_deadline = compDates.submission_deadline
      if (compDates.event_start_at) compUpdatePayload.event_start_at = compDates.event_start_at
      if (compDates.event_end_at) compUpdatePayload.event_end_at = compDates.event_end_at
    }

    const extInfo = parsedResult.extracted_info || {}

    if (shouldReplace('summary_theme')) {
      if (extInfo.theme && typeof extInfo.theme === 'string' && extInfo.theme.trim()) {
        compUpdatePayload.theme = extInfo.theme.trim()
      } else if (parsedResult.theme_and_subtheme && typeof parsedResult.theme_and_subtheme === 'string') {
        const firstLine = parsedResult.theme_and_subtheme.split('\n')[0].replace(/^Tema Utama:\s*/i, '').trim()
        if (firstLine && firstLine !== '[Tema Resmi]') {
          compUpdatePayload.theme = firstLine
        }
      }
    }

    if (shouldReplace('metadata')) {
      if (extInfo.organizer && typeof extInfo.organizer === 'string' && extInfo.organizer.trim()) {
        compUpdatePayload.organizer = extInfo.organizer.trim()
      }

      if (extInfo.instagram_url && typeof extInfo.instagram_url === 'string') {
        const cleanIg = extInfo.instagram_url.trim()
        if (/^https?:\/\/(www\.)?instagram\.com\//i.test(cleanIg)) {
          compUpdatePayload.instagram_url = cleanIg
        }
      }

      if (extInfo.website_url && typeof extInfo.website_url === 'string') {
        const cleanWeb = extInfo.website_url.trim()
        if (/^https?:\/\//i.test(cleanWeb)) {
          compUpdatePayload.website_url = cleanWeb
        }
      }

      let detectedLocation = (extInfo.location && typeof extInfo.location === 'string') ? extInfo.location.trim() : ''

      if (!detectedLocation) {
        const fullTextToScan = `${pdfExtractedText} ${parsedResult.summary || ''} ${JSON.stringify(parsedResult.key_requirements || [])} ${JSON.stringify(parsedResult.important_dates || [])}`.toLowerCase()
        const hasOnline = /online|daring|zoom|google meet|website|unggah|upload|submission|submit/i.test(fullTextToScan)
        const hasOffline = /luring|onsite|tatap muka|aula|gedung|kampus|universitas|jakrta|depok|bandung|yogyakarta|surabaya/i.test(fullTextToScan)
        const hasHybrid = /hybrid|hibrida/i.test(fullTextToScan) || (hasOnline && hasOffline)

        if (hasHybrid) {
          detectedLocation = 'Hybrid'
        } else if (hasOnline) {
          detectedLocation = 'Online'
        } else if (hasOffline) {
          detectedLocation = 'Onsite / Offline'
        } else {
          detectedLocation = 'Online'
        }
      }

      if (detectedLocation) {
        compUpdatePayload.location = detectedLocation
      }

      if (extInfo.notes && typeof extInfo.notes === 'string' && extInfo.notes.trim()) {
        compUpdatePayload.notes = extInfo.notes.trim()
      }
    }

    if (Object.keys(compUpdatePayload).length > 0) {
      const { error: compUpdateErr } = await (supabase as any)
        .from('competitions')
        .update(compUpdatePayload)
        .eq('id', competition_id)

      if (compUpdateErr) {
        addLog(`⚠️ Gagal memperbarui kolom kompetisi: ${compUpdateErr.message}`)
      } else {
        addLog(`✓ ${Object.keys(compUpdatePayload).length} Kolom Metadata Kompetisi berhasil ter-update otomatis`)
      }
    }

    // 2. Save rundown timeline items if present and enabled
    if (shouldReplace('rundown') || shouldReplace('dates')) {
      // Fetch latest competition row to ensure dates are accurate
      const { data: latestComp } = await supabase
        .from('competitions')
        .select('registration_deadline, submission_deadline, event_start_at, event_end_at')
        .eq('id', competition_id)
        .single()

      const activeDates = {
        registration_deadline: latestComp?.registration_deadline || compDates.registration_deadline,
        submission_deadline: latestComp?.submission_deadline || compDates.submission_deadline,
        event_start_at: latestComp?.event_start_at || compDates.event_start_at,
        event_end_at: latestComp?.event_end_at || compDates.event_end_at,
      }

      // Delete old auto-generated items first
      await supabase.from('rundown_items').delete().eq('competition_id', competition_id).eq('is_auto_generated', true)

      const allRundownInserts: any[] = []

      // A. Insert 4 primary milestone items if active dates exist
      if (activeDates.registration_deadline) {
        allRundownInserts.push({
          competition_id,
          title: 'Registration deadline',
          description: 'Batas akhir pendaftaran lomba',
          event_at: activeDates.registration_deadline,
          is_auto_generated: true,
          auto_source: 'registration_deadline',
        })
      }
      if (activeDates.submission_deadline) {
        allRundownInserts.push({
          competition_id,
          title: 'Submission deadline',
          description: 'Batas akhir pengumpulan berkas / proposal',
          event_at: activeDates.submission_deadline,
          is_auto_generated: true,
          auto_source: 'submission_deadline',
        })
      }
      if (activeDates.event_start_at) {
        allRundownInserts.push({
          competition_id,
          title: 'Event starts',
          description: 'Mulai pelaksanaan kegiatan lomba',
          event_at: activeDates.event_start_at,
          is_auto_generated: true,
          auto_source: 'event_start_at',
        })
      }
      if (activeDates.event_end_at) {
        allRundownInserts.push({
          competition_id,
          title: 'Event ends',
          description: 'Penutupan / pengumuman pemenang lomba',
          event_at: activeDates.event_end_at,
          is_auto_generated: true,
          auto_source: 'event_end_at',
        })
      }

      // B. Insert detailed guidebook timeline items if present
      if (shouldReplace('rundown') && Array.isArray(parsedResult.rundown_timeline)) {
        parsedResult.rundown_timeline.forEach((item: any) => {
          let validIsoDate: string | null = parseIndonesianDateToIso(item.date_str || '')
          if (!validIsoDate && item.iso_date && !isNaN(Date.parse(item.iso_date))) {
            validIsoDate = item.iso_date
          }
          if (!validIsoDate) {
            validIsoDate = parseIndonesianDateToIso(item.title || '')
          }
          if (!validIsoDate) {
            validIsoDate = new Date().toISOString()
          }
          if (validIsoDate.includes('T00:00:00') || validIsoDate.includes('T08:00:00')) {
            validIsoDate = validIsoDate.replace(/T\d{2}:\d{2}:\d{2}/, 'T12:00:00')
          }

          const title = item.title || 'Agenda Lomba'
          const description = item.description
            ? `[${item.date_str || ''}] ${item.description}`
            : item.date_str || ''

          // Check if this item duplicates one of the 4 milestone items exactly
          const isMilestoneDuplicate = allRundownInserts.some(
            (m) =>
              (m.title.toLowerCase() === title.toLowerCase() ||
                (m.auto_source === 'registration_deadline' && /pendaftaran|registrasi/i.test(title)) ||
                (m.auto_source === 'submission_deadline' && /pengumpulan|submission/i.test(title))) &&
              new Date(m.event_at).toDateString() === new Date(validIsoDate!).toDateString()
          )

          if (!isMilestoneDuplicate) {
            allRundownInserts.push({
              competition_id,
              title,
              description,
              event_at: validIsoDate,
              is_auto_generated: true,
              auto_source: `guidebook_${modelUsed}`,
            })
          }
        })
      }

      if (allRundownInserts.length > 0) {
        const { error: rundownErr } = await supabase.from('rundown_items').insert(allRundownInserts)
        if (rundownErr) {
          addLog(`⚠️ Gagal menyisipkan agenda rundown: ${rundownErr.message}`)
        } else {
          addLog(`✓ ${allRundownInserts.length} agenda rundown & milestone tanggal resmi berhasil disimpan ke kalender`)
        }
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
