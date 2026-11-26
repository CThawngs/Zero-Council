<h6 align="center">English · <a href="#tổng-quan">Tiếng Việt bên dưới</a></h6>

# Zero Council

**Zero Council** is a bilingual (English & Vietnamese) multi-agent AI workspace and structured decision council. Connect your own API keys (BYOK), build custom AI advisors across multiple providers, run 1-on-1 threads or multi-agent Council debates, and synthesize trade-offs into clear scenarios and next steps — while keeping the final decision yours.

> **Disclaimer**: Zero Council is a structured multi-perspective thinking tool, not legal, medical, financial, or tax advice. Always consult a qualified professional for regulated decisions.

---

## Key Capabilities

- **Bring Your Own Key (BYOK) with Server-Side Encryption** — Connect any of **8 locked built-in providers** (*Anthropic, OpenAI, Google Gemini, Groq, xAI Grok, OpenRouter, NVIDIA NIM, DeepSeek*) or add custom OpenAI/Anthropic-compatible endpoints. Every key & model is verified via live inference before saving, encrypted at rest on the server with `AES-256-GCM` (`ZC_PROVIDER_KEY_SECRET`), masked in client state (`••••`), and proxied through `/api/providers/chat` so raw secrets never re-enter browser storage or DOM.
- **Custom AI Bots & Multi-Model Councils** — Define specialized bots (name, role instructions, provider, verified model) and seat **2 to 8 advisors** in a Group Council (capped by plan: Free `2`, Pro `4`, Ultra `8`) or chat 1-on-1 across multiple threads.
- **Structured Multi-Agent Routing** — Run councils in **Independent** (`panel`) or **Debate** (`round-robin`) mode. Advisors hand off turns via structured `message_agent` tool calls (prose `@mentions` never accidentally trigger turns), support `@bot`, `@all`, `stop @bot`, and `[SILENT]`, and obey hard per-turn timeouts (`30s`) plus real `AbortController` cancellation.
- **Rich Context, Live Web Search & Content Render Panel** — Attach documents (`.docx`, `.pptx`, `.xlsx`, `.txt`, `.md`, `.csv`, `.tsv`, `.json`, `.log`), vision images (`.png`, `.jpg`, `.webp`, `.gif`, `.heic` resized client-side), video keyframes, SSRF-guarded web links (`/api/read-link`), and live web search (`/api/web-search`). Inspect structured outputs in the **Content Render Panel** (Markdown, syntax-highlighted code, and collapsible tree graphs), then generate **Room Summaries** and **AI Chair Conclusions** (*Good / Normal / Bad* scenarios).
- **Supabase Auth, RBAC & Multi-Device Sync** — Sign in via Email/Password, Google, or Discord (with mandatory password setup on first OAuth login). Bots, encrypted provider keys, conversations, orders, coupons, and plan grants persist in Supabase Postgres protected by Row-Level Security (`migrations/0001`–`0010`), plus a role-gated `/admin` console with founder lock protection.
- **One-Time 30-Day Passes via PayOS v2** — Server-authoritative VND checkout (`plans.ts`), zero-dependency local VietQR SVG generation (`lib/qr-svg.ts`), `HMAC-SHA256` webhook verification, idempotent `PAID` finality, and single-use percentage promo coupons (including instant 100%-off grants). No recurring auto-charge.
- **Full EN / VI Localization & Editorial Accessibility** — Instant language switching (`en` / `vi`) with 100% dictionary key parity, Light/Dark themes passing WCAG 2.1 AA contrast (`≥ 4.5:1`), native `<dialog>` focus management, technical SEO (`hreflang`, JSON-LD, `sitemap.xml`, `llms.txt`), and 7 bilingual legal documents.

---

## Technology Stack

