import { createClient } from 'jsr:@supabase/supabase-js@2'

const CLOUD_NAME = Deno.env.get('CLOUDINARY_CLOUD_NAME') || ''
const API_KEY = Deno.env.get('CLOUDINARY_API_KEY') || ''
const API_SECRET = Deno.env.get('CLOUDINARY_API_SECRET')

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

async function sha1Hex(input: string): Promise<string> {
  const data = new TextEncoder().encode(input)
  const hashBuffer = await crypto.subtle.digest('SHA-1', data)
  return Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })Upload failed: Upload preset not found


  }

  const authHeader = req.headers.get('Authorization')
  if (!authHeader) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_ANON_KEY')!,
    { global: { headers: { Authorization: authHeader } } }
  )
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  let body: any = {}
  try {
    body = await req.json()
  } catch (_e) {
    // empty body
  }

  const competitionId = body.competitionId ?? 'default'
  const folder = `competition-hub/${competitionId}`
  const timestamp = Math.floor(Date.now() / 1000)

  if (!API_SECRET) {
    return new Response(
      JSON.stringify({ unsigned: true, cloudName: CLOUD_NAME, apiKey: API_KEY, folder }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }

  const paramsToSign = `folder=${folder}&timestamp=${timestamp}${API_SECRET}`
  const signature = await sha1Hex(paramsToSign)

  return new Response(
    JSON.stringify({ signature, timestamp, apiKey: API_KEY, cloudName: CLOUD_NAME, folder }),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  )
})
