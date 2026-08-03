import { createClient as createServerClient } from '@/lib/supabase/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'

export async function getEffectiveApiKeys(userId?: string): Promise<{ geminiKey: string | undefined; openaiKey: string | undefined }> {
  let customGemini: string | null = null
  let customOpenAI: string | null = null

  try {
    const supabase = await createServerClient()
    let query = (supabase as any).from('user_settings').select('gemini_api_key, openai_api_key')
    if (userId) {
      query = query.eq('id', userId)
    }
    const { data } = await query.limit(1).maybeSingle()

    if (data) {
      customGemini = data.gemini_api_key || null
      customOpenAI = data.openai_api_key || null
    } else {
      const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
      if (serviceRoleKey && process.env.NEXT_PUBLIC_SUPABASE_URL) {
        const adminSupabase = createAdminClient(process.env.NEXT_PUBLIC_SUPABASE_URL, serviceRoleKey)
        let adminQuery = adminSupabase.from('user_settings').select('gemini_api_key, openai_api_key')
        if (userId) adminQuery = adminQuery.eq('id', userId)
        const adminRes = await adminQuery.limit(1).maybeSingle()
        if (adminRes.data) {
          customGemini = (adminRes.data as any).gemini_api_key || null
          customOpenAI = (adminRes.data as any).openai_api_key || null
        }
      }
    }
  } catch (_e) {}

  const rawEnvGemini = process.env.GEMINI_API_KEY
  const envGemini = rawEnvGemini ? rawEnvGemini.replace(/^["']|["']$/g, '').trim() : undefined

  const rawEnvOpenAI = process.env.OPENAI_API_KEY
  const envOpenAI = rawEnvOpenAI ? rawEnvOpenAI.replace(/^["']|["']$/g, '').trim() : undefined

  const geminiKey = customGemini && customGemini.trim() ? customGemini.trim() : envGemini
  const openaiKey = customOpenAI && customOpenAI.trim() ? customOpenAI.trim() : envOpenAI

  return { geminiKey, openaiKey }
}