| Layer | Technology |
|---|---|
| **Frontend & API** | Next.js `16.3.5` (App Router) · React `19.2.8` · TypeScript `5` · Tailwind CSS `v4` · Lucide Icons |
| **Auth & Database** | Supabase Auth (Email, Google, Discord) · Postgres + Row-Level Security (`0001`–`0010`) |
| **Security & BYOK** | `AES-256-GCM` key encryption · SSRF + DNS-rebinding guard · CSRF `Origin` validation · Sliding-window rate limiter |
| **Payments** | PayOS v2 (`@payos/node`, `HMAC-SHA256` webhook verification) · Local ISO/IEC 18004 QR SVG (`qr-svg.ts`) |
| **Verification** | Node 24 native test runner (`385` tests across `tests/*.test.mjs`) · `tsc --noEmit` · ESLint 9 · CI smoke check |

---

## Pricing (One-Time 30-Day Passes)

All prices derive from a single source of truth: `web/src/prototype/data/plans.ts`. VND is the authoritative settlement amount; USD is display reference only.

| Plan | Price (30-Day Pass) | Bot & Active Council Capacity |
|---|---|---|
| **Free** | `0₫` / `$0` | Up to **2** bots & active advisors per council |
| **Pro** | `139,000₫` / `$5.99` | Up to **4** bots & active advisors per council |
| **Ultra** | `379,000₫` / `$16.99` | Up to **8** bots & active advisors per council |

---

## Repository Architecture

```text
Zero-Council/
├── web/                              # Production Next.js 16 application
│   ├── src/
│   │   ├── app/                      # App Router pages, SEO metadata, /admin, and /api/** routes
│   │   │   ├── admin/                # Modular admin console (users, roles, grants, coupons)
│   │   │   ├── auth/                 # OAuth PKCE callback & password setup gate
│   │   │   ├── checkout/return/      # Post-payment PayOS status screen
│   │   │   └── api/                  # Hardened server routes (providers, bots, conversations, payos, admin, read-link, web-search, health)
│   │   ├── lib/
│   │   │   ├── byok/                 # Live inference provider/model verification & key sanitization
│   │   │   ├── deliberation/         # Roster caps, SSRF-safe link extraction, and scoring logic
│   │   │   ├── payos/                # PayOS v2 client, HMAC-SHA256 verification, and order persistence
│   │   │   ├── qr-svg.ts             # Zero-dependency VietQR SVG encoder
│   │   │   ├── security/             # AES-256-GCM crypto, SSRF DNS guard, CSRF check, rate limiter
│   │   │   ├── seo.ts                # Canonical URLs, hreflang, OpenGraph, JSON-LD, sitemap, llms.txt
│   │   │   ├── store/                # Account, bots, conversations, and encrypted provider-key stores
│   │   │   └── supabase/             # Browser, server, and middleware Supabase clients
│   │   └── prototype/                # Modular workspace UI, multi-agent engine, and bilingual i18n
│   │       ├── chat/                 # Council engine, BYOK adapters, attachments, conclusion parser
│   │       ├── components/           # Clean-Code views & subfolders (chat-room/, api-keys/, checkout/, bot-settings/, content-render/, sidebar/)
│   │       ├── context/              # Cohesive domain hooks backing AppContext
│   │       ├── data/                 # Pricing (plans.ts) and provider catalog
│   │       └── i18n/                 # Strict EN/VI dictionaries, legal copy, and error localizers
│   ├── supabase/migrations/          # SQL schema & RLS migrations (0001 -> 0010)
│   └── .env.example                  # Documented environment variable template
├── tests/                            # Automated Node 24 test suites (*.test.mjs)
├── ci/smoke.mjs                      # Production build HTTP & /api/health smoke verifier
└── features/FEATURE_MAP.md           # Truthful shipped capability & boundary inventory
```

---

## Getting Started (Local Development)

Prerequisites: **Node.js 24 LTS** and **pnpm 11.5.2** (or pnpm 10+).

```sh
# 1. Install web dependencies
pnpm --dir web install --frozen-lockfile

# 2. Copy environment template and fill Supabase / secret values
cp web/.env.example web/.env.local

# 3. Start local dev server at http://localhost:3000
pnpm --dir web dev
```

