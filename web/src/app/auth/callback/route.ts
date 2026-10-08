import { NextResponse } from 'next/server'

import { type EmailOtpType } from '@supabase/supabase-js'
// The client you created from the Server-Side Auth instructions
import { createClient } from '@/lib/supabase/server'

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  // Hằng cho Email & Password
  const token_hash = searchParams.get('token_hash')
  const type = searchParams.get('type') as EmailOtpType | null
  // Hằng cho Google OAuth
  const code = searchParams.get('code')
  // if "next" is in param, use it as the redirect URL
  let next = searchParams.get('next') ?? '/'
  if (!next.startsWith('/')) {
    // if "next" is not a relative URL, use the default
    next = '/'
  }

  let errorCode = null;
  let errorMsg = null;

  // Kiểm tra tồn tại đăng ký qua Email
  if (token_hash && type) {
    const supabase = await createClient()

    const { error } = await supabase.auth.verifyOtp({
      type,
      token_hash,
    })
    if (!error) {
      // redirect user to specified redirect URL or root of app
      return NextResponse.redirect(`${origin}${next}`);
    }

    errorCode = encodeURIComponent(error.code || 'unknown_error')
    errorMsg = encodeURIComponent(error.message)
  }

  // Kiểm tra tồn tại đăng ký qua Google
  if (code) {
    const supabase = await createClient()
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    if (!error) {
      const forwardedHost = request.headers.get('x-forwarded-host') // original origin before load balancer
      const isLocalEnv = process.env.NODE_ENV === 'development'
      if (isLocalEnv) {
        // we can be sure that there is no load balancer in between, so no need to watch for X-Forwarded-Host
        return NextResponse.redirect(`${origin}${next}`)
      } else if (forwardedHost) {
        return NextResponse.redirect(`https://${forwardedHost}${next}`)
      } else {
        return NextResponse.redirect(`${origin}${next}`)
      }
    }

    errorCode = encodeURIComponent(error.code || 'unknown_error')
    errorMsg = encodeURIComponent(error.message)
  }

  // return the user to an error page with instructions
  if (errorCode && errorMsg)
    return NextResponse.redirect(`${origin}/auth/auth-code-error?code=${errorCode}&message=${errorMsg}`)

  return NextResponse.redirect(`${origin}/auth/auth-code-error`)
}