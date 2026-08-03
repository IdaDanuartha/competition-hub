import { NextResponse } from 'next/server'
import { createClient as createServerClient } from '@/lib/supabase/server'
import { compressPdfBuffer } from '@/lib/pdf-compressor'
import { createClient as createAdminClient } from '@supabase/supabase-js'

export async function POST(req: Request) {
  try {
    const formData = await req.formData()
    const file = formData.get('file') as File | null
    const competition_id = (formData.get('competition_id') || formData.get('competitionId')) as string | null
    const preferred_model = (formData.get('preferred_model') || formData.get('preferredModel')) as string | null

    if (!file || !competition_id) {
      return NextResponse.json({ error: 'File PDF dan competition_id wajib diberikan' }, { status: 400 })
    }

    if (!file.name.toLowerCase().endsWith('.pdf') && file.type !== 'application/pdf') {
      return NextResponse.json({ error: 'Format berkas harus berupa PDF' }, { status: 400 })
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
      return NextResponse.json({ error: 'Kompetisi tidak ditemukan di database' }, { status: 404 })
    }

    // Fetch AI summary for judging criteria and requirements
    const { data: summaryRow } = await supabase
      .from('ai_summaries')
      .select('*')
      .eq('competition_id', competition_id)
      .maybeSingle()

    // Read PDF file into memory buffer
    const arrayBuffer = await file.arrayBuffer()
    const pdfBuffer = Buffer.from(arrayBuffer)
    const compression = await compressPdfBuffer(pdfBuffer)
    const pdfBase64 = compression.compressedBuffer.toString('base64')
    const pdfExtractedText = compression.extractedText

    const judgingCriteria = (summaryRow as any)?.judging_criteria ?? []
    const keyRequirements = (summaryRow as any)?.key_requirements ?? []
    const themeAndSubtheme = (summaryRow as any)?.theme_and_subtheme ?? ''

    const systemPromptText = `You are a world-class, highly strict competition judge and expert proposal evaluator.
Your task is to analyze the attached proposal/pitch deck PDF document for the competition "${competition.name}" and evaluate its quality, feasibility, alignment, and winning potential.

COMPETITION CONTEXT & JUDGING CRITERIA:
- Competition Name: "${competition.name}"
- Organizer: "${competition.organizer || 'Official Panitia'}"
- Theme & Subthemes: "${themeAndSubtheme || 'General'}"
- Official Judging Criteria (with weights %):
${judgingCriteria.length > 0 ? judgingCriteria.map((c: string) => `- ${c}`).join('\n') : '- Kualitas Teknis & Inovasi (30%)\n- Desain & UI/UX (30%)\n- Kelayakan & Dampak (20%)\n- Penyampaian & Presentasi (20%)'}
- Key Requirements:
${keyRequirements.length > 0 ? keyRequirements.map((r: string) => `- ${r}`).join('\n') : '- Format proposal standar PDF'}

CRITICAL EVALUATION MANDATES:
1. OVERALL SCORE (0-100): Calculate an honest, realistic overall score based on the judging criteria weights.
2. CRITERIA SCORES BREAKDOWN:
   - For EACH official judging criterion listed above, give a specific score and max_score (e.g. 24 out of 30), and write 1-2 constructive sentences of feedback.
3. SUMMARY: Write a 2-3 sentence executive summary of the proposal quality.
4. STRENGTHS (3-4 points): Highlight what the proposal did exceptionally well.
5. WEAKNESSES & RISKS (3-4 points): Identify critical gaps, missing items, or weaknesses that could lose points.
6. ACTIONABLE RECOMMENDATIONS (3-5 points): Provide concrete, step-by-step improvements the team must make before submitting to increase their winning score.

Return ONLY a valid JSON object matching this schema:
{
  "overall_score": 85,
  "summary": "Ringkasan evaluasi eksekutif mengenai proposal.",
  "criteria_scores": [
    {
      "criterion": "Babak Penyisihan - UI/UX (30%)",
      "score": 25,
      "max_score": 30,
      "feedback": "Desain UI sangat bersih dan modern, namun alur user flow pada halaman checkout masih butuh penyempurnaan."
    }
  ],
  "strengths": [
    "Pernyataan masalah sangat jelas dan didukung data pendukung yang kuat.",
    "Solusi yang ditawarkan sangat relevan dengan sub-tema kompetisi."
  ],
  "weaknesses": [
    "Analisis kompetitor belum dijelaskan secara mendalam.",
    "Bagan arsitektur sistem belum tercantum di dalam berkas proposal."
  ],
  "actionable_recommendations": [
    "Tambahkan 1 halaman tabel komparasi fitur dengan produk kompetitor.",
    "Sertakan diagram arsitektur teknis di bagian metodologi pengembangan."
  ]
}`

    const userPromptText = `Evaluate the attached proposal/pitch deck PDF file "${file.name}" for competition "${competition.name}".
${pdfExtractedText ? `\n--- EXTRACTED TEXT CONTENT FROM PROPOSAL PDF ---\n${pdfExtractedText}\n--- END EXTRACTED TEXT ---\n` : ''}
Inspect ALL pages, diagrams, text, and structure of the proposal PDF. Perform a rigorous, honest, and comprehensive judge evaluation according to the prompt instructions above.`

    let parsedResult: any = null
    let modelUsed = preferred_model || 'gemini-3.6-flash'

    let geminiModels = ['gemini-3.6-flash', 'gemini-2.5-flash']
    if (preferred_model && preferred_model.startsWith('gemini')) {
      geminiModels = [preferred_model, ...geminiModels.filter((m) => m !== preferred_model)]
    }

    // Try OpenAI if requested
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
          signal: AbortSignal.timeout(30000),
        })

        if (res.ok) {
          const data = await res.json()
          const rawText = data.choices?.[0]?.message?.content
          if (rawText) {
            parsedResult = JSON.parse(rawText)
            modelUsed = 'gpt-4o-mini'
          }
        }
      } catch (_e) {}
    }

    // Try Gemini models
    if (!parsedResult && geminiKey) {
      for (const modelName of geminiModels) {
        try {
          const parts: any[] = []
          if (pdfBase64) {
            parts.push({
              inlineData: { mimeType: 'application/pdf', data: pdfBase64 },
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
              signal: AbortSignal.timeout(30000),
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
        } catch (_e) {}
      }
    }

    if (!parsedResult) {
      return NextResponse.json(
        { error: 'Gagal mengevaluasi proposal. Harap coba lagi dengan file PDF yang valid atau ganti model AI.' },
        { status: 500 }
      )
    }

    // Save review result to Supabase Database
    const { data: reviewRow, error: saveErr } = await (supabase as any)
      .from('proposal_reviews')
      .insert({
        competition_id,
        file_name: file.name,
        overall_score: Math.min(100, Math.max(0, Number(parsedResult.overall_score) || 75)),
        summary: parsedResult.summary || 'Evaluasi proposal telah selesai.',
        criteria_scores: parsedResult.criteria_scores || [],
        strengths: parsedResult.strengths || [],
        weaknesses: parsedResult.weaknesses || [],
        actionable_recommendations: parsedResult.actionable_recommendations || [],
        model_used: modelUsed,
      })
      .select('*')
      .single()

    if (saveErr) {
      console.error('Error saving proposal review:', saveErr)
      return NextResponse.json({
        id: 'temp-' + Date.now(),
        competition_id,
        file_name: file.name,
        overall_score: Math.min(100, Math.max(0, Number(parsedResult.overall_score) || 75)),
        summary: parsedResult.summary || 'Evaluasi proposal telah selesai.',
        criteria_scores: parsedResult.criteria_scores || [],
        strengths: parsedResult.strengths || [],
        weaknesses: parsedResult.weaknesses || [],
        actionable_recommendations: parsedResult.actionable_recommendations || [],
        model_used: modelUsed,
        created_at: new Date().toISOString(),
      })
    }

    // Note: Buffer and file object are not stored in Supabase Storage, memory garbage collected immediately.
    return NextResponse.json(reviewRow)
  } catch (err: any) {
    console.error('Review proposal route exception:', err)
    return NextResponse.json({ error: err?.message || 'Server error' }, { status: 500 })
  }
}