### Production Environment Variables (`web/.env.local` / Vercel)

See [`web/.env.example`](web/.env.example) for full documentation:

```ini
NEXT_PUBLIC_SITE_URL=https://zerocouncil.app
NEXT_PUBLIC_SUPABASE_URL=https://<project-ref>.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_...
SUPABASE_URL=https://<project-ref>.supabase.co
SUPABASE_SERVICE_ROLE_KEY=sb_secret_...
ZC_PROVIDER_KEY_SECRET=<base64-encoded-32-random-bytes>
PAYOS_CLIENT_ID=...
PAYOS_API_KEY=...
PAYOS_CHECKSUM_KEY=...
FOUNDER_EMAILS=founder@example.com
```

Apply all SQL migrations in `web/supabase/migrations/` (`0001` through `0010`) in order before serving production traffic, and register `https://<your-domain>/api/payos/webhook` in your PayOS merchant channel.

### Quality & Verification Gates

```sh
node --test --test-timeout=60000 tests/*.test.mjs
pnpm --dir web exec tsc --noEmit
pnpm --dir web exec eslint
pnpm --dir web exec next build
```

Full feature and boundary matrix: [`features/FEATURE_MAP.md`](features/FEATURE_MAP.md).

---

<br>

<h6 align="center">Tiếng Việt · <a href="#zero-council">English above</a></h6>

# Tổng quan

**Zero Council** là không gian làm việc AI đa tác tử (multi-agent) và hội đồng phản biện quyết định song ngữ Anh – Việt. Bạn kết nối API key của riêng mình (BYOK), tự tạo đội ngũ cố vấn AI từ nhiều nhà cung cấp, trò chuyện 1-1 nhiều luồng hoặc mở phòng họp Hội đồng đa mô hình, rồi tổng hợp các góc nhìn trái chiều thành kịch bản và bước hành động cụ thể — quyền quyết định cuối cùng luôn thuộc về bạn.

> **Lưu ý miễn trừ**: Zero Council là công cụ hỗ trợ tư duy đa chiều có cấu trúc, không phải tư vấn pháp lý, y tế, tài chính hay thuế chuyên nghiệp.

---

## Tính năng cốt lõi

