/**
 * Unified Server-Side Request Forgery (SSRF) address and URL guard.
 *
 * Why a single module:
 * - User-supplied URLs reach the server through two paths: link attachment reading (`read-link.ts`)
 *   and custom BYOK provider gateways (`verify.ts`, `resolve-target.ts`, `/api/providers/*`).
 * - Maintaining separate IP checks allowed subtle divergences: `new URL('https://[::ffff:169.254.169.254]')`
 *   rewrites the IPv4-mapped IPv6 literal into hex form (`[::ffff:a9fe:a9fe]`), `fe80::/10` spans
 *   `fe80`..`febf`, and DNS names can resolve (or rebind) to private addresses.
 *
 * Design constraints:
 * - Zero static `node:*` top-level imports so shared modules (`verify.ts`) remain safe in client
 *   bundles while server callers resolve `node:dns/promises` via `process.getBuiltinModule`.
 * - Erasable TypeScript syntax only (no `enum`, no parameter properties) so `node --test` executes
 *   it directly under strip-only mode.
 */

export type DnsLookupEntry = {
  address: string;
  family?: number;
};

export type DnsLookupFn = (
  hostname: string,
  options: { all: true }
) => Promise<DnsLookupEntry[]>;

export type UnsafeRemoteUrlCode =
  | 'INVALID_URL'
  | 'UNSAFE_PROTOCOL'
  | 'CREDENTIALS_NOT_ALLOWED'
  | 'BLOCKED_ADDRESS'
  | 'DNS_LOOKUP_FAILED';

/**
 * Structured SSRF validation error. Messages deliberately omit resolved IP addresses so callers
 * can never leak internal network topology back to an untrusted client.
 */
export class UnsafeRemoteUrlError extends Error {
  readonly code: UnsafeRemoteUrlCode;

  constructor(code: UnsafeRemoteUrlCode, message: string) {
    super(message);
    this.name = 'UnsafeRemoteUrlError';
    this.code = code;
  }
}

export interface RemoteUrlCheckOptions {
  /** Require `https:` (default `false`, allowing both `http:` and `https:`). */
  requireHttps?: boolean;
  /** Permit loopback/private literals and skip DNS checks (local dev opt-in only). */
  allowPrivateNetwork?: boolean;
}

export interface AssertSafeRemoteUrlOptions extends RemoteUrlCheckOptions {
  /** Injected DNS resolver for deterministic unit tests; defaults to `node:dns/promises.lookup`. */
  lookupImpl?: DnsLookupFn;
}

/**
 * Parses a strict dotted-quad IPv4 literal (`a.b.c.d`) into four `0..255` octets.
 * Leading zeros (e.g. `010.0.0.1`) are rejected so octal/decimal ambiguity cannot slip through.
 */
export const parseIpv4Octets = (raw: string): [number, number, number, number] | null => {
  const parts = raw.split('.');
  if (parts.length !== 4) return null;
  const octets: number[] = [];
  for (const part of parts) {
    if (!/^(?:0|[1-9]\d{0,2})$/.test(part)) return null;
    const value = Number(part);
    if (!Number.isInteger(value) || value < 0 || value > 255) return null;
    octets.push(value);
  }
  return [octets[0], octets[1], octets[2], octets[3]];
};

/**
 * Parses an IPv6 literal (with or without outer `[...]`, compressed `::`, or trailing dotted IPv4
 * such as `::ffff:169.254.169.254`) into eight 16-bit words (`0..0xffff`).
 * Zone identifiers (`%eth0`) are rejected (`null`).
 */
