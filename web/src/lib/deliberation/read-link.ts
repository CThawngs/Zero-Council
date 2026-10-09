/**
 * ============================================================================
 * Reading a link — the half of "the AI reads the attachment" that needs no key.
 * ============================================================================
 *
 * A user pastes a URL and the advisors are supposed to have read it. Fetching
 * the page and turning it into text needs nothing but `fetch`, so it can be
 * built and proven now. Handing that text to a model is the other half, and it
 * is DELEGATED: no OPENROUTER_API_KEY / OPENAI_API_KEY / ANTHROPIC_API_KEY
 * exists on this machine, so the model call is written when a key arrives, not
 * guessed now.
 *
 * Why server-side and not the browser: a page fetched from the browser is
 * subject to that page's CORS policy, so most links would come back empty. A
 * route handler can read them.
 *
 * That makes this an SSRF hole the moment it is reachable from a request, which
 * is why the address checks below are not optional polish: without them this
 * endpoint would happily read `http://169.254.169.254/` and hand back cloud
 * credentials. Every hop is checked, including redirects, because a public URL
 * that 302s to `http://127.0.0.1:5432/` is the same attack with a nicer front.
 *
 * Explicit `.ts` import below so plain `node --test` can run the tests, same as
 * engine.ts.
 *
 * DELIBERATELY NOT WIRED TO A ROUTE. The module is the capability; exposing it
 * as an endpoint that fetches any URL a caller names is the decision, and it is
 * not one to make while there is no sign-in (auth is a colleague's task). The
 * address guard below stops the addresses that matter, but it does not stop
 * this endpoint being used as someone else's bandwidth, and that needs the
 * owner of the app in the room. Add `app/api/.../read-link/route.ts` when auth
 * lands, not before.
 */

import { lookup } from 'node:dns/promises';
import { isIPv4, isIPv6 } from 'node:net';

const defaultLookup: LookupFn = (hostname, options) => lookup(hostname, options) as never;

export interface LinkReading {
  /** After redirects. What was actually read, which is not always what was asked for. */
  url: string;
  title: string;
  text: string;
  truncated: boolean;
}

/** A link we will not or could not read. `reason` is safe to show a user. */
export class UnreadableLink extends Error {
  // Written out rather than as a constructor parameter property: Node runs
  // TypeScript in strip-only mode for these tests, and that has no parameter
  // properties.
  readonly reason: string;

  constructor(reason: string) {
    super(reason);
    this.name = 'UnreadableLink';
    this.reason = reason;
  }
}

const MAX_BYTES = 2_000_000;
const MAX_TEXT = 20_000;
const MAX_REDIRECTS = 5;
const DEFAULT_TIMEOUT_MS = 10_000;

/**
 * Addresses that name this machine, this network, or a cloud provider's own
 * metadata service. Reading any of them through a user-supplied URL is the
 * attack, not a feature.
 */
const isBlockedAddress = (address: string): boolean => {
  // An IPv4-mapped IPv6 address is the same host wearing a hat. It arrives in
  // two spellings — `::ffff:169.254.169.254` and, because `new URL`
  // normalises, `::ffff:a9fe:a9fe` — and unwrapping only the first would leave
  // the metadata service reachable by the second. Both are handled here.
  if (address.toLowerCase().startsWith('::ffff:')) {
    const tail = address.slice(7);
    if (isIPv4(tail)) return isBlockedAddress(tail);
    const packed = /^(?:[0-9a-f]{1,4}:){3}(?:[0-9a-f]{1,4})$/i.test(tail)
      ? tail.split(':').flatMap((part) => [Number.parseInt(part.slice(0, 2), 16), Number.parseInt(part.slice(2), 16)])
      : null;
    if (packed) return isBlockedAddress(packed.join('.'));
    return true;
  }

  if (isIPv4(address)) {
    const [a, b] = address.split('.').map(Number);
    if (a === 0) return true; // 0.0.0.0/8 — "this network"
    if (a === 10) return true; // private
    if (a === 127) return true; // loopback
    if (a === 169 && b === 254) return true; // link-local, incl. cloud metadata
    if (a === 172 && b >= 16 && b <= 31) return true; // private
    if (a === 192 && b === 168) return true; // private
    if (a === 100 && b >= 64 && b <= 127) return true; // carrier-grade NAT
    if (a === 192 && b === 0) return true; // IETF protocol assignments
    if (a === 198 && (b === 18 || b === 19)) return true; // benchmarking
    if (a >= 224) return true; // multicast + reserved + broadcast
    return false;
  }

  if (isIPv6(address)) {
    const lower = address.toLowerCase();
    if (lower === '::' || lower === '::1') return true;
    // fc00::/7 unique-local, fe80::/10 link-local.
    if (/^f[cd]/.test(lower)) return true;
    if (lower.startsWith('fe8') || lower.startsWith('fe9') || lower.startsWith('fea') || lower.startsWith('feb')) {
      return true;
    }
    return false;
  }

  // Not an address we recognise: refuse rather than guess.
  return true;
};

