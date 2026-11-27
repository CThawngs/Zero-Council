import { getEncryptionMode, isEncryptionKeyConfigured } from '@/lib/crypto/providerKeys';
import { isSupabaseServerConfigured } from '@/lib/devAuth';
import { isPayosConfigured } from '@/lib/payos/config';

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
    payosConfigured: isPayosConfigured(),
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