export const parseIpv6Words = (raw: string): number[] | null => {
  const bare = raw.replace(/^\[|\]$/g, '').toLowerCase();
  if (!bare.includes(':') || bare.includes('%')) return null;

  let working = bare;
  let ipv4Tail: [number, number] | null = null;

  const lastColon = working.lastIndexOf(':');
  const tailSegment = working.slice(lastColon + 1);
  if (tailSegment.includes('.')) {
    const v4 = parseIpv4Octets(tailSegment);
    if (!v4) return null;
    ipv4Tail = [(v4[0] << 8) | v4[1], (v4[2] << 8) | v4[3]];
    working = working.slice(0, lastColon);
    if (working.endsWith(':')) {
      // Preserve `::` compression marker when dotted IPv4 followed `::` (e.g. `::127.0.0.1`).
      working = `${working}:`;
    }
  }

  const doubleColonParts = working.split('::');
  if (doubleColonParts.length > 2) return null;

  const parseSide = (side: string): number[] | null => {
    if (side === '') return [];
    const groups = side.split(':');
    const words: number[] = [];
    for (const group of groups) {
      if (!/^[0-9a-f]{1,4}$/.test(group)) return null;
      words.push(Number.parseInt(group, 16));
    }
    return words;
  };

  const targetWords = ipv4Tail ? 6 : 8;
  let words: number[];

  if (doubleColonParts.length === 2) {
    const left = parseSide(doubleColonParts[0]);
    const right = parseSide(doubleColonParts[1]);
    if (!left || !right) return null;
    const missing = targetWords - (left.length + right.length);
    if (missing < 1) return null;
    words = [...left, ...new Array<number>(missing).fill(0), ...right];
  } else {
    const full = parseSide(doubleColonParts[0]);
    if (!full || full.length !== targetWords) return null;
    words = full;
  }

  if (ipv4Tail) words.push(ipv4Tail[0], ipv4Tail[1]);
  return words.length === 8 ? words : null;
};

const isBlockedIpv4Octets = ([a, b, c]: [number, number, number, number]): boolean => {
  if (a === 0) return true; // 0.0.0.0/8 ("this network", RFC 1122)
  if (a === 10) return true; // 10.0.0.0/8 (RFC 1918 private)
  if (a === 100 && b >= 64 && b <= 127) return true; // 100.64.0.0/10 (RFC 6598 CGNAT)
  if (a === 127) return true; // 127.0.0.0/8 (loopback)
  if (a === 169 && b === 254) return true; // 169.254.0.0/16 (link-local & cloud metadata)
  if (a === 172 && b >= 16 && b <= 31) return true; // 172.16.0.0/12 (RFC 1918 private)
  if (a === 192 && b === 0 && (c === 0 || c === 2)) return true; // 192.0.0.0/24 IETF + 192.0.2.0/24 TEST-NET-1
  if (a === 192 && b === 0) return true; // Conservative 192.0.0.0/16 block matching read-link policy
  if (a === 192 && b === 168) return true; // 192.168.0.0/16 (RFC 1918 private)
  if (a === 198 && (b === 18 || b === 19)) return true; // 198.18.0.0/15 (RFC 2544 benchmarking)
  if (a >= 224) return true; // 224.0.0.0/4 multicast + 240.0.0.0/4 reserved + broadcast
  return false;
};

const extractEmbeddedIpv4 = (high: number, low: number): [number, number, number, number] => [
  (high >> 8) & 0xff,
  high & 0xff,
  (low >> 8) & 0xff,
  low & 0xff,
];

const isBlockedIpv6Words = (g: number[]): boolean => {
  // `::` unspecified (RFC 4291)
  if (g.every((w) => w === 0)) return true;
  // `::1` loopback (RFC 4291)
  if (g.slice(0, 7).every((w) => w === 0) && g[7] === 1) return true;

  // `::ffff:0:0/96` IPv4-mapped IPv6 (covers BOTH `::ffff:169.254.169.254` AND `::ffff:a9fe:a9fe`)
  if (g.slice(0, 5).every((w) => w === 0) && g[5] === 0xffff) {
    return isBlockedIpv4Octets(extractEmbeddedIpv4(g[6], g[7]));
  }
  // `::ffff:0:a.b.c.d` SIIT IPv4-translated (`0:0:0:0:ffff:0:w6:w7`)
  if (g.slice(0, 4).every((w) => w === 0) && g[4] === 0xffff && g[5] === 0) {
    return isBlockedIpv4Octets(extractEmbeddedIpv4(g[6], g[7]));
  }
  // `::/96` deprecated IPv4-compatible IPv6 (e.g. `::127.0.0.1` / `::7f00:1`)
  if (g.slice(0, 6).every((w) => w === 0)) {
    return isBlockedIpv4Octets(extractEmbeddedIpv4(g[6], g[7]));
  }
  // `64:ff9b::/96` and `64:ff9b:1::/48` NAT64 (RFC 6052 / RFC 8215)
  if (g[0] === 0x0064 && g[1] === 0xff9b && (g.slice(2, 6).every((w) => w === 0) || g[2] === 1)) {
    return isBlockedIpv4Octets(extractEmbeddedIpv4(g[6], g[7]));
  }
  // `2002::/16` 6to4 transition addresses embedding IPv4 in words 1..2
  if (g[0] === 0x2002) {
    return isBlockedIpv4Octets(extractEmbeddedIpv4(g[1], g[2]));
  }
  // `2001:db8::/32` documentation prefix
  if (g[0] === 0x2001 && g[1] === 0x0db8) return true;
  // `fc00::/7` (`fc00`..`fdff`) unique-local (RFC 4193)
  if ((g[0] & 0xfe00) === 0xfc00) return true;
  // `fe80::/10` (`fe80`..`febf`) link-local (RFC 4291)
  if ((g[0] & 0xffc0) === 0xfe80) return true;
  // `fec0::/10` deprecated site-local
  if ((g[0] & 0xffc0) === 0xfec0) return true;
  // `ff00::/8` multicast
  if ((g[0] & 0xff00) === 0xff00) return true;

  return false;
};

