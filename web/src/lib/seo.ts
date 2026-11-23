import type { Metadata } from 'next';
import { PLANS } from '../prototype/data/plans.ts';
import { LEGAL_DOCUMENTS, type Language } from '../prototype/types.ts';

export const SITE_NAME = 'Zero Council';

export const DEFAULT_SEO_KEYWORDS: string[] = [
  'Zero Council',
  'AI council',
  'AI decision council',
  'multi-agent chat',
  'multi-agent AI workspace',
  'BYOK AI workspace',
  'bring your own key AI',
  'group chat AI bots',
  'multi-LLM deliberation',
  'Six Thinking Hats AI',
  'decision matrix AI',
  'OpenAI',
  'Anthropic Claude',
  'Google Gemini',
  'Groq',
  'xAI Grok',
  'OpenRouter',
  'NVIDIA NIM',
  'DeepSeek',
  'AI workspace Vietnam',
  'hội đồng AI',
  'chat nhóm nhiều bot AI',
  'không gian làm việc AI BYOK',
  'ra quyết định cùng AI',
  'tự mang API key AI',
  'tranh luận đa mô hình AI',
];

/**
 * Returns true for routes that must always remain publicly accessible (HTTP 200)
 * to anonymous visitors, search engine crawlers (Googlebot/Bingbot), AI crawlers,
 * and social link unfurlers (Facebook, Zalo, X, Discord, Slack, Telegram).
 */
export function isValidLegalPath(pathname: string): boolean {
  const normalized = pathname.replace(/\/+$/, '');
  if (!normalized.startsWith('/legal/')) return false;
  const slug = normalized.slice('/legal/'.length);
  return (LEGAL_DOCUMENTS as readonly string[]).includes(slug);
}

export function isPublicPath(pathname: string): boolean {
  return (
    pathname === '/' ||
    pathname === '/guide' ||
    pathname.startsWith('/guide/') ||
    isValidLegalPath(pathname) ||
    pathname.startsWith('/login') ||
    pathname.startsWith('/auth') ||
    pathname.startsWith('/checkout') ||
    pathname === '/robots.txt' ||
    pathname === '/sitemap.xml' ||
    pathname === '/manifest.webmanifest' ||
    pathname === '/manifest.json' ||
    pathname === '/llms.txt' ||
    pathname === '/favicon.ico' ||
    pathname === '/icon' ||
    pathname === '/icon.svg' ||
    pathname.startsWith('/icon/') ||
    pathname === '/apple-icon' ||
    pathname.startsWith('/apple-icon/') ||
    pathname === '/opengraph-image' ||
    pathname.startsWith('/opengraph-image') ||
    pathname === '/twitter-image' ||
    pathname.startsWith('/twitter-image') ||
    pathname.startsWith('/fonts/')
  );
}

/**
 * Signed-in accounts that have not set a password yet are guided to /auth,
 * except when reading public documentation/legal pages or crawler assets.
 */
export function canAccessWithoutPasswordClaim(pathname: string): boolean {
  return (
    pathname.startsWith('/auth') ||
    pathname === '/guide' ||
    pathname.startsWith('/guide/') ||
    isValidLegalPath(pathname) ||
    pathname === '/robots.txt' ||
    pathname === '/sitemap.xml' ||
    pathname === '/manifest.webmanifest' ||
    pathname === '/llms.txt' ||
    pathname.startsWith('/opengraph-image') ||
    pathname.startsWith('/twitter-image') ||
    pathname.startsWith('/icon') ||
    pathname.startsWith('/apple-icon') ||
    pathname.startsWith('/fonts/')
  );
}

function parseValidSiteUrl(raw: string | undefined, autoHttps = false): string | null {
  if (!raw) return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;

  let candidate = trimmed;
  if (!/^https?:\/\//i.test(candidate)) {
    if (!autoHttps && !/^[a-z0-9.-]+(?::\d+)?(?:\/.*)?$/i.test(candidate)) {
      return null;
    }
    if (/\s/.test(candidate)) return null;
    const isLocal =
      candidate.startsWith('localhost') || candidate.startsWith('127.0.0.1');
    candidate = `${isLocal ? 'http' : 'https'}://${candidate}`;
  }

  try {
    const parsed = new URL(candidate);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return null;
    const cleanPath = parsed.pathname.replace(/\/+$/, '');
    return `${parsed.origin}${cleanPath}`;
  } catch {
    return null;
  }
}