- **BYOK bảo mật phía máy chủ (`AES-256-GCM`)** — Hỗ trợ **8 nhà cung cấp tích hợp sẵn khóa chặt endpoint** (*Anthropic, OpenAI, Google Gemini, Groq, xAI Grok, OpenRouter, NVIDIA NIM, DeepSeek*) cùng cổng tùy chỉnh chuẩn OpenAI / Anthropic. Mọi API key và model đều được kiểm tra phản hồi thật trước khi lưu, mã hóa `AES-256-GCM` bằng `ZC_PROVIDER_KEY_SECRET`, che mặt nạ (`••••`) trên trình duyệt và gọi qua proxy `/api/providers/chat` để khóa thô không bao giờ lộ ra DOM hay bộ nhớ trình duyệt.
- **Tự tạo Bot AI & Phòng họp Hội đồng** — Khởi tạo cố vấn tùy chỉnh (tên, chỉ dẫn vai trò, nhà cung cấp, model đã xác thực), mở chat đơn đa luồng hoặc lập Hội đồng nhóm từ **2 đến 8 bot** theo gói (Free `2`, Pro `4`, Ultra `8`).
- **Điều phối đa tác tử có cấu trúc** — Chạy phòng họp ở chế độ **Độc lập** (`panel`) hoặc **Tranh luận** (`round-robin`). Cố vấn chuyển lượt qua tool call `message_agent` có cấu trúc (nhắc `@tên` trong văn xuôi không gây nhảy lượt nhầm), hỗ trợ `@bot`, `@all`, `stop @bot`, `[SILENT]`, giới hạn thời gian mỗi lượt (`30s`) và nút dừng hủy request thật qua `AbortController`.
- **Đính kèm đa phương thức, Tìm kiếm Web & Content Render Panel** — Đính kèm tài liệu (`.docx`, `.pptx`, `.xlsx`, `.txt`, `.md`, `.csv`, `.tsv`, `.json`, `.log`), ảnh thị giác (`.png`, `.jpg`, `.webp`, `.gif`, `.heic` tự thu nhỏ & xóa EXIF trên trình duyệt), khung hình video, đọc link chống SSRF (`/api/read-link`) và tìm kiếm web trực tiếp (`/api/web-search`). Xem nội dung dài trong **Content Render Panel** (Markdown, code tô màu cú pháp, sơ đồ cây thu gọn), xuất **Tóm tắt phòng** và **Kết luận Chủ tọa AI** theo 3 kịch bản *Tốt / Bình thường / Xấu*.
- **Xác thực Supabase, Phân quyền RBAC & Đồng bộ đa thiết bị** — Đăng nhập Email/Mật khẩu, Google hoặc Discord (bắt buộc thiết lập mật khẩu ở lần đăng nhập OAuth đầu tiên). Toàn bộ bot, khóa mã hóa, hội thoại, đơn hàng, mã giảm giá và gói cước lưu trên Supabase Postgres có Row-Level Security (`migrations/0001`–`0010`), kèm trang quản trị `/admin` và khóa bảo vệ tài khoản Founder.
- **Thanh toán PayOS v2 một lần cho gói 30 ngày** — Tính tiền chuẩn phía server từ `plans.ts`, tự vẽ mã VietQR SVG nội bộ không phụ thuộc thư viện ngoài (`lib/qr-svg.ts`), xác thực chữ ký webhook `HMAC-SHA256`, chống ghi đè đơn `PAID`, hỗ trợ coupon giảm theo phần trăm (mỗi tài khoản 1 lần, mã `100%` kích hoạt ngay không tốn phí cổng). Không tự động gia hạn.
- **Song ngữ Anh / Việt & Chuẩn tiếp cận WCAG AA** — Chuyển đổi tức thì EN / VI khớp 100% khóa dịch, giao diện Sáng / Tối đạt tương phản WCAG 2.1 AA (`≥ 4.5:1`), SEO kỹ thuật đầy đủ (`hreflang`, JSON-LD, `sitemap.xml`, `llms.txt`) và 7 tài liệu pháp lý song ngữ minh bạch.

---

## Bảng giá (Gói 30 ngày thanh toán một lần)

Mọi mức giá đọc từ một nguồn duy nhất `web/src/prototype/data/plans.ts`. VNĐ là số tiền thanh toán thực tế; USD chỉ mang tính tham khảo hiển thị.

| Gói | Giá (30 ngày) | Giới hạn Bot & Cố vấn trong phòng họp |
|---|---|---|
| **Free** | `0₫` / `$0` | Tối đa **2** bot & cố vấn hoạt động cùng lúc |
| **Pro** | `139.000₫` / `$5.99` | Tối đa **4** bot & cố vấn hoạt động cùng lúc |
| **Ultra** | `379.000₫` / `$16.99` | Tối đa **8** bot & cố vấn hoạt động cùng lúc |

---

## Khởi chạy nhanh & Kiểm chứng chất lượng

Yêu cầu: **Node.js 24 LTS** và **pnpm 11.5.2** (hoặc pnpm 10+).

```sh
# Cài đặt dependencies
pnpm --dir web install --frozen-lockfile

# Tạo file môi trường local từ mẫu
cp web/.env.example web/.env.local

# Chạy máy chủ phát triển tại http://localhost:3000
pnpm --dir web dev
```

Chạy bộ cổng kiểm chứng trước khi phát hành:

```sh
node --test --test-timeout=60000 tests/*.test.mjs
pnpm --dir web exec tsc --noEmit
pnpm --dir web exec eslint
pnpm --dir web exec next build
```

Xem kiểm kê chi tiết toàn bộ tính năng và giới hạn thiết kế tại [`features/FEATURE_MAP.md`](features/FEATURE_MAP.md).
