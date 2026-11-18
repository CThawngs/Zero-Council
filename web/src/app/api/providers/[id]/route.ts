/**
 * GET /api/providers/[id]
 *
 * Returns public metadata for one connected provider — whether it has a key,
 * the protocol, and the base URL. The raw API key is NEVER returned to the
 * browser; only `hasKey: boolean` signals connectivity.
 */

import { currentUserOnly } from '@/lib/api/currentUserOnly';
import { listProviderKeys } from '@/lib/store/providerKeys';

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { user, denied } = await currentUserOnly();
  if (denied) return denied;

  const { id: providerId } = await params;
  if (!providerId) {
    return Response.json({ error: 'PROVIDER_ID_REQUIRED' }, { status: 400 });
  }

  try {
    const records = await listProviderKeys(user.email);
    const record = records.find((r) => r.provider === providerId);

    if (!record) {
      return Response.json({ hasKey: false });
    }

    // Return only public metadata — key is intentionally absent.
    return Response.json({
      hasKey: true,
      protocol: record.protocol ?? null,
      baseUrl: record.baseUrl ?? null,
      model: record.model,
      models: record.models ?? [record.model],
    });
  } catch (error) {
    console.error('[providers/id] lookup failed:', (error as Error).message);
    return Response.json({ error: 'LOOKUP_FAILED' }, { status: 500 });
  }
}
