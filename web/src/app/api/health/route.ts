import { getEncryptionMode, isEncryptionKeyConfigured } from '@/lib/crypto/providerKeys';
import { isSupabaseServerConfigured } from '@/lib/devAuth';
import { serverEnv } from '@/lib/serverEnv';

const HEALTH_HEADERS = {
  'Cache-Control': 'no-store, max-age=0',
} as const;

const buildHealthPayload = () => ({
  status: 'ok' as const,
  service: 'zero-council' as const,
  timestamp: new Date().toISOString(),
  uptimeSeconds: Math.floor(process.uptime()),
  checks: {
    supabaseConfigured: isSupabaseServerConfigured(),
    payosConfigured: Boolean(
      (serverEnv('PAYOS_CLIENT_ID') || serverEnv('PAYLOS_CLIENT_ID')) &&
        (serverEnv('PAYOS_API_KEY') || serverEnv('PAYLOS_API_KEY')) &&
        (serverEnv('PAYOS_CHECKSUM_KEY') || serverEnv('PAYLOS_CHECKSUM_KEY'))
    ),
    encryptionKeyConfigured: isEncryptionKeyConfigured(),
    // Which key protects stored provider keys — a label only, never key material.
    encryptionMode: getEncryptionMode(),
  },
});

export async function GET() {
  return Response.json(buildHealthPayload(), {
    status: 200,
    headers: HEALTH_HEADERS,
  });
}

export async function HEAD() {
  return new Response(null, {
    status: 200,
    headers: HEALTH_HEADERS,
  });
}