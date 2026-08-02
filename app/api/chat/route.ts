import { NextResponse } from 'next/server'
import { createClient as createServerClient } from '@/lib/supabase/server'
import { compressPdfBuffer } from '@/lib/pdf-compressor'
import { createClient as createAdminClient } from '@supabase/supabase-js'

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}))
    const { competition_id, messages = [], preferred_model } = body

    if (!competition_id) {
      return NextResponse.json({ error: 'competition_id is required' }, { status: 400 })
    }

    if (!Array.isArray(messages) || messages.length === 0) {
      return NextResponse.json({ error: 'messages array is required' }, { status: 400 })
    }

    const rawGeminiKey = process.env.GEMINI_API_KEY
    const geminiKey = rawGeminiKey ? rawGeminiKey.replace(/^["']|["']$/g, '') : undefined
    const rawOpenaiKey = process.env.OPENAI_API_KEY
    const openaiKey = rawOpenaiKey ? rawOpenaiKey.replace(/^["']|["']$/g, '') : undefined

    // 1. Supabase client setup (User cookie client with admin fallback)
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
      return NextResponse.json({ error: 'Competition not found' }, { status: 404 })
    }

    // 2. Fetch competition rundown items
    const { data: rundowns } = await supabase
      .from('rundown_items')
      .select('title, description, event_at')
      .eq('competition_id', competition_id)
      .order('event_at', { ascending: true })

    // 3. Fetch existing AI Summary
    const { data: aiSummary } = await supabase
      .from('ai_summaries')
      .select('*')
      .eq('competition_id', competition_id)
      .maybeSingle()

    // 4. Fetch latest guidebook document
    const { data: docs } = await supabase
      .from('competition_documents')
      .select('*')
      .eq('competition_id', competition_id)
      .order('uploaded_at', { ascending: false })
      .limit(1)

    const latestDoc = docs?.[0]
    let pdfBase64: string | null = null
    let pdfMimeType = 'application/pdf'

    if (latestDoc?.cloudinary_url) {
      const docUrl = latestDoc.cloudinary_url
      const urlsToTry = [
        docUrl,
        docUrl.includes('/image/upload/') ? docUrl.replace('/image/upload/', '/raw/upload/') : null,
      ].filter(Boolean) as string[]

      for (const candidateUrl of urlsToTry) {
        try {
          const res = await fetch(candidateUrl)
          if (res.ok) {
            const buf = await res.arrayBuffer()
            if (buf.byteLength > 1000) {
              const comp = compressPdfBuffer(Buffer.from(buf))
              pdfBase64 = comp.compressedBuffer.toString('base64')
              pdfMimeType = 'application/pdf'
              break
            }
          }
        } catch (_e) {
          // fetch error fallback
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
              const res = await fetch(resourceUrl, { headers: { Authorization: basicAuth } })
              if (res.ok) {
                const details = await res.json()
                if (details.secure_url) {
                  const downloadRes = await fetch(details.secure_url)
                  if (downloadRes.ok) {
                    const buf = await downloadRes.arrayBuffer()
                    if (buf.byteLength > 1000) {
                      const comp = compressPdfBuffer(Buffer.from(buf))
                      pdfBase64 = comp.compressedBuffer.toString('base64')
                      pdfMimeType = 'application/pdf'
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
    }

    // 5. Construct System Context & Instructions
    const metadataContext = `
COMPETITION DATA:
- Name: ${competition.name}
- Organizer: ${competition.organizer || 'Tidak disebutkan'}
- Theme / Scope: ${competition.theme || 'Tidak disebutkan'}
- Status: ${competition.status}
- Tags / Category: ${competition.tags?.join(', ') || 'Belum diisi'}
- Registration Deadline: ${competition.registration_deadline || 'Tidak ditentukan'}
- Submission Deadline: ${competition.submission_deadline || 'Tidak ditentukan'}
- Event Dates: ${competition.event_start_at || '-'} s/d ${competition.event_end_at || '-'}
- Location: ${competition.location || 'Online / Tidak ditentukan'}
- Team Name: ${competition.team_name || '-'}
- Team Members: ${competition.team_members?.join(', ') || '-'}
- Notes: ${competition.notes || '-'}
- Instagram: ${competition.instagram_url || '-'}
- Website: ${competition.website_url || '-'}

RUNDOWN TIMELINE:
${rundowns?.map((r) => `- [${r.event_at ? new Date(r.event_at).toLocaleDateString('id-ID') : 'N/A'}] ${r.title}: ${r.description || ''}`).join('\n') || 'Belum ada agenda'}

EXISTING AI SUMMARY ANALYSIS:
${aiSummary ? JSON.stringify({
  summary: aiSummary.summary,
  theme_and_subtheme: aiSummary.theme_and_subtheme,
  key_requirements: aiSummary.key_requirements,
  important_dates: aiSummary.important_dates,
  judging_criteria: aiSummary.judging_criteria,
  project_idea_suggestions: aiSummary.project_idea_suggestions,
}, null, 2) : 'Belum ada ringkasan AI sebelumnya'}

GUIDEBOOK ATTACHED: ${pdfBase64 ? 'Ya (Dokumen PDF dilampirkan dan dianalisis langsung)' : 'Tidak ada dokumen PDF'}
`

    const systemInstructionText = `Anda adalah Asisten AI Cerdas khusus untuk kompetisi "${competition.name}".
Tugas utama Anda adalah membantu pengguna menjawab segala pertanyaan mengenai kompetisi ini (syarat pendaftaran, kriteria penilaian, tema/subtema, timeline, biaya, format karya, rekomendasi ide proyek, dll).

ATURAN PENTING:
1. Baca dan manfaatkan seluruh konteks data kompetisi, ringkasan AI, serta dokumen PDF Guidebook yang dilampirkan.
2. Jawab pertanyaan pengguna secara akurat, lugas, ramah, dan terstruktur menggunakan bahasa Indonesia yang baik.
3. Gunakan format Markdown (bullet points, bold, dll) agar mudah dibaca.
4. Jika informasi spesifik yang ditanyakan pengguna memang tidak ada baik di data kompetisi maupun dokumen PDF, nyatakan secara jujur bahwa informasi tersebut tidak tercantum dalam guidebook/sistem.`

    const userPromptContent = `Berikut adalah seluruh riwayat percakapan pengguna dan konteks kompetisi:

[KONTEKS KOMPETISI]
${metadataContext}

[RIWAYAT PERCAKAPAN & PERTANYAAN]
${messages.map((m: { role: string; content: string }) => `${m.role.toUpperCase()}: ${m.content}`).join('\n\n')}

Jawablah pesan terakhir pengguna dengan jelas dan lengkap berdasarkan dokumen dan data kompetisi di atas.`

    let replyText = ''
    let modelUsed = preferred_model || 'gemini-3.6-flash'

    let geminiModels = ['gemini-3.6-flash', 'gemini-2.5-flash']
    if (preferred_model && preferred_model.startsWith('gemini')) {
      geminiModels = [preferred_model, ...geminiModels.filter((m) => m !== preferred_model)]
    }

    // Try OpenAI GPT if preferred
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
              { role: 'system', content: systemInstructionText },
              { role: 'user', content: userPromptContent },
            ],
          }),
          signal: AbortSignal.timeout(15000),
        })

        if (res.ok) {
          const data = await res.json()
          replyText = data.choices?.[0]?.message?.content || ''
          modelUsed = 'gpt-4o-mini'
        }
      } catch (_e) {
        console.warn('[Chat API] OpenAI preferred model failed, falling back to Gemini...')
      }
    }

    // Try Gemini models
    if (!replyText && geminiKey) {
      for (const modelName of geminiModels) {
        try {
          const apiEndpointModel = modelName.includes('2.0') ? 'gemini-2.0-flash-exp' : 'gemini-1.5-flash'
          const parts: any[] = []
          if (pdfBase64) {
            parts.push({
              inlineData: { mimeType: pdfMimeType, data: pdfBase64 },
            })
          }
          parts.push({ text: userPromptContent })

          const res = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/${apiEndpointModel}:generateContent?key=${geminiKey}`,
            {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                systemInstruction: { parts: [{ text: systemInstructionText }] },
                contents: [{ parts }],
              }),
              signal: AbortSignal.timeout(15000),
            }
          )

          if (res.ok) {
            const data = await res.json()
            const candidateText = data.candidates?.[0]?.content?.parts?.[0]?.text
            if (candidateText) {
              replyText = candidateText
              modelUsed = modelName
              break
            }
          }
        } catch (e) {
          console.warn(`[Chat API] Gemini model ${modelName} failed:`, e)
        }
      }
    }

    // OpenAI fallback
    if (!replyText && openaiKey) {
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
              { role: 'system', content: systemInstructionText },
              { role: 'user', content: userPromptContent },
            ],
          }),
        })

        if (res.ok) {
          const data = await res.json()
          replyText = data.choices?.[0]?.message?.content || ''
          modelUsed = 'gpt-4o-mini'
        }
      } catch (_e) {
        console.error('[Chat API] OpenAI fallback failed')
      }
    }

    if (!replyText) {
      return NextResponse.json({ error: 'Gagal mendapatkan respon dari AI.' }, { status: 500 })
    }

    return NextResponse.json({
      role: 'assistant',
      content: replyText,
      model_used: modelUsed,
      has_pdf: !!pdfBase64,
    })
  } catch (err: any) {
    console.error('[Chat API Route Error]:', err)
    return NextResponse.json({ error: err.message || 'Internal server error' }, { status: 500 })
  }
}
