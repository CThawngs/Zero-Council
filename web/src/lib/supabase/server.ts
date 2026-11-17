import { createServerClient } from '@supabase/ssr';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';
import { serverEnv } from '../serverEnv.ts';

const FALLBACK_SUPABASE_URL = 'https://placeholder.supabase.co';
const FALLBACK_SUPABASE_KEY = 'placeholder-publishable-key';

export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || FALLBACK_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || FALLBACK_SUPABASE_KEY,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // Called from a Server Component; session refresh happens in proxy.
          }
        },
      },
    }
  );
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
