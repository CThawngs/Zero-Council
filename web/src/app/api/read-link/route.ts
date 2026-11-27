import { currentUserOnly } from '@/lib/api/currentUserOnly';
import { UnreadableLink, readLink } from '@/lib/deliberation/read-link';
import { enforceRateLimit } from '@/lib/security/rate-limit';
import { readBoundedJson, verifySameOrigin } from '@/lib/security/request-guard';

const MAX_BODY_BYTES = 32 * 1024;

export async function POST(request: Request) {
  const csrfDenied = verifySameOrigin(request);
  if (csrfDenied) return csrfDenied;

  const { user, denied } = await currentUserOnly();
  if (denied) return denied;

  const limited = enforceRateLimit(request, {
    scope: 'deliberation:read-link',
    limit: 30,
    windowMs: 60_000,
    subject: user.email,
  });
  if (limited) return limited;

  const parsedBody = await readBoundedJson(request, MAX_BODY_BYTES);
  if (!parsedBody.ok) return parsedBody.response;
  const body = parsedBody.data;

  const url =
    typeof (body as { url?: unknown } | null)?.url === 'string'
      ? (body as { url: string }).url.trim()
      : '';
  if (!url) {
    return Response.json({ error: 'URL_REQUIRED' }, { status: 400 });
  }

  try {
    const reading = await readLink(url);
    return Response.json(reading);
  } catch (error) {
    if (error instanceof UnreadableLink) {
      return Response.json({ error: 'UNREADABLE_LINK', reason: error.reason }, { status: 422 });
    }
    return Response.json(
      { error: 'READ_FAILED', reason: 'Could not read this link.' },
      { status: 500 }
    );
  }
}
