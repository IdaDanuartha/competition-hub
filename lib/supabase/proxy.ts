import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

// 30 days in seconds — session persists this long without re-login
const SESSION_MAX_AGE = 60 * 60 * 24 * 30

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          // Extend each cookie to 30-day lifetime
          const extended = cookiesToSet.map(({ name, value, options }) => ({
            name,
            value,
            options: { ...options, maxAge: SESSION_MAX_AGE },
          }))
          extended.forEach(({ name, value }) => request.cookies.set(name, value))
          supabaseResponse = NextResponse.next({ request })
          extended.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  const {
    data: { user },
  } = await supabase.auth.getUser()

  const path = request.nextUrl.pathname
  const isPublicRoute = path.startsWith('/login') || path.startsWith('/register') || path.startsWith('/auth')

  if (!user && !isPublicRoute) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    const redirectResponse = NextResponse.redirect(url)
    supabaseResponse.cookies.getAll().forEach((c) => redirectResponse.cookies.set(c.name, c.value, c))
    return redirectResponse
  }

  if (user && (path.startsWith('/login') || path.startsWith('/register'))) {
    const url = request.nextUrl.clone()
    url.pathname = '/dashboard'
    const redirectResponse = NextResponse.redirect(url)
    supabaseResponse.cookies.getAll().forEach((c) => redirectResponse.cookies.set(c.name, c.value, c))
    return redirectResponse
  }

  return supabaseResponse
}