const assertPublicUrl = async (raw: string, lookupImpl: LookupFn): Promise<URL> => {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new UnreadableLink('That does not look like a link.');
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new UnreadableLink('Only http and https links can be opened.');
  }

  // A host that is already an IP address needs no resolver, and going through
  // one would only add a way to be talked out of the answer. Check it as given.
  // `new URL` keeps IPv6 literals in brackets, so those are stripped first.
  const bare = url.hostname.replace(/^\[|\]$/g, '').toLowerCase();

  // `localhost` is loopback by definition (RFC 6761), not by what DNS says, so
  // it never reaches the resolver. Otherwise a hosts file or a search domain
  // that answers it with a public address would make this machine reachable
  // from a URL the user pasted.
  if (bare === 'localhost' || bare.endsWith('.localhost')) {
    throw new UnreadableLink('That link points inside this network and cannot be opened.');
  }

  if (isIPv4(bare) || isIPv6(bare)) {
    if (isBlockedAddress(bare)) {
      throw new UnreadableLink('That link points inside this network and cannot be opened.');
    }
    return url;
  }

  let addresses: { address: string }[];
  try {
    addresses = await lookupImpl(bare, { all: true });
  } catch {
    throw new UnreadableLink('That host could not be found.');
  }
  if (addresses.length === 0) throw new UnreadableLink('That host could not be found.');
  // Every address must pass. One allowed address is enough for the host to
  // resolve to something private on the next attempt.
  if (addresses.some((entry) => isBlockedAddress(entry.address))) {
    throw new UnreadableLink('That link points inside this network and cannot be opened.');
  }
  return url;
};
// The parser moved to html-text.ts so a client component can share it without dragging
// node:dns into the browser bundle. Re-exported here because the tests and every existing
// caller already import it from this path.
import { htmlToText } from './html-text.ts';

export { htmlToText };



export interface ReadLinkOptions {
  timeoutMs?: number;
  maxText?: number;
  /** Injected in tests. Defaults to global fetch. */
  fetchImpl?: typeof fetch;
  /**
   * Injected in tests. Defaults to node:dns lookup. The test server for this
   * file listens on loopback, which the address guard refuses on purpose, so
   * the tests swap resolution only — never the check itself.
   */
  lookupImpl?: LookupFn;
}

type LookupFn = (
  hostname: string,
  options: { all: true }
) => Promise<{ address: string; family: number }[]>;

/**
 * Fetch a link and return its text. Throws `UnreadableLink` with a reason that
 * is safe to show a user — the messages never include the resolved address.
 *
 * ponytail: the address check resolves DNS and then hands the *hostname* to
 * fetch, so a host whose DNS answer changes between the check and the request
 * (rebinding) is not caught. Closing that means pinning the socket to the
 * address we validated, which needs a custom agent or dispatcher and breaks
 * certificate matching. Add that the day this endpoint accepts traffic from
 * anyone but us; until then the check stops the obvious attacks.
 */
export const readLink = async (
  raw: string,
  {
    timeoutMs = DEFAULT_TIMEOUT_MS,
    maxText = MAX_TEXT,
    fetchImpl = fetch,
    lookupImpl = defaultLookup,
  }: ReadLinkOptions = {}
): Promise<LinkReading> => {
  let current = raw;
  let response: Response | null = null;

  for (let hop = 0; hop <= MAX_REDIRECTS; hop += 1) {
    const url = await assertPublicUrl(current, lookupImpl);
    response = await fetchImpl(url, {
      redirect: 'manual',
      signal: AbortSignal.timeout(timeoutMs),
      headers: { accept: 'text/html,text/plain;q=0.9,*/*;q=0.1', 'user-agent': 'ZeroCouncilLinkReader/1.0' },
    });

    const isRedirect = response.status >= 300 && response.status < 400;
    const location = response.headers.get('location');
    if (!isRedirect || !location) break;
    if (hop === MAX_REDIRECTS) throw new UnreadableLink('That link redirects too many times.');
    // Re-checked on the next pass. A redirect is a fresh URL with all the risk
    // of a fresh URL.
    current = new URL(location, url).toString();
    response = null;
  }

  if (!response) throw new UnreadableLink('That link redirects too many times.');
  if (!response.ok) throw new UnreadableLink(`That link answered ${response.status}.`);

  const type = response.headers.get('content-type') ?? '';
  if (type && !/text\/html|application\/xhtml|text\/plain/i.test(type)) {
    throw new UnreadableLink('That link is not a web page.');
  }

  // Read bounded: a "page" can be a gigabyte, and the point is to read prose.
  const reader = response.body?.getReader();
  if (!reader) throw new UnreadableLink('That link sent no content.');
  const chunks: Uint8Array[] = [];
  let received = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      if (!value) continue;
      // Slice rather than discard: one chunk can be the whole body, and
      // dropping it would turn a large-but-readable page into "no text at all".
      const remaining = MAX_BYTES - received;
      if (value.byteLength > remaining) {
        chunks.push(value.slice(0, remaining));
        await reader.cancel();
        break;
      }
      received += value.byteLength;
      chunks.push(value);
    }
  } catch {
    throw new UnreadableLink('That link could not be read all the way through.');
  }

  const body = new TextDecoder().decode(concat(chunks));
  const { title, text } = htmlToText(body);
  if (text.length === 0) throw new UnreadableLink('That page had no readable text.');

  const truncated = text.length > maxText;
  return {
    url: response.url || current,
    title,
    text: truncated ? text.slice(0, maxText) : text,
    truncated,
  };
};

const concat = (chunks: Uint8Array[]): Uint8Array => {
  const total = chunks.reduce((sum, chunk) => sum + chunk.byteLength, 0);
  const out = new Uint8Array(total);
  let at = 0;
  for (const chunk of chunks) {
    out.set(chunk, at);
    at += chunk.byteLength;
  }
  return out;
};