/**
 * Returns `true` when `rawHost` is an IPv4 or IPv6 literal (with or without outer `[...]`).
 */
export const isIpLiteral = (rawHost: string): boolean => {
  const bare = rawHost.replace(/^\[|\]$/g, '');
  if (parseIpv4Octets(bare) !== null) return true;
  return bare.includes(':') && parseIpv6Words(bare) !== null;
};

/**
 * Returns `true` when `rawAddress` names loopback, RFC1918 private space, link-local / cloud
 * metadata (`169.254.0.0/16`, `fe80::/10`), CGNAT (`100.64.0.0/10`), benchmarking (`198.18.0.0/15`),
 * unique-local (`fc00::/7`), hex/dotted IPv4-mapped IPv6 (`::ffff:a9fe:a9fe`), multicast, or any
 * malformed/unrecognized IP string.
 */
export const isBlockedIp = (rawAddress: string): boolean => {
  const bare = rawAddress.replace(/^\[|\]$/g, '').trim();
  if (!bare) return true;
  const v4 = parseIpv4Octets(bare);
  if (v4) return isBlockedIpv4Octets(v4);
  const v6 = parseIpv6Words(bare);
  if (v6) return isBlockedIpv6Words(v6);
  return true;
};

/**
 * Returns `true` for reserved local/internal DNS suffixes (RFC 6761 / mDNS / cloud internal zones),
 * normalizing trailing FQDN dots (`localhost.`, `metadata.google.internal.`) first.
 */
export const isPrivateHostname = (rawHostname: string): boolean => {
  const normalized = rawHostname.replace(/^\[|\]$/g, '').replace(/\.+$/, '').toLowerCase();
  if (!normalized) return true;
  return (
    normalized === 'localhost' ||
    normalized.endsWith('.localhost') ||
    normalized.endsWith('.local') ||
    normalized.endsWith('.internal') ||
    normalized.endsWith('.home.arpa')
  );
};

/**
 * True only in non-Vercel local `next dev` (`NODE_ENV === 'development'`) or when explicitly
 * opted in via `ZC_ALLOW_PRIVATE_PROVIDER_URLS=1` (e.g. local Ollama on loopback).
 */
export const isPrivateProviderNetworkAllowed = (): boolean => {
  if (typeof process === 'undefined' || !process.env) return false;
  if (process.env.ZC_ALLOW_PRIVATE_PROVIDER_URLS === '1') return true;
  return process.env.NODE_ENV === 'development' && process.env.VERCEL !== '1';
};

/**
 * Synchronous literal validation of a remote URL (scheme, embedded credentials, private hostnames,
 * and IPv4 / IPv6 / hex-mapped IPv6 literals). Does NOT perform DNS resolution.
 */
