import assert from 'node:assert/strict';
import test from 'node:test';

import { htmlToText, readLink, UnreadableLink } from '../web/src/lib/deliberation/read-link.ts';

/**
 * The guard refuses loopback on purpose, so a test server could never be
 * reached through it — that is the guarantee working, not a gap. These tests
 * therefore drive the response side with a stub `fetch`, and the address guard
 * is proved separately against real URLs below.
 *
 * What that leaves uncovered: real sockets. A stub cannot prove that `fetch`
 * streams the way this code expects. Known ceiling, not an oversight.
 */
const page = (body, { status = 200, type = 'text/html; charset=utf-8' } = {}) =>
  async () => new Response(body, { status, headers: { 'content-type': type } });

const PUBLIC = [{ address: '93.184.216.34', family: 4 }];
const publicLookup = async () => PUBLIC;

const read = (url, fetchImpl, extra = {}) =>
  readLink(url, { fetchImpl, lookupImpl: publicLookup, ...extra });

// --- Reading a page ---

test('reads a page and returns its title and prose', async () => {
  const reading = await read(
    'https://example.com/spec',
    page(`<!doctype html><html><head><title>  Rollout &amp; Spec  </title>
      <script>window.secret = 'do not read me'</script>
      <style>body{color:red}</style></head>
      <body><h1>Rollout</h1><p>Pilot with one team for two weeks.</p>
      <img src="a.png" alt="a rising chart"></body></html>`)
  );
  assert.equal(reading.title, 'Rollout & Spec');
  assert.match(reading.text, /Pilot with one team for two weeks\./);
  assert.match(reading.text, /a rising chart/, 'alt text is content, not decoration');
  assert.equal(reading.text.includes('do not read me'), false, 'script content must not survive');
  assert.equal(reading.text.includes('color:red'), false, 'style content must not survive');
  assert.equal(reading.truncated, false);
});

test('text is capped and says so', async () => {
  const reading = await read(
    'https://example.com/long',
    page(`<html><body><p>${'word '.repeat(5000)}</p></body></html>`),
    { maxText: 500 }
  );
  assert.equal(reading.text.length, 500);
  assert.equal(reading.truncated, true);
});

test('a large body is cut off rather than buffered whole', async () => {
  // 5 MB of markup: the read stops at the byte cap, so this stays fast and does
  // not lean on the text cap being the thing that saves us.
  const reading = await read('https://example.com/huge', page('x'.repeat(5_000_000)), { maxText: 10 });
  assert.ok(reading.text.length <= 10);
});

test('a page with no readable text is refused rather than returned empty', async () => {
  await assert.rejects(
    () => read('https://example.com/blank', page('<html><head><style>a{}</style></head><body></body></html>')),
    (error) => error instanceof UnreadableLink && /no readable text/.test(error.reason)
  );
});

test('a non-web content type is refused', async () => {
  await assert.rejects(
    () => read('https://example.com/doc.pdf', page('%PDF-1.4', { type: 'application/pdf' })),
    (error) => error instanceof UnreadableLink && /not a web page/.test(error.reason)
  );
});

test('plain text is fine; it is still a page a person wrote', async () => {
  const reading = await read('https://example.com/notes', page('just words', { type: 'text/plain' }));
  assert.equal(reading.text, 'just words');
});

test('an error status is reported, not swallowed', async () => {
  await assert.rejects(
    () => read('https://example.com/gone', page('<html><body>nope</body></html>', { status: 404 })),
    (error) => error instanceof UnreadableLink && /404/.test(error.reason)
  );
});

// --- Redirects: a fresh URL with all the risk of a fresh URL ---

test('follows a redirect and reads where it actually landed', async () => {
  let hop = 0;
  const reading = await read('https://example.com/go', async () => {
    hop += 1;
    if (hop === 1) return new Response(null, { status: 302, headers: { location: 'https://elsewhere.test/final' } });
    return new Response('<html><body><p>arrived</p></body></html>', {
      headers: { 'content-type': 'text/html' },
    });
  });
  assert.equal(hop, 2);
  assert.match(reading.text, /arrived/);
});

test('a redirect loop is refused instead of spun on', async () => {
  await assert.rejects(
    () =>
      read(
        'https://example.com/loop',
        async () => new Response(null, { status: 302, headers: { location: 'https://example.com/loop' } })
      ),
    (error) => error instanceof UnreadableLink && /redirects too many times/.test(error.reason)
  );
});

test('a redirect into this network is refused', async () => {
  // The front door looks public and is; the answer behind it is not. This is
  // why the guard runs on every hop, not only on the URL it was handed.
  await assert.rejects(
    () =>
      read(
        'https://example.com/to-metadata',
        async () =>
          new Response(null, { status: 302, headers: { location: 'http://169.254.169.254/latest/meta-data/' } })
      ),
    (error) => error instanceof UnreadableLink && /inside this network/.test(error.reason)
  );
});

