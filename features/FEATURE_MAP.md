# FEATURE_MAP — Zero Council (Production Architecture Inventory)

Truthful capability and verification inventory for **Zero Council** on `feat/production-launch-hardening`. Every status below reflects shipped, tested code in `web/src/**` and `tests/*.test.mjs` — zero placeholder mocks or unbuilt marketing claims.

---

## 1. Authentication, RBAC & Multi-Device Persistence

| Capability | Status | Implementation & Verification |
|---|---|---|
| Email/password sign-up & sign-in + Google / Discord OAuth | ✅ Shipped | Supabase Auth (`web/src/lib/supabase/`, `web/src/app/auth/callback/route.ts`, `SignInView.tsx`, `SignUpView.tsx`) |
| Mandatory password setup after first OAuth sign-in | ✅ Shipped | Middleware & `SetPasswordView.tsx` enforce `has_password` claim before workspace actions |
| Role-based access control (`admin` / `user`) + Founder lock | ✅ Shipped | `zc_users` + `FOUNDER_EMAILS` (`web/src/lib/currentUser.ts`, `web/src/lib/store/account.ts`, `tests/admin.test.mjs`) |
| Persistent bots, provider keys, conversations, orders, coupons & grants | ✅ Shipped | Supabase Postgres + Row-Level Security (`web/supabase/migrations/0001`..`0010`) |
| Graceful guest local fallback before sign-in | ✅ Shipped | Scoped client storage (`prototype/chat/storage.ts`, `sidebar-organization.ts`, `tests/storage.test.mjs`) |

---

## 2. Hardened BYOK & Server-Side AI Proxy

| Capability | Status | Implementation & Verification |
|---|---|---|
| 8 locked built-in providers (Anthropic, OpenAI, Google Gemini, Groq, xAI Grok, OpenRouter, NVIDIA NIM, DeepSeek) | ✅ Shipped | Canonical locked base URLs (`web/src/prototype/chat/byok/catalog.ts`, `tests/byok.test.mjs`) |
| Custom OpenAI- & Anthropic-compatible endpoints | ✅ Shipped | `CustomProviderModal.tsx` + `slugifyCustomProvider` (`web/src/lib/store/botValidation.ts`) |
| Live-inference key & model verification before save | ✅ Shipped | `POST /api/providers/verify` & `/api/providers/test` (`web/src/lib/byok/verify.ts`, `tests/byok-verify.test.mjs`) |
| `AES-256-GCM` encryption at rest for stored API keys | ✅ Shipped | `ZC_PROVIDER_KEY_SECRET` (`web/src/lib/security/crypto.ts`, `web/src/lib/store/providerKeys.ts`, `tests/security.test.mjs`) |
| Masked client state (`••••`) + server-proxied chat completions | ✅ Shipped | `POST /api/providers/chat` decrypts server-side per turn; raw keys never re-enter browser DOM or storage |
| SSRF + DNS-rebinding guard, CSRF `Origin` check, sliding-window rate limit | ✅ Shipped | `web/src/lib/security/{ssrf,csrf,rateLimit}.ts` (`tests/security.test.mjs`) |

---

## 3. Solo & Group Council Chat Engine

| Capability | Status | Implementation & Verification |
|---|---|---|
| Custom AI bots (name, system prompt, provider, verified model, color) | ✅ Shipped | `BotWizardView.tsx`, `PersonasView.tsx`, `/api/bots` (`tests/bots-and-conversations.test.mjs`) |
| Solo 1-on-1 multi-thread conversations | ✅ Shipped | `ChatRoomView.tsx` + `ChatRoomHeader.tsx` thread switcher, inline rename, and persistence |
| Group Councils (2–8 bots capped by plan: Free `2`, Pro `4`, Ultra `8`) | ✅ Shipped | `JoinRoomModal.tsx`, `lib/deliberation/plan.ts`, automatic lock/unlock on plan downgrade/upgrade (`tests/deliberation.test.mjs`) |
| Independent (`panel`) & Debate (`round-robin`) deliberation modes | ✅ Shipped | `prototype/chat/engine.ts` (`tests/chat-engine.test.mjs`, `tests/engine-v2.test.mjs`) |
| Structured A2A handoffs (`message_agent`), `@mention`, `@all`, `stop @bot`, `[SILENT]` | ✅ Shipped | Structured tool-call routing; prose `@name` mentions never trigger accidental handoffs (`tests/chat-engine.test.mjs`, `tests/mentions.test.mjs`) |
| Real cancellation (`AbortController`), per-turn timeout (30s), inline retry cards | ✅ Shipped | `useRoomMessaging.ts` + `ChatMessageItem.tsx` (`#chat-turn-error-card`) |
| Room Summary & AI Chair Conclusion (Good / Normal / Bad scenarios) | ✅ Shipped | `RoomSummaryView.tsx`, `SessionConcludedView.tsx`, `prototype/chat/conclusion/` (`tests/room-summary-conclusion.test.mjs`) |

---