/**
 * Resolves the canonical origin URL without a trailing slash:
 * NEXT_PUBLIC_SITE_URL -> VERCEL_PROJECT_PRODUCTION_URL -> VERCEL_URL -> http://localhost:3000
 */
export function getSiteUrl(
  env: Record<string, string | undefined> = process.env
): string {
  return (
    parseValidSiteUrl(env.NEXT_PUBLIC_SITE_URL, false) ??
    parseValidSiteUrl(env.VERCEL_PROJECT_PRODUCTION_URL, true) ??
    parseValidSiteUrl(env.VERCEL_URL, true) ??
    'http://localhost:3000'
  );
}

/**
 * Resolves request language with ?lang=vi|en query override first,
 * then zc-lang cookie, defaulting to 'en'.
 */
export function resolveRequestLanguage(
  searchParamLang?: string | string[] | null,
  cookieLang?: string | null
): Language {
  const rawQuery = Array.isArray(searchParamLang) ? searchParamLang[0] : searchParamLang;
  if (typeof rawQuery === 'string') {
    const cleaned = rawQuery.trim().toLowerCase();
    if (cleaned === 'vi' || cleaned === 'en') return cleaned;
  }
  if (typeof cookieLang === 'string') {
    const cleanedCookie = cookieLang.trim().toLowerCase();
    if (cleanedCookie === 'vi' || cleanedCookie === 'en') return cleanedCookie;
  }
  return 'en';
}

export function normalizeCanonicalPath(path: string): string {
  const trimmed = path.trim();
  if (!trimmed || trimmed === '/') return '/';
  const withLeading = trimmed.startsWith('/') ? trimmed : `/${trimmed}`;
  return withLeading.replace(/\/+$/, '');
}

export interface BuildPublicMetadataInput {
  lang: Language;
  path: string;
  title: string;
  description: string;
  keywords?: string[];
}

export function buildPublicMetadata({
  lang,
  path,
  title,
  description,
  keywords = DEFAULT_SEO_KEYWORDS,
}: BuildPublicMetadataInput): Metadata {
  const siteUrl = getSiteUrl();
  const canonicalPath = normalizeCanonicalPath(path);
  const locale = lang === 'vi' ? 'vi_VN' : 'en_US';
  const alternateLocale = lang === 'vi' ? ['en_US'] : ['vi_VN'];

  return {
    metadataBase: new URL(siteUrl),
    title,
    description,
    applicationName: SITE_NAME,
    category: 'technology',
    keywords,
    alternates: {
      canonical: canonicalPath,
      languages: {
        en: `${canonicalPath}?lang=en`,
        vi: `${canonicalPath}?lang=vi`,
        'x-default': canonicalPath,
      },
    },
    robots: {
      index: true,
      follow: true,
      googleBot: {
        index: true,
        follow: true,
        'max-image-preview': 'large',
        'max-snippet': -1,
        'max-video-preview': -1,
      },
    },
    openGraph: {
      type: 'website',
      siteName: SITE_NAME,
      locale,
      alternateLocale,
      url: canonicalPath,
      title,
      description,
      images: [
        {
          url: '/opengraph-image',
          width: 1200,
          height: 630,
          alt: `${SITE_NAME} — Multi-Agent BYOK AI Workspace`,
        },
      ],
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: ['/twitter-image'],
    },
    other: {
      google: 'notranslate',
    },
  };
}

export interface BuildNoIndexMetadataInput {
  title: string;
  description?: string;
}

export function buildNoIndexMetadata({
  title,
  description,
}: BuildNoIndexMetadataInput): Metadata {
  return {
    metadataBase: new URL(getSiteUrl()),
    title,
    ...(description ? { description } : {}),
    robots: {
      index: false,
      follow: false,
      nocache: true,
      googleBot: {
        index: false,
        follow: false,
      },
    },
    other: {
      google: 'notranslate',
    },
  };
}

