import { serverEnv } from './serverEnv.ts';

/**
 * Local-only login override for E2E verification and offline development.
 * Hard-refused on Vercel so a misconfigured host can never log anonymous visitors in.
 */
export const devLoginEmail = (): string | null => {
  const email = serverEnv('ZC_DEV_LOGIN_EMAIL');
  if (!email) return null;
  if (serverEnv('VERCEL') === '1') {
    throw new Error(
      'ZC_DEV_LOGIN_EMAIL is set on a deployed host. Every visitor would be logged in as that ' +
        'account. Remove it from the host environment.'
    );
  }
  return email.trim().toLowerCase();
};

export const isSupabaseServerConfigured = (): boolean => {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  return Boolean(
    url &&
      key &&
      url !== 'https://placeholder.supabase.co' &&
      key !== 'placeholder-publishable-key'
  );
};
