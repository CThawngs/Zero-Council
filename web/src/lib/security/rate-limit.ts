import { serverEnv } from '../serverEnv.ts';

const DEFAULT_MAX_RATE_LIMIT_BUCKETS = 4096;

export interface RateLimitCheckOptions {
  scope: string;
  limit: number;
  windowMs: number;
  subject?: string;
  includeIp?: boolean;
  nowMs?: number;
  maxBuckets?: number;
}

export interface RateLimitResult {
  allowed: boolean;
  limit: number;
  remaining: number;
  resetEpochSeconds: number;
  retryAfterSeconds: number;
}

const buckets = new Map<string, number[]>();

const sanitiseToken = (value: string, maxLen = 160): string =>
  value.trim().toLowerCase().slice(0, maxLen) || 'unknown';

export const extractClientIp = (request: Request): string => {
  const forwarded = request.headers.get('x-forwarded-for');
  if (forwarded) {
    const first = forwarded.split(',')[0]?.trim();
    if (first) return sanitiseToken(first, 128);
  }
  const realIp = request.headers.get('x-real-ip')?.trim();
  if (realIp) return sanitiseToken(realIp, 128);
  return 'local';
};

const buildBucketKey = (request: Request, options: RateLimitCheckOptions): string => {
  const scope = sanitiseToken(options.scope, 80);
  const hasSubject = typeof options.subject === 'string' && options.subject.trim().length > 0;
  if (hasSubject && options.includeIp) {
    return `${scope}:ip:${extractClientIp(request)}:sub:${sanitiseToken(options.subject!)}`;
  }
  if (hasSubject) {
    return `${scope}:sub:${sanitiseToken(options.subject!)}`;
  }
  return `${scope}:ip:${extractClientIp(request)}`;
};

const isRateLimitBypassed = (): boolean =>
  serverEnv('ZC_DISABLE_RATE_LIMIT') === '1' && serverEnv('VERCEL') !== '1';

const evictExpiredAndBoundCapacity = (cutoffMs: number, maxBuckets: number): void => {
  if (buckets.size < maxBuckets) return;

  for (const [key, timestamps] of buckets) {
    const last = timestamps[timestamps.length - 1];
    if (last === undefined || last <= cutoffMs) {
      buckets.delete(key);
    }
  }

  while (buckets.size >= maxBuckets) {
    const oldestKey = buckets.keys().next().value;
    if (oldestKey === undefined) break;
    buckets.delete(oldestKey);
  }
};

export const checkRateLimit = (
  request: Request,
  options: RateLimitCheckOptions
): RateLimitResult => {
  const now = options.nowMs ?? Date.now();
  const limit = Math.max(1, Math.floor(options.limit));
  const windowMs = Math.max(1, Math.floor(options.windowMs));
  const maxBuckets = Math.max(1, Math.floor(options.maxBuckets ?? DEFAULT_MAX_RATE_LIMIT_BUCKETS));

  if (isRateLimitBypassed()) {
    return {
      allowed: true,
      limit,
      remaining: Math.max(0, limit - 1),
      resetEpochSeconds: Math.ceil((now + windowMs) / 1000),
      retryAfterSeconds: 0,
    };
  }

  const key = buildBucketKey(request, options);
  const cutoffMs = now - windowMs;
  const existing = buckets.get(key);
  const active = existing ? existing.filter((ts) => ts > cutoffMs) : [];

  if (existing) {
    buckets.delete(key);
  }

  if (active.length >= limit) {
    buckets.set(key, active);
    const oldest = active[0] ?? now;
    const resetMs = oldest + windowMs;
    return {
      allowed: false,
      limit,
      remaining: 0,
      resetEpochSeconds: Math.ceil(resetMs / 1000),
      retryAfterSeconds: Math.max(1, Math.ceil((resetMs - now) / 1000)),
    };
  }

  evictExpiredAndBoundCapacity(cutoffMs, maxBuckets);
  active.push(now);
  buckets.set(key, active);

  const oldest = active[0] ?? now;
  const resetMs = oldest + windowMs;
  return {
    allowed: true,
    limit,
    remaining: Math.max(0, limit - active.length),
    resetEpochSeconds: Math.ceil(resetMs / 1000),
    retryAfterSeconds: 0,
  };
};

const rateLimitHeaders = (result: RateLimitResult): Record<string, string> => {
  const headers: Record<string, string> = {
    'X-RateLimit-Limit': String(result.limit),
    'X-RateLimit-Remaining': String(result.remaining),
    'X-RateLimit-Reset': String(result.resetEpochSeconds),
    'Cache-Control': 'no-store',
  };
  if (!result.allowed) {
    headers['Retry-After'] = String(result.retryAfterSeconds);
  }
  return headers;
};

export const enforceRateLimit = (
  request: Request,
  options: RateLimitCheckOptions
): Response | null => {
  const result = checkRateLimit(request, options);
  if (result.allowed) return null;

  return Response.json(
    {
      ok: false,
      error: 'RATE_LIMITED',
      retryAfterSeconds: result.retryAfterSeconds,
    },
    {
      status: 429,
      headers: rateLimitHeaders(result),
    }
  );
};

export const resetRateLimitStore = (): void => {
  buckets.clear();
};

export const getRateLimitBucketCount = (): number => buckets.size;