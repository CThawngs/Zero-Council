import { NextResponse } from 'next/server'
import { type EmailOtpType } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/server'
import { needsPasswordSet } from '@/lib/auth-password'

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)

  // Determine correct origin (handle reverse proxy / load balancer headers in production)
  const isLocalEnv = process.env.NODE_ENV === 'development'
  const forwardedHost = request.headers.get('x-forwarded-host')
  const forwardedProto = request.headers.get('x-forwarded-proto') || 'https'
  const redirectOrigin = !isLocalEnv && forwardedHost
    ? `${forwardedProto}://${forwardedHost}`
    : origin

  // Safe redirect path validation (prevent open redirects like //evil.com)
  let next = searchParams.get('next') ?? '/'
  if (!next.startsWith('/') || next.startsWith('//')) {
    next = '/'
  }

  // 1. Check if OAuth provider returned an error directly in query params
  const oauthError = searchParams.get('error')
  const oauthErrorCode = searchParams.get('error_code')
  const oauthErrorDescription = searchParams.get('error_description')

  if (oauthError || oauthErrorDescription || oauthErrorCode) {
    const errorUrl = new URL('/auth/auth-code-error', redirectOrigin)
    if (oauthError) errorUrl.searchParams.set('error', oauthError)
    if (oauthErrorCode) errorUrl.searchParams.set('code', oauthErrorCode)
    if (oauthErrorDescription) errorUrl.searchParams.set('message', oauthErrorDescription)
    return NextResponse.redirect(errorUrl.toString())
  }

  // 2. Email OTP verification (token_hash & type)
  const token_hash = searchParams.get('token_hash')
  const type = searchParams.get('type') as EmailOtpType | null

  if (token_hash && type) {
    const supabase = await createClient()
    const { error } = await supabase.auth.verifyOtp({
      type,
      token_hash,
    })

    if (!error) {
      // Riêng luồng tạo mật khẩu chuyển về form đặt mật khẩu
      if (type === 'recovery')
        return NextResponse.redirect(`${redirectOrigin}/auth?reset=1`);

      return NextResponse.redirect(`${redirectOrigin}${next}`)
    }

    const errorUrl = new URL('/auth/auth-code-error', redirectOrigin)
    errorUrl.searchParams.set('code', error.code || 'unknown_error')
    errorUrl.searchParams.set('message', error.message)
    return NextResponse.redirect(errorUrl.toString())
  }

  // 3. OAuth code exchange (code)
  const code = searchParams.get('code')
  if (code) {
    const supabase = await createClient()
    const { error } = await supabase.auth.exchangeCodeForSession(code)

    if (!error) {
      // Forgot-password link carries ?next=/auth?reset=1: hold the fresh session
      // on the set-password form instead of pushing an email/password user to
      // the dashboard (they already satisfy needsPasswordSet).
      const { data: { user } } = await supabase.auth.getUser();
      const wantsReset = /[?&]reset=1/.test(next);
      if (wantsReset) {
        return NextResponse.redirect(`${redirectOrigin}/auth?reset=1`)
      }
      // Force Google-new users (no password claim) to create one before dashboard.
      // Merged email+Google accounts have has_password=true and pass straight through.
      const isGoogleOnly = needsPasswordSet(user);

      if (isGoogleOnly) {
        return NextResponse.redirect(`${redirectOrigin}/auth`)
      }

      return NextResponse.redirect(`${redirectOrigin}${next}`)
    }

    const errorUrl = new URL('/auth/auth-code-error', redirectOrigin)
    errorUrl.searchParams.set('code', error.code || 'unknown_error')
    errorUrl.searchParams.set('message', error.message)
    return NextResponse.redirect(errorUrl.toString())
  }

  // 4. Missing both OTP tokens and OAuth code
  const errorUrl = new URL('/auth/auth-code-error', redirectOrigin)
  errorUrl.searchParams.set('code', 'missing_code')
  errorUrl.searchParams.set('message', 'No authentication code or token was provided.')
  return NextResponse.redirect(errorUrl.toString())
}
