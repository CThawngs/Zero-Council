import { createServerClient } from '@supabase/ssr'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'
import { serverEnv } from '../serverEnv.ts'

export async function createClient() {
  const cookieStore = await cookies()

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet, _headers) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch {
            // The `setAll` method was called from a Server Component.
            // This can be ignored if you have a proxy refreshing
            // user sessions.
          }
        },
      },
    }
  )
}

/**
 * Service-role client for Supabase Auth Admin API only (password reset by founder).
 * Server-only: SUPABASE_SERVICE_ROLE_KEY must never reach the browser.
 */
export function createAdminClient() {
  const url = serverEnv('SUPABASE_URL') ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = serverEnv('SUPABASE_SERVICE_ROLE_KEY');
  if (!url || !serviceRoleKey) throw new Error('SUPABASE_NOT_CONFIGURED');
  return createSupabaseClient(url, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}