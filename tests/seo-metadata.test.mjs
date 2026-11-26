import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..');

const {
  SITE_NAME,
  buildLlmsTxt,
  buildNoIndexMetadata,
  buildPublicMetadata,
  canAccessWithoutPasswordClaim,
  getSiteUrl,
  isPublicPath,
  isValidLegalPath,
  normalizeCanonicalPath,
  resolveRequestLanguage,
} = await import('../web/src/lib/seo.ts');

const {
  buildBreadcrumbJsonLd,
  buildHomeJsonLd,
  getFaqItems,
  serializeJsonLd,
} = await import('../web/src/lib/seo-jsonld.ts');

const { default: robots } = await import('../web/src/app/robots.ts');
const { default: sitemap } = await import('../web/src/app/sitemap.ts');
const { default: manifest } = await import('../web/src/app/manifest.ts');
const { GET: getLlmsTxt } = await import('../web/src/app/llms.txt/route.ts');
const { LEGAL_DOCUMENTS } = await import('../web/src/prototype/types.ts');
const { copy } = await import('../web/src/prototype/i18n.ts');

test('getSiteUrl resolves env precedence, strips trailing slashes, and rejects unsafe URLs', () => {
  assert.equal(getSiteUrl({}), 'http://localhost:3000');
  assert.equal(
    getSiteUrl({
      NEXT_PUBLIC_SITE_URL: 'https://zerocouncil.ai///',
      VERCEL_PROJECT_PRODUCTION_URL: 'prod.vercel.app',
      VERCEL_URL: 'preview.vercel.app',
    }),
    'https://zerocouncil.ai'
  );
  assert.equal(
    getSiteUrl({
      NEXT_PUBLIC_SITE_URL: '   ',
      VERCEL_PROJECT_PRODUCTION_URL: 'zero-council.vercel.app/',
      VERCEL_URL: 'preview-123.vercel.app',
    }),
    'https://zero-council.vercel.app'
  );
  assert.equal(
    getSiteUrl({
      VERCEL_URL: 'preview-abc.vercel.app',
    }),
    'https://preview-abc.vercel.app'
  );
  assert.equal(
    getSiteUrl({
      NEXT_PUBLIC_SITE_URL: 'javascript:alert(1)',
      VERCEL_PROJECT_PRODUCTION_URL: 'not a valid host',
    }),
    'http://localhost:3000'
  );
  assert.equal(
    getSiteUrl({
      NEXT_PUBLIC_SITE_URL: 'http://127.0.0.1:3328/',
    }),
    'http://127.0.0.1:3328'
  );
});

test('resolveRequestLanguage prioritizes ?lang= query param over cookie and defaults to en', () => {
  assert.equal(resolveRequestLanguage('vi', 'en'), 'vi');
  assert.equal(resolveRequestLanguage('EN', 'vi'), 'en');
  assert.equal(resolveRequestLanguage(['vi', 'en'], 'en'), 'vi');
  assert.equal(resolveRequestLanguage('fr', 'vi'), 'vi');
  assert.equal(resolveRequestLanguage(undefined, 'vi'), 'vi');
  assert.equal(resolveRequestLanguage(null, 'invalid'), 'en');
  assert.equal(resolveRequestLanguage(undefined, undefined), 'en');
});

test('buildPublicMetadata and buildNoIndexMetadata produce strict canonical, hreflang, OG, Twitter, and robots', () => {
  assert.equal(normalizeCanonicalPath(''), '/');
  assert.equal(normalizeCanonicalPath('/'), '/');
  assert.equal(normalizeCanonicalPath('guide///'), '/guide');
  assert.equal(normalizeCanonicalPath('/legal/privacy/'), '/legal/privacy');

  const homeVi = buildPublicMetadata({
    lang: 'vi',
    path: '/',
    title: copy.vi.documentTitle,
    description: copy.vi.documentDescription,
  });

  assert.equal(homeVi.applicationName, SITE_NAME);
  assert.equal(homeVi.alternates?.canonical, '/');
  assert.deepEqual(homeVi.alternates?.languages, {
    en: '/?lang=en',
    vi: '/?lang=vi',
    'x-default': '/',
  });
  assert.equal(homeVi.openGraph?.locale, 'vi_VN');
  assert.deepEqual(homeVi.openGraph?.alternateLocale, ['en_US']);
  assert.equal(homeVi.twitter?.card, 'summary_large_image');
  assert.equal(homeVi.robots?.index, true);
  assert.equal(homeVi.robots?.follow, true);

  const legalEn = buildPublicMetadata({
    lang: 'en',
    path: '/legal/privacy/',
    title: 'Privacy Policy — Zero Council',
    description: 'How Zero Council handles personal data.',
  });
  assert.equal(legalEn.alternates?.canonical, '/legal/privacy');
  assert.deepEqual(legalEn.alternates?.languages, {
    en: '/legal/privacy?lang=en',
    vi: '/legal/privacy?lang=vi',
    'x-default': '/legal/privacy',
  });

  const priv = buildNoIndexMetadata({ title: 'Zero Council — Workspace' });
  assert.equal(priv.robots?.index, false);
  assert.equal(priv.robots?.follow, false);
  assert.equal(priv.robots?.nocache, true);
  assert.equal(priv.alternates, undefined);
});

