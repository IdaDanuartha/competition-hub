import { createClient as createServerClient } from '@/lib/supabase/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'

export async function getEffectiveApiKeys(userId?: string): Promise<{
  geminiKeys: string[]
  geminiKey: string | undefined
  openaiKey: string | undefined
}> {
  let customGeminiKeys: string[] = []
  let customOpenAI: string | null = null

  try {
    const supabase = await createServerClient()
    let query = (supabase as any).from('user_settings').select('gemini_api_key, gemini_api_keys, openai_api_key')
    if (userId) {
      query = query.eq('id', userId)
    }
    const { data } = await query.limit(1).maybeSingle()

    if (data) {
      if (Array.isArray(data.gemini_api_keys) && data.gemini_api_keys.length > 0) {
        customGeminiKeys = data.gemini_api_keys.filter((k: any) => typeof k === 'string' && k.trim().length > 0)
      } else if (typeof data.gemini_api_key === 'string' && data.gemini_api_key.trim().length > 0) {
        customGeminiKeys = data.gemini_api_key.split(/[\n,;]+/).map((k: string) => k.trim()).filter(Boolean)
      }
      customOpenAI = data.openai_api_key || null
    } else {
      const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
      if (serviceRoleKey && process.env.NEXT_PUBLIC_SUPABASE_URL) {
        const adminSupabase = createAdminClient(process.env.NEXT_PUBLIC_SUPABASE_URL, serviceRoleKey)
        let adminQuery = adminSupabase.from('user_settings').select('gemini_api_key, gemini_api_keys, openai_api_key')
        if (userId) adminQuery = adminQuery.eq('id', userId)
        const adminRes = await adminQuery.limit(1).maybeSingle()
        if (adminRes.data) {
          const row = adminRes.data as any
          if (Array.isArray(row.gemini_api_keys) && row.gemini_api_keys.length > 0) {
            customGeminiKeys = row.gemini_api_keys.filter((k: any) => typeof k === 'string' && k.trim().length > 0)
          } else if (typeof row.gemini_api_key === 'string' && row.gemini_api_key.trim().length > 0) {
            customGeminiKeys = row.gemini_api_key.split(/[\n,;]+/).map((k: string) => k.trim()).filter(Boolean)
          }
          customOpenAI = row.openai_api_key || null
        }
      }
    }
  } catch (_e) {}

  const rawEnvGemini = process.env.GEMINI_API_KEY
  const envGemini = rawEnvGemini ? rawEnvGemini.replace(/^["']|["']$/g, '').trim() : undefined

  const rawEnvOpenAI = process.env.OPENAI_API_KEY
  const envOpenAI = rawEnvOpenAI ? rawEnvOpenAI.replace(/^["']|["']$/g, '').trim() : undefined

  // Combine user keys and env key as ultimate fallback
  const allGeminiKeys: string[] = []

  customGeminiKeys.forEach((key) => {
    const cleaned = key.replace(/^["']|["']$/g, '').trim()
    if (cleaned && !allGeminiKeys.includes(cleaned)) {
      allGeminiKeys.push(cleaned)
    }
  })

  if (envGemini && !allGeminiKeys.includes(envGemini)) {
    allGeminiKeys.push(envGemini)
  }

  const openaiKey = customOpenAI && customOpenAI.trim() ? customOpenAI.trim() : envOpenAI

  return {
    geminiKeys: allGeminiKeys,
    geminiKey: allGeminiKeys[0] || undefined,
    openaiKey,
  }
}