test('a redirect to a different scheme is refused', async () => {
  await assert.rejects(
    () =>
      read(
        'https://example.com/to-file',
        async () => new Response(null, { status: 302, headers: { location: 'file:///etc/passwd' } })
      ),
    (error) => error instanceof UnreadableLink && /http and https/.test(error.reason)
  );
});

// --- The address guard. No server needed: the address alone is the decision. ---

const guard = (url, answers = PUBLIC) => () =>
  readLink(url, {
    fetchImpl: async () => new Response('should never be fetched'),
    lookupImpl: async () => answers,
  });

const REFUSED = [
  ['the cloud metadata service in dotted form', 'http://169.254.169.254/latest/meta-data/'],
  ['the cloud metadata service in the form a URL rewrites it to', 'http://[::ffff:169.254.169.254]/'],
  ['loopback', 'http://127.0.0.1/'],
  ['this machine by name', 'http://localhost/'],
  ['a private network', 'http://192.168.1.1/'],
  ['a private network in the other range', 'http://10.1.2.3/'],
  ['a private network in the third range', 'http://172.20.0.1/'],
  ['carrier-grade NAT', 'http://100.64.0.1/'],
  ['the unspecified address', 'http://0.0.0.0/'],
  ['a benchmark range', 'http://198.18.0.1/'],
  ['a file on disk', 'file:///etc/passwd'],
  ['a scheme we do not fetch', 'ftp://example.com/x'],
  ['something that is not a link at all', 'not a url'],
];

for (const [label, url] of REFUSED) {
  test(`refuses ${label}`, async () => {
    await assert.rejects(guard(url), (error) => {
      assert.ok(error instanceof UnreadableLink, `expected UnreadableLink, got ${error}`);
      return true;
    });
  });
}

test('refuses a host that resolves to loopback, not just a loopback URL', async () => {
  await assert.rejects(guard('https://sneaky.example.com/', [{ address: '127.0.0.1', family: 4 }]));
});

test('refuses a host when any one of its addresses is private', async () => {
  // One public address is not enough: the host can answer with either, and the
  // next request may be the one that gets the private one.
  await assert.rejects(
    guard('https://split.example.com/', [
      { address: '93.184.216.34', family: 4 },
      { address: '10.0.0.5', family: 4 },
    ])
  );
});

test('refuses a host that does not resolve at all', async () => {
  await assert.rejects(guard('https://nowhere.example.com/', []), (error) => {
    assert.ok(error instanceof UnreadableLink && /could not be found/.test(error.reason));
    return true;
  });
});

test('refuses a host that throws while resolving', async () => {
  await assert.rejects(
    readLink('https://broken.example.com/', {
      fetchImpl: async () => new Response('never'),
      lookupImpl: async () => {
        throw new Error('ENOTFOUND');
      },
    }),
    (error) => error instanceof UnreadableLink
  );
});

test('the refusal message never leaks the address it refused', async () => {
  await assert.rejects(guard('http://169.254.169.254/'), (error) => {
    assert.equal(error.reason.includes('169.254'), false);
    assert.equal(error.reason.includes('93.184'), false);
    return true;
  });
});

test('the guard runs before any network call is attempted', async () => {
  let fetched = false;
  await assert.rejects(
    readLink('http://169.254.169.254/', {
      fetchImpl: async () => {
        fetched = true;
        return new Response('never');
      },
      lookupImpl: publicLookup,
    })
  );
  assert.equal(fetched, false, 'a blocked address must cost no network call at all');
});

// --- htmlToText on its own, where the edge cases are cheap to state ---

test('html to text keeps prose and drops everything else', () => {
  const { title, text } = htmlToText(`
    <html><head><title>Two &amp; a half</title></head>
    <body><nav>Home About</nav><p>Real content.</p>
    <template><p>inert</p></template><p>&lt;not a tag&gt; &#8212; ok</p></body></html>`);
  assert.equal(title, 'Two & a half');
  assert.match(text, /Real content\./);
  assert.match(text, /<not a tag> — ok/);
  assert.equal(text.includes('inert'), false, 'template content is not page content');
});

test('malformed markup does not throw', () => {
  assert.doesNotThrow(() => htmlToText('<p>unclosed <div><span>mixed</p></div>'));
  assert.doesNotThrow(() => htmlToText('<<<>>> not html at all'));
  assert.doesNotThrow(() => htmlToText(''));
});

test('a hanging page is cut off at the deadline instead of blocking forever', async () => {
  await assert.rejects(
    readLink('https://slow.example.com/', {
      timeoutMs: 200,
      // Never resolves, the way a server that accepts and then says nothing does.
      fetchImpl: (_url, init) =>
        new Promise((_resolve, reject) => {
          init.signal.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError')));
        }),
      lookupImpl: publicLookup,
    })
  );
});