test('robots(), sitemap(), manifest(), and llms.txt expose complete, accurate public metadata', async () => {
  const prevSiteUrl = process.env.NEXT_PUBLIC_SITE_URL;
  process.env.NEXT_PUBLIC_SITE_URL = 'https://zerocouncil.example';
  try {
    const robotsConfig = robots();
    assert.equal(robotsConfig.sitemap, 'https://zerocouncil.example/sitemap.xml');
    const rule = Array.isArray(robotsConfig.rules) ? robotsConfig.rules[0] : robotsConfig.rules;
    assert.ok(rule.allow.includes('/'));
    assert.ok(rule.allow.includes('/guide'));
    assert.ok(rule.allow.includes('/legal/'));
    for (const blocked of ['/dashboard', '/admin', '/api/', '/auth/callback', '/checkout/']) {
      assert.ok(rule.disallow.includes(blocked), `robots disallow missing ${blocked}`);
    }

    const entries = sitemap();
    assert.equal(entries.length, 2 + LEGAL_DOCUMENTS.length);
    const urls = entries.map((e) => e.url);
    assert.ok(urls.includes('https://zerocouncil.example'));
    assert.ok(urls.includes('https://zerocouncil.example/guide'));
    for (const slug of LEGAL_DOCUMENTS) {
      assert.ok(urls.includes(`https://zerocouncil.example/legal/${slug}`));
    }
    for (const entry of entries) {
      assert.ok(entry.alternates?.languages?.en?.endsWith('?lang=en'));
      assert.ok(entry.alternates?.languages?.vi?.endsWith('?lang=vi'));
      assert.equal(entry.alternates?.languages?.['x-default'], entry.url);
    }

    const webManifest = manifest();
    assert.equal(webManifest.short_name, 'Zero Council');
    assert.equal(webManifest.display, 'standalone');
    assert.ok(webManifest.icons?.some((icon) => icon.src === '/icon.svg'));
    assert.ok(webManifest.icons?.some((icon) => icon.src === '/apple-icon'));

    const llmsResponse = getLlmsTxt();
    assert.equal(llmsResponse.status, 200);
    assert.match(llmsResponse.headers.get('content-type') ?? '', /^text\/plain;\s*charset=utf-8$/i);
    const llmsBody = await llmsResponse.text();
    assert.equal(llmsBody, buildLlmsTxt('https://zerocouncil.example'));
    for (const token of [
      '# Zero Council',
      'Anthropic',
      'OpenAI',
      'Google Gemini',
      'Groq',
      'xAI Grok',
      'OpenRouter',
      'NVIDIA NIM',
      'DeepSeek',
      'AES-256',
      '139,000 VND/month',
      '379,000 VND/month',
      'https://zerocouncil.example/guide',
      'https://zerocouncil.example/legal/privacy',
    ]) {
      assert.ok(llmsBody.includes(token), `llms.txt missing ${token}`);
    }
  } finally {
    if (prevSiteUrl === undefined) delete process.env.NEXT_PUBLIC_SITE_URL;
    else process.env.NEXT_PUBLIC_SITE_URL = prevSiteUrl;
  }
});

test('JSON-LD @graph & BreadcrumbList match FAQ copy 1:1 and escape script-closing tags', () => {
  for (const lang of ['en', 'vi']) {
    const faq = getFaqItems(lang);
    assert.equal(faq.length, 6);
    const graphDoc = buildHomeJsonLd(lang);
    assert.equal(graphDoc['@context'], 'https://schema.org');
    const graph = graphDoc['@graph'];
    assert.ok(Array.isArray(graph));
    const types = graph.map((node) => node['@type']);
    assert.deepEqual(types, ['Organization', 'WebSite', 'SoftwareApplication', 'FAQPage']);

    const appNode = graph.find((node) => node['@type'] === 'SoftwareApplication');
    assert.equal(appNode.offers.priceCurrency, 'VND');
    assert.equal(appNode.offers.lowPrice, '0');
    assert.equal(appNode.offers.highPrice, '379000');
    assert.equal(appNode.offers.offers.length, 3);

    const faqNode = graph.find((node) => node['@type'] === 'FAQPage');
    assert.equal(faqNode.mainEntity.length, faq.length);
    faqNode.mainEntity.forEach((entity, idx) => {
      assert.equal(entity.name, faq[idx].question);
      assert.equal(entity.acceptedAnswer.text, faq[idx].answer);
    });

    const serialized = serializeJsonLd(graphDoc);
    assert.doesNotMatch(serialized, /<\/script/i);
    assert.deepEqual(JSON.parse(serialized), graphDoc);
  }

  const xssSafe = serializeJsonLd({ evil: '</script><script>alert(1)</script>' });
  assert.ok(!xssSafe.includes('</script>'));
  assert.equal(JSON.parse(xssSafe).evil, '</script><script>alert(1)</script>');

  const crumbs = buildBreadcrumbJsonLd([
    { name: 'Zero Council', path: '/' },
    { name: 'Guide', path: '/guide/' },
  ]);
  assert.equal(crumbs['@type'], 'BreadcrumbList');
  assert.equal(crumbs.itemListElement.length, 2);
  assert.equal(crumbs.itemListElement[0].position, 1);
  assert.equal(crumbs.itemListElement[1].position, 2);
  assert.ok(crumbs.itemListElement[1].item.endsWith('/guide'));
});

