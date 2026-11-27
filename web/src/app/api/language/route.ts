import { NextRequest, NextResponse } from 'next/server';
import { enforceRateLimit } from '@/lib/security/rate-limit';
import { readBoundedJson, verifySameOrigin } from '@/lib/security/request-guard';

const MAX_BODY_BYTES = 2 * 1024;

export async function POST(request: NextRequest) {
  const csrfDenied = verifySameOrigin(request);
  if (csrfDenied) return csrfDenied;

  const limited = enforceRateLimit(request, {
    scope: 'language:set',
    limit: 60,
    windowMs: 60_000,
  });
  if (limited) return limited;

  const parsedBody = await readBoundedJson<{ language?: unknown }>(request, MAX_BODY_BYTES);
  if (!parsedBody.ok) return parsedBody.response;

  const language =
    parsedBody.data && typeof parsedBody.data === 'object'
      ? parsedBody.data.language
      : undefined;

  if (language !== 'vi' && language !== 'en') {
    return NextResponse.json({ error: 'Invalid language' }, { status: 400 });
  }

  const response = NextResponse.json({ success: true });
  const isSecureTransport =
    request.nextUrl.protocol === 'https:' || process.env.VERCEL === '1';

  response.cookies.set('zc-lang', language, {
    httpOnly: false,
    secure: isSecureTransport,
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 24 * 365,
  });

  return response;
}