export function buildLlmsTxt(siteUrl: string = getSiteUrl()): string {
  const planLines = PLANS.map(
    (plan) =>
      `- **${plan.name}**: ${plan.priceVnd.toLocaleString('en-US')} VND/month (~$${plan.priceUsd}/mo reference) — up to ${plan.maxActiveAdvisors} active AI advisors/bots per room and ${plan.maxBots} custom bots.`
  ).join('\n');

  return `# Zero Council

> Zero Council is a bilingual (English & Tiếng Việt) multi-agent BYOK (Bring Your Own Key) AI workspace for structured decision-making and multi-bot group chat.

## Summary
Zero Council lets individuals, founders, engineers, and product teams convene multiple AI models in one conversation instead of relying on a single LLM opinion. Users connect their own API keys with zero token markup and run structured deliberations or interactive multi-bot group chats.

## Core Capabilities
- **Multi-Bot Group Chat**: Combine 2 to 8 custom AI bots in one room using Round-Robin or Panel modes, interactive \`@mention\` turn handoffs, department folders, templates, and JSON workspace import/export.
- **3 Structured Decision Frameworks**:
  1. **Good / Normal / Bad Scenarios**: Maps favorable, baseline, and downside branches with concrete exit criteria.
  2. **Six Thinking Hats**: Evaluates decisions across facts, intuition, risks, upside, alternatives, and process.
  3. **Weighted Decision Matrix**: Scores named options against weighted criteria side by side.
- **Multimodal Context & Live Web Search**: Attach links, PDF/Word/Excel/PowerPoint/text documents, images, and video frames, or toggle live web search inside the council room.
- **Bilingual Interface**: Full 1:1 parity across English (\`en\`) and Vietnamese (\`vi\`) with Light and Dark themes.

## Security & BYOK Model
- **Zero Markup**: Users bring their own API keys and pay model providers directly at native API rates.
- **AES-256 Encryption**: Provider keys are verified live before saving, encrypted at rest with AES-256, scoped strictly to the owner's account, and never exposed in client bundles or server logs.
- **Privacy First**: Conversations are private to the account owner and never used to train models. Analytics (if opted in) are cookie-free and never inspect prompts or responses.

## Supported LLM Providers
- **8 Built-in Verified Providers** (locked canonical endpoints):
  - Anthropic (\`https://api.anthropic.com/v1\`)
  - OpenAI (\`https://api.openai.com/v1\`)
  - Google Gemini (\`https://generativelanguage.googleapis.com/v1beta\`)
  - Groq (\`https://api.groq.com/openai/v1\`)
  - xAI Grok (\`https://api.x.ai/v1\`)
  - OpenRouter (\`https://openrouter.ai/api/v1\`)
  - NVIDIA NIM (\`https://integrate.api.nvidia.com/v1\`)
  - DeepSeek (\`https://api.deepseek.com/v1\`)
- **Custom Gateways**: Connect any custom OpenAI-compatible or Anthropic-compatible endpoint with live model verification.

## Pricing (Charged in VND via PayOS)
${planLines}

## Canonical Public Links
- [Overview & Pricing](${siteUrl}/): Main product overview, decision frameworks, pricing, and FAQ.
- [Overview (Tiếng Việt)](${siteUrl}/?lang=vi): Giao diện tiếng Việt đầy đủ của Zero Council.
- [User Guide](${siteUrl}/guide): Step-by-step documentation on framing questions, choosing frameworks, configuring bots, and running group chats.
- [Privacy Policy](${siteUrl}/legal/privacy): Personal data handling, BYOK cross-border model calls, retention, and user rights.
- [Terms of Service](${siteUrl}/legal/terms): Account rules, PayOS VND billing, acceptable use, and liability limits.
- [Refund Policy](${siteUrl}/legal/refund): Refund eligibility and request process.
- [Cookie Policy](${siteUrl}/legal/cookies): Essential session/preference cookies and opt-in analytics.
- [Acceptable Use Policy](${siteUrl}/legal/acceptable-use): Permitted and prohibited uses of the service.
- [Disclaimer](${siteUrl}/legal/disclaimer): AI output limitations and non-professional-advice notice.
- [Contact](${siteUrl}/legal/contact): Support, billing, and privacy contact details.
- [XML Sitemap](${siteUrl}/sitemap.xml): Crawlable index of all public bilingual URLs.
`;
}
