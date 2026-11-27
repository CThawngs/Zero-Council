# Zero Council — Web Application (`web/`)

Production Next.js 16 (App Router) application powering **Zero Council** — a bilingual (EN/VI) multi-agent AI workspace and structured decision council with Bring-Your-Own-Key (BYOK) encryption, Supabase Auth & Postgres RLS persistence, and PayOS v2 one-time checkout.

## Stack

- **Framework**: Next.js 16 (App Router) · React 19 · TypeScript · Tailwind CSS v4 · Lucide Icons
- **Auth & Database**: Supabase Auth (Email/Password + Google & Discord OAuth, RBAC `admin` / `user`, founder lock) + Postgres with Row-Level Security (`supabase/migrations/0001`–`0010`)
- **BYOK Security**: Server-side `AES-256-GCM` key encryption (`ZC_PROVIDER_KEY_SECRET`), live-inference key & model verification, SSRF + DNS-rebinding guard, CSRF `Origin` enforcement, sliding-window rate limiting, and server-proxied completions (`/api/providers/chat`)
- **Billing**: PayOS v2 one-time 30-day passes (Free `0₫`, Pro `139,000₫`, Ultra `379,000₫` — no auto-renewal), HMAC-SHA256 webhook verification, zero-dependency local VietQR SVG rendering (`src/lib/qr-svg.ts`), and single-use percentage coupons

## Quick Start

Prerequisites: **Node.js 24 LTS** and **pnpm 10/11**.

```sh
# 1. Install dependencies
pnpm install --frozen-lockfile

# 2. Configure local environment variables
cp .env.example .env.local

# 3. Start local development server (http://localhost:3000)
pnpm dev
```

## Verification Gates

Run from `web/` (and run unit/integration tests from the repository root):

```sh
# TypeScript strict typecheck
pnpm exec tsc --noEmit

# ESLint (zero warnings / zero errors)
pnpm exec eslint

# Production Next.js build
pnpm exec next build

# Full Node test suite (run from repo root)
node --test --test-timeout=60000 ../tests/*.test.mjs
```

## Directory Layout (`web/src/`)

```text
src/
├── app/                        # Next.js App Router pages, SEO metadata, and API route handlers
│   ├── admin/                  # Role-gated admin console (users, roles, grants, promo coupons)
│   ├── api/
│   │   ├── admin/              # Admin CRUD endpoints (coupons, users, founder password reset)
│   │   ├── auth/               # Account existence check & OAuth callback flows
│   │   ├── bots/               # Authenticated CRUD for user-created AI bots (zc_agents)
│   │   ├── conversations/      # Multi-device Solo & Group conversation sync (zc_conversations)
│   │   ├── coupons/validate/   # Server-side promo code validation
│   │   ├── health/             # Readiness & runtime configuration probe
│   │   ├── me/                 # Session profile, active plan, grants, and RBAC flags
│   │   ├── orders/             # Authenticated billing history
│   │   ├── payos/              # create-payment, HMAC webhook, and order status polling
│   │   ├── plan/cancel/        # Self-serve plan downgrade / cancellation
│   │   ├── providers/          # BYOK verify, save, re-test, delete, and server-proxied chat
│   │   ├── read-link/          # SSRF-guarded server URL reader
│   │   └── web-search/         # Rate-limited live web search proxy
│   ├── auth/                   # OAuth PKCE callback & password-setup gate
│   └── checkout/return/        # Post-payment PayOS return confirmation screen
├── lib/                        # Server & shared domain modules
│   ├── byok/                   # Live provider/model verification & key sanitization
│   ├── deliberation/           # Plan advisor caps, roster partitioning, and scoring helpers
│   ├── payos/                  # PayOS v2 client, HMAC-SHA256 signer, and order store
│   ├── qr-svg.ts               # Zero-dependency ISO/IEC 18004 QR SVG generator for VietQR
│   ├── security/               # AES-256-GCM crypto, SSRF DNS guard, CSRF check, rate limiter
│   ├── seo.ts                  # Canonical URLs, hreflang, OpenGraph, JSON-LD, robots/sitemap
│   ├── store/                  # Persistence stores (account, bots, conversations, providerKeys)
│   └── supabase/               # Browser, server, and middleware Supabase clients
└── prototype/                  # Interactive workspace UI, council chat engine, and bilingual i18n
    ├── chat/                   # Multi-agent engine, BYOK adapters, attachments, conclusion parser
    ├── components/             # Modular UI views & subcomponents (chat-room, api-keys, checkout, etc.)
    ├── context/                # Domain-split workspace state context and hooks
    ├── data/                   # Single-source pricing (plans.ts) and provider catalog
    └── i18n/                   # Strict EN/VI translation dictionaries, legal docs, and localizers
```

For full architecture, deployment instructions, and bilingual documentation, see the root [`README.md`](../README.md) and [`features/FEATURE_MAP.md`](../features/FEATURE_MAP.md).