export const validateRemoteUrlLiteral = (
  rawUrl: unknown,
  options: RemoteUrlCheckOptions = {}
): { ok: true; url: URL } | { ok: false; error: UnsafeRemoteUrlError } => {
  if (typeof rawUrl !== 'string' || !rawUrl.trim()) {
    return { ok: false, error: new UnsafeRemoteUrlError('INVALID_URL', 'Invalid URL.') };
  }

  let url: URL;
  try {
    url = new URL(rawUrl.trim());
  } catch {
    return { ok: false, error: new UnsafeRemoteUrlError('INVALID_URL', 'Invalid URL.') };
  }

  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    return {
      ok: false,
      error: new UnsafeRemoteUrlError('UNSAFE_PROTOCOL', 'Only http and https URLs are allowed.'),
    };
  }

  if (url.username || url.password) {
    return {
      ok: false,
      error: new UnsafeRemoteUrlError(
        'CREDENTIALS_NOT_ALLOWED',
        'Embedded URL credentials are not allowed.'
      ),
    };
  }

  if (options.allowPrivateNetwork === true) {
    return { ok: true, url };
  }

  if (options.requireHttps === true && url.protocol !== 'https:') {
    return {
      ok: false,
      error: new UnsafeRemoteUrlError('UNSAFE_PROTOCOL', 'HTTPS is required for remote endpoints.'),
    };
  }

  const hostname = url.hostname;
  if (isPrivateHostname(hostname)) {
    return {
      ok: false,
      error: new UnsafeRemoteUrlError(
        'BLOCKED_ADDRESS',
        'Target points inside a private or local network.'
      ),
    };
  }

  if (hostname.startsWith('[') || isIpLiteral(hostname)) {
    if (isBlockedIp(hostname)) {
      return {
        ok: false,
        error: new UnsafeRemoteUrlError(
          'BLOCKED_ADDRESS',
          'Target points inside a private or local network.'
        ),
      };
    }
  }

  return { ok: true, url };
};

const getDefaultDnsLookup = (): DnsLookupFn => {
  const getBuiltin = (
    globalThis as { process?: { getBuiltinModule?: (id: string) => unknown } }
  ).process?.getBuiltinModule;
  if (typeof getBuiltin !== 'function') {
    throw new UnsafeRemoteUrlError(
      'DNS_LOOKUP_FAILED',
      'DNS resolution is unavailable in this runtime.'
    );
  }
  const dnsPromises = getBuiltin('node:dns/promises') as {
    lookup: (hostname: string, options: { all: true; verbatim?: boolean }) => Promise<DnsLookupEntry[]>;
  };
  return (hostname, options) => dnsPromises.lookup(hostname, { ...options, verbatim: true });
};

/**
 * Full async SSRF guard: validates URL scheme/credentials/literals AND resolves all A/AAAA DNS
 * records via `dns.lookup(hostname, { all: true })`, rejecting the URL if resolution fails,
 * returns zero records, or ANY returned record falls in a blocked IPv4/IPv6 range.
 */
export const assertSafeRemoteUrl = async (
  rawUrl: string,
  options: AssertSafeRemoteUrlOptions = {}
): Promise<URL> => {
  const literal = validateRemoteUrlLiteral(rawUrl, options);
  if (!literal.ok) throw literal.error;

  const { url } = literal;
  if (options.allowPrivateNetwork === true) return url;

  const bareHost = url.hostname.replace(/^\[|\]$/g, '').replace(/\.+$/, '').toLowerCase();
  if (isIpLiteral(bareHost)) {
    // Already validated by `validateRemoteUrlLiteral` above.
    return url;
  }

  const lookupFn = options.lookupImpl ?? getDefaultDnsLookup();
  let records: DnsLookupEntry[];
  try {
    records = await lookupFn(bareHost, { all: true });
  } catch {
    throw new UnsafeRemoteUrlError('DNS_LOOKUP_FAILED', 'Host could not be resolved.');
  }

  if (!Array.isArray(records) || records.length === 0) {
    throw new UnsafeRemoteUrlError('DNS_LOOKUP_FAILED', 'Host could not be resolved.');
  }

  if (records.some((entry) => !entry || typeof entry.address !== 'string' || isBlockedIp(entry.address))) {
    throw new UnsafeRemoteUrlError(
      'BLOCKED_ADDRESS',
      'Target resolves to a private or reserved network address.'
    );
  }

  return url;
};