## 4. Multimodal Attachments, Web Search & Content Render Panel

| Capability | Status | Implementation & Verification |
|---|---|---|
| Document attachments (`docx`, `xlsx`, `pptx`, `txt`, `md`, `csv`, `tsv`, `json`, `log`) | ✅ Shipped | Zero-dependency browser ZIP+XML & text extraction (`prototype/chat/read-file-web.ts`, `tests/read-file-web.test.mjs`) |
| Vision image attachments (`png`, `jpg`, `webp`, `gif`, `heic`) | ✅ Shipped | Client canvas resize ≤1568px & JPEG re-encode (strips EXIF) (`prototype/chat/read-image-web.ts`, `tests/attach-image.test.mjs`) |
| Video keyframe extraction (`mp4`, `webm`, `mov`) | ✅ Shipped | Sampled frame extraction for vision models (`prototype/chat/read-video-web.ts`) |
| SSRF-guarded URL attachment reader | ✅ Shipped | `POST /api/read-link` + `lib/deliberation/read-link.ts` (`tests/read-link.test.mjs`, `tests/read-link-web.test.mjs`) |
| Live web search grounding | ✅ Shipped | Composer globe toggle + `POST /api/web-search` |
| Content Render Panel (Markdown, syntax-highlighted code, collapsible tree graph) | ✅ Shipped | `prototype/chat/content-render.ts` + `components/ContentRenderPanel.tsx` (`tests/content-render.test.mjs`) |
| Sidebar department organization, pinning & JSON export/import | ✅ Shipped | `prototype/sidebar-organization.ts` + `components/Sidebar.tsx` (`tests/sidebar-organization.test.mjs`) |

---

## 5. PayOS v2 Billing, Promo Coupons & Admin Console

| Capability | Status | Implementation & Verification |
|---|---|---|
| Single source of truth pricing (`Free 0₫`, `Pro 139,000₫ / $5.99`, `Ultra 379,000₫ / $16.99`) | ✅ Shipped | `web/src/prototype/data/plans.ts` (`tests/pricing.test.mjs`) |
| One-time 30-day passes (zero recurring auto-charge) + self-serve downgrade/cancel | ✅ Shipped | `POST /api/payos/create-payment`, `POST /api/plan/cancel` |
| Local zero-dependency VietQR SVG rendering (no external QR image leak) | ✅ Shipped | `web/src/lib/qr-svg.ts` + `CheckoutQrModal.tsx` (`tests/qr-svg.test.mjs`) |
| HMAC-SHA256 webhook verification + idempotent `PAID` order finality | ✅ Shipped | `POST /api/payos/webhook` (`web/src/lib/payos/`, `tests/payos.test.mjs`, `tests/orders.test.mjs`) |
| Single-use percentage promo coupons (incl. 100%-off instant grant without PayOS fee) | ✅ Shipped | `zc_coupons` + `zc_coupon_redemptions` (`tests/coupons.test.mjs`) |
| Admin console (`/admin`) for users, roles, manual grants, and coupons | ✅ Shipped | `web/src/app/admin/` + `/api/admin/**` (`tests/admin.test.mjs`) |

---

## 6. UI, Bilingual SEO & Legal Transparency

| Capability | Status | Implementation & Verification |
|---|---|---|
| Full EN / VI localization with 100% key parity & localized runtime errors | ✅ Shipped | `web/src/prototype/i18n/` (`tests/ui-theme-i18n.test.mjs`) |
| Light / Dark editorial theme with WCAG 2.1 AA contrast (≥ 4.5:1) | ✅ Shipped | `web/src/app/globals.css` + `prototype/theme.ts` (`tests/ui-theme-i18n.test.mjs`) |
| Technical SEO (`canonical`, `hreflang`, OpenGraph, JSON-LD `@graph`, `sitemap.xml`, `robots.txt`, `llms.txt`) | ✅ Shipped | `web/src/lib/seo.ts` (`tests/seo.test.mjs`) |
| 7 bilingual legal documents (Terms, Privacy, Refund, Cookies, Acceptable Use, Disclaimer, Contact) + Cookie consent | ✅ Shipped | `prototype/i18n/legal-{en,vi}.ts`, `LegalView.tsx`, `CookieNotice.tsx` |

---

## 7. Known Boundaries (Documented By Design)

- **No recurring subscription auto-charge**: Pro and Ultra are one-time 30-day passes settled in VND via PayOS; expired passes automatically revert active bot/council caps to Free without deleting saved bots or history.
- **Attachment size & format guardrails**: Files are capped at `10 MB` and `30,000` extracted characters per document (`MAX_FILE_TEXT`), up to `4` resized images per message. Legacy binary Office files (`.doc`, `.xls`, `.ppt`) and `.pdf` uploads report explicit guidance rather than failing silently (no server-side file upload or OCR).
- **Non-professional-advice boundary**: Zero Council is a structured multi-perspective thinking tool, never a substitute for licensed legal, medical, financial, or tax professionals.
