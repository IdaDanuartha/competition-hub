import { NextResponse } from 'next/server'
import { createClient as createServerClient } from '@/lib/supabase/server'
import { compressPdfBuffer } from '@/lib/pdf-compressor'
import { createClient as createAdminClient } from '@supabase/supabase-js'

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url)
    const competition_id = searchParams.get('competition_id')
    if (!competition_id) {
      return NextResponse.json({ error: 'competition_id parameter is required' }, { status: 400 })
    }

    let supabase = await createServerClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
      if (serviceRoleKey) {
        supabase = createAdminClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, serviceRoleKey) as any
      }
    }

    const { data, error } = await supabase
      .from('chat_messages')
      .select('*')
      .eq('competition_id', competition_id)
      .order('created_at', { ascending: true })

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ messages: data || [] })
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || 'Server error' }, { status: 500 })
  }
}

export async function DELETE(req: Request) {
  try {
    const { searchParams } = new URL(req.url)
    const competition_id = searchParams.get('competition_id')
    if (!competition_id) {
      return NextResponse.json({ error: 'competition_id parameter is required' }, { status: 400 })
    }

    let supabase = await createServerClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
      if (serviceRoleKey) {
        supabase = createAdminClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, serviceRoleKey) as any
      }
    }

    const { error } = await supabase
      .from('chat_messages')
      .delete()
      .eq('competition_id', competition_id)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || 'Server error' }, { status: 500 })
  }
}

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
    let { data: { user } } = await supabase.auth.getUser()

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

    const userId = user?.id || competition.user_id

    // 2. Save latest user message to Supabase chat_messages table
    const lastUserMsg = messages[messages.length - 1]
    if (lastUserMsg && lastUserMsg.role === 'user') {
      await (supabase as any).from('chat_messages').insert({
        competition_id,
        user_id: userId,
        role: 'user',
        content: lastUserMsg.content,
      })
    }

    // 3. Fetch competition rundown items
    const { data: rundowns } = await supabase
      .from('rundown_items')
      .select('title, description, event_at')
      .eq('competition_id', competition_id)
      .order('event_at', { ascending: true })

    // 4. Fetch existing AI Summary
    const { data: aiSummary } = await supabase
      .from('ai_summaries')
      .select('*')
      .eq('competition_id', competition_id)
      .maybeSingle()

    // 5. Fetch latest guidebook document
    const { data: docs } = await supabase
      .from('competition_documents')
      .select('*')
      .eq('competition_id', competition_id)
      .order('uploaded_at', { ascending: false })
      .limit(1)

    const latestDoc = docs?.[0]
    let pdfBase64: string | null = null
    let pdfMimeType = 'application/pdf'
    let pdfExtractedText = ''

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
              const comp = await compressPdfBuffer(Buffer.from(buf))
              pdfBase64 = comp.compressedBuffer.toString('base64')
              pdfMimeType = 'application/pdf'
              pdfExtractedText = comp.extractedText
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
                      const comp = await compressPdfBuffer(Buffer.from(buf))
                      pdfBase64 = comp.compressedBuffer.toString('base64')
                      pdfMimeType = 'application/pdf'
                      pdfExtractedText = comp.extractedText
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

    // 6. Construct Static Context for PROMPT CACHING
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

${pdfExtractedText ? `EXTRACTED TEXT CONTENT FROM GUIDEBOOK PDF:\n"""\n${pdfExtractedText.slice(0, 30000)}\n"""\n` : ''}
GUIDEBOOK ATTACHED: ${pdfBase64 || pdfExtractedText ? 'Ya (Dokumen PDF dilampirkan dan dianalisis)' : 'Tidak ada dokumen PDF'}
`

    const systemInstructionText = `Anda adalah Asisten AI Cerdas khusus untuk kompetisi "${competition.name}".
Tugas utama Anda adalah membantu pengguna menjawab segala pertanyaan mengenai kompetisi ini (syarat pendaftaran, kriteria penilaian, tema/subtema, timeline, biaya, format karya, rekomendasi ide proyek, dll).

[KONTEKS DATA & GUIDEBOOK KOMPETISI]
${metadataContext}

ATURAN PENTING:
1. Baca dan manfaatkan seluruh konteks data kompetisi, ringkasan AI, serta dokumen PDF Guidebook yang dilampirkan.
2. Jawab pertanyaan pengguna secara akurat, lugas, ramah, dan terstruktur menggunakan bahasa Indonesia yang baik.
3. Gunakan format Markdown (bullet points, bold, dll) agar mudah dibaca.
4. Sebelum menyatakan suatu informasi "tidak ada", periksa ULANG seluruh isi dokumen PDF yang dilampirkan.
5. Jika informasi spesifik yang ditanyakan pengguna memang benar-benar tidak ada, nyatakan secara jujur bahwa informasi tersebut tidak tercantum dalam guidebook/sistem.`

    // Build OpenAI messages with static system prompt for Automatic Prompt Caching
    const openAiMessages = [
      { role: 'system', content: systemInstructionText },
      ...messages.map((m: { role: string; content: string }) => ({
        role: m.role === 'assistant' ? 'assistant' : 'user',
        content: m.content,
      })),
    ]

    // Build Gemini contents array with static systemInstruction for Context Caching
    const geminiContents: any[] = []
    if (pdfBase64) {
      geminiContents.push({
        role: 'user',
        parts: [{ inlineData: { mimeType: pdfMimeType, data: pdfBase64 } }, { text: 'Berikut adalah dokumen guidebook PDF kompetisi.' }],
      })
      geminiContents.push({
        role: 'model',
        parts: [{ text: 'Baik, saya telah membaca dan menyimpan dokumen PDF guidebook tersebut.' }],
      })
    }

    messages.forEach((m: { role: string; content: string }) => {
      geminiContents.push({
        role: m.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: m.content }],
      })
    })

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
            messages: openAiMessages,
          }),
          signal: AbortSignal.timeout(18000),
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
          const apiEndpointModel = modelName

          const res = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/${apiEndpointModel}:generateContent?key=${geminiKey}`,
            {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                systemInstruction: { parts: [{ text: systemInstructionText }] },
                contents: geminiContents,
              }),
              signal: AbortSignal.timeout(18000),
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
          } else {
            console.warn(`[Chat API] Gemini ${apiEndpointModel} returned HTTP ${res.status}`)
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
            messages: openAiMessages,
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

    // 7. Save assistant's reply into Supabase chat_messages table
    const { data: savedAssistantMsg } = await (supabase as any)
      .from('chat_messages')
      .insert({
        competition_id,
        user_id: userId,
        role: 'assistant',
        content: replyText,
        model_used: modelUsed,
        has_pdf: !!pdfBase64,
      })
      .select('*')
      .maybeSingle()

    return NextResponse.json({
      id: savedAssistantMsg?.id || Date.now().toString(),
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