test('isPublicPath & canAccessWithoutPasswordClaim whitelist crawler routes and protect private routes', () => {
  for (const pub of [
    '/',
    '/guide',
    '/legal/terms',
    '/legal/privacy',
    '/robots.txt',
    '/sitemap.xml',
    '/manifest.webmanifest',
    '/llms.txt',
    '/opengraph-image',
    '/twitter-image',
    '/icon.svg',
    '/apple-icon',
    '/fonts/nunito-vietnamese.woff2',
    '/auth',
    '/checkout/return',
  ]) {
    assert.equal(isPublicPath(pub), true, `Expected ${pub} to be public`);
  }

  assert.equal(isValidLegalPath('/legal/privacy'), true);
  assert.equal(isValidLegalPath('/legal/privacy/'), true);
  assert.equal(isValidLegalPath('/legal/unknown-slug'), false);
  assert.equal(isValidLegalPath('/legal'), false);
  assert.equal(isPublicPath('/legal/unknown-slug'), false);

  for (const priv of ['/dashboard', '/admin']) {
    assert.equal(isPublicPath(priv), false, `Expected ${priv} to require auth`);
    assert.equal(canAccessWithoutPasswordClaim(priv), false);
  }

  for (const passwordExempt of ['/auth', '/guide', '/legal/privacy', '/robots.txt', '/sitemap.xml', '/llms.txt']) {
    assert.equal(canAccessWithoutPasswordClaim(passwordExempt), true);
  }
});

test('unused boilerplate public SVGs are removed and brand icon.svg exists', () => {
  for (const removed of ['next.svg', 'vercel.svg', 'file.svg', 'globe.svg', 'window.svg']) {
    assert.equal(
      fs.existsSync(path.join(repoRoot, 'web', 'public', removed)),
      false,
      `Boilerplate asset web/public/${removed} should be deleted`
    );
  }
  const iconSvgPath = path.join(repoRoot, 'web', 'src', 'app', 'icon.svg');
  assert.equal(fs.existsSync(iconSvgPath), true);
  const iconContent = fs.readFileSync(iconSvgPath, 'utf8');
  assert.match(iconContent, /<svg[^>]*viewBox="0 0 64 64"/);
});

test('SERP CTR metadata and hero card copy match Growth audit in EN & VI', () => {
  assert.equal(copy.en.documentTitle, 'Zero Council — Multi-Model AI Decision Council (BYOK)');
  assert.equal(
    copy.en.documentDescription,
    'Convene 2–8 AI advisors across distinct models with Decision Matrix, Six Thinking Hats & Scenario Paths. AES-256 encrypted BYOK. Start free.'
  );
  assert.equal(copy.vi.documentTitle, 'Zero Council — Hội đồng cố vấn AI đa mô hình (BYOK)');
  assert.equal(
    copy.vi.documentDescription,
    'Triệu tập 2–8 cố vấn AI đa mô hình phân tích bằng Ma trận quyết định, 6 Chiếc Mũ & Nhánh kịch bản. Dùng API key riêng mã hóa AES-256. Bắt đầu miễn phí.'
  );
  assert.ok(copy.vi.framework1Body.startsWith('Dự báo các kết quả'));
  assert.ok(!copy.vi.framework1Body.includes('Dự bảo'));
  assert.equal(copy.en.heroModelsList, 'Claude · GPT · Gemini · DeepSeek');
  assert.equal(copy.vi.heroModelsList, 'Claude · GPT · Gemini · DeepSeek');
  assert.equal(copy.en.heroFrameworkBadge, 'Decision Matrix');
  assert.equal(copy.vi.heroFrameworkBadge, 'Ma trận quyết định');
});
