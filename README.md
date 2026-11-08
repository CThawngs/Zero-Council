<h6 align="center">English</h6>

# Overview

**Zero Council** is a bilingual structured decision council for genuinely hard calls. You frame a question, invite several advisors with different perspectives, and walk the decision through a checkable framework — ending with what to review and what to do next. The decision stays yours.

**Live at [zero-council-ebon.vercel.app](https://zero-council-ebon.vercel.app/).** Not professional advice — not legal, medical, financial, or tax. Treat the output as a structured second opinion, never a substitute for a qualified professional.

## Why This Exists

A hard decision is rarely one question with one answer. It is the same question seen from cost, risk, purpose, and timing — and a single chat thread flattens all of that. Zero Council keeps the structure: frame the question, let each advisor argue from their own lens, then synthesize the disagreements into review criteria and a next step instead of a confident verdict.

### What You Can Do

- 🧭 **Frame a real question** in plain language, pick a framework, and pick your advisors.
- 🗣️ **Run a deliberation** in independent, debate, or chain mode — rounds are kept as history, so a method change never rewrites a finished round.
- 💬 **Open a council room** where advisors take turns via `@name`, `@all`, `stop`, or `[SILENT]` — handoffs are structured data, never parsed from prose.
- 🔑 **Bring your own key (BYOK)** — Anthropic/OpenAI adapters that call the provider from the browser. Keys stay in tab memory, never in the bundle or logs.
- 💳 **Pay once with payOS** — server-verified HMAC webhooks, amounts read from one file, no client-supplied prices. No subscription yet.
- 🌐 **Read everything in English or Vietnamese** — UI, metadata, and legal docs switch instantly and persist.

## Try It Live: [Zero Council](https://zero-council-ebon.vercel.app/)

---

## 🎬 How to Try It

### 1. Start a Council

Open the landing page and press **Start free council**. Describe the decision, pick a framework, then continue.

### 2. Deliberate

Choose how advisors talk — *Independent* (each alone), *Debate* (each answers the previous), *Chain* (each builds on the previous). Run a round, add a follow-up, or cancel a round that is still running.

### 3. Read the Result

The Chair's synthesis lands with review conditions and a next step. Pick another framework (Scenario Paths, Six Thinking Hats, or Decision Matrix) and the panel re-renders — including live weight sliders on the matrix.

---

## Key Features

- 🧭 **3 decision frameworks** — Scenario Paths (favorable / neutral / difficult), Six Thinking Hats (fact → feeling → risk → upside → alternatives → process), and a weighted Decision Matrix where moving a weight re-scores every option live.
- 💬 **Council room with structured handoffs** — an advisor hands the floor via a structured `message_agent` call, not by typing `@name` in prose. A quoted mention never routes. Streaming, per-turn timeouts (30s), and stop-that-actually-stops are wired in.
- 🧑‍💼 **Custom advisors** — name, archetype, stance, model, and guidance per advisor, capped by plan (2 / 4 / 8 active at once).
- 🔗 **Attach a link to a round** — the link is read once, pinned to the round, and quoted in the discussion. Browser-side reading is CORS-limited: when a site blocks CORS the room says so instead of faking success.
- 🌐 **Full EN / VI** — instant toggle, `localStorage` persistence (`zc-lang`), and translated document metadata. Self-hosted fonts with Vietnamese glyphs; no Google Fonts request at build or runtime.
- 🎨 **Dark / light theme** — real control via `data-theme` on `<html>`, persisted as `zc-theme`, applied before first paint so there is no flash of wrong theme.
- 🔐 **Auth + roles on Supabase** — email/password plus Google/Discord, RBAC (`admin` / `user`) in `zc_users`, and an admin surface (`/admin`, 5s polling) for coupons and roles.
- 💸 **payOS one-time checkout** — `POST /api/payos/create-payment` reads the amount from `plans.ts` server-side and refuses anonymous buyers (401 `NEED_LOGIN`); the webhook only flips an order to `PAID` when the HMAC signature verifies **and** the amount matches exactly. `PAID` is final — a late failure notification never downgrades it.
- 🏷️ **Coupons that respect abuse** — percent-off coupons, one redemption per account enforced by database key, and a 100% coupon that settles in-system instead of wasting a payOS fee.
- 📜 **Legal pages that admit they are drafts** — 7 documents (Terms, Privacy, Refund, Cookies, Acceptable Use, Disclaimer, Contact) rendered from one view; unknown operator facts stay as `{{PLACEHOLDER}}` instead of invented text.
- ♿ **Accessibility baseline** — native `<dialog>` with focus return, ≥44px targets, `prefers-reduced-motion` support, and no overflow from 320px to desktop widths.

## Technology

| Layer | Stack |
|---|---|
| **App** | Next.js 16.3.5 (App Router) · React 19.2.8 · TypeScript · Tailwind CSS v4 |
| **Auth & storage** | Supabase (Postgres via PostgREST, Auth, RLS) |
| **Payments** | payOS v2 (`/v2/payment-requests`), HMAC-SHA256 signature verification |
| **BYOK adapters** | Anthropic (`/v1/messages`) · OpenAI (`/v1/chat/completions`) — browser-side |
| **Hosting** | Vercel |

## Pricing

Prices live in **one file** — `web/src/prototype/data/plans.ts` (`priceVnd` is the source integer; `priceUsd` is a published static string, never computed live). Every price on screen derives from it. VNĐ is always the real charge; USD is reference only.

| Plan | Price | Arena |
|---|---|---|
| Free | 0₫ / $0 | up to 2 advisors active at once |
| Pro | 139.000₫ / $5.99 | up to 4 advisors |
| Ultra | 379.000₫ / $16.99 | up to 8 advisors |

## Project Architecture

```
Zero-Council/
├── web/                        # Next.js 16 app (deployed on Vercel)
│   ├── src/
│   │   ├── app/
│   │   │   ├── page.tsx        # "/" — renders the prototype shell
│   │   │   ├── fixture/        # fixed bilingual reference content
│   │   │   ├── auth/           # sign-in / sign-up (Google, Discord, email)
│   │   │   ├── checkout/return/# post-payment status page
│   │   │   ├── admin/          # coupon + role management (admin only)
│   │   │   └── api/
│   │   │       ├── council/    # fixed reference payload (UI never calls it)
│   │   │       ├── payos/      # create-payment · webhook · orders/[orderCode]
│   │   │       └── admin/      # coupons · users (role-gated)
│   │   ├── lib/
│   │   │   ├── currentUser.ts  # ONE seam: authenticateFromSession (Colleague auth plugs here)
│   │   │   ├── deliberation/   # runDeliberation seam + plan/matrix logic
│   │   │   ├── payos/          # HMAC signature + order store (Postgres / file fallback)
│   │   │   ├── store/account.ts# users, grants, redemptions
│   │   │   └── supabase/      # server + client + proxy wiring
│   │   └── prototype/          # the shell that "/" renders
│   │       ├── App.tsx         # view switcher (22+ views)
│   │       ├── context/AppContext.tsx # lang/theme/view state
│   │       ├── chat/           # A2A engine · BYOK adapters · sessionStorage store · read-link
│   │       ├── data/plans.ts   # single source of truth for all prices
│   │       └── i18n.ts         # every EN/VI string (incl. drafts for legal)
│   ├── supabase/migrations/    # 0001 orders · 0002 coupons + users
│   └── .env.example            # PayOS + Supabase blanks (copy to .env.local)
├── src/lib/budget.mjs          # legacy scaffold guard (not wired into the app)
├── tests/                     # node --test suites (payos, orders, coupons, engines)
├── .github/workflows/         # verify (auto-boot + evidence) · sync Vercel env (manual)
├── .agent/                    # SPEC · HANDOFF · GOVERNANCE · evidence
└── features/FEATURE_MAP.md    # honest inventory: proven vs landing copy
```

## Getting Started

Prereqs: Node 24 LTS + pnpm 11.5.2.

```sh
pnpm --dir web install --frozen-lockfile
pnpm --dir web dev
```

Runs at http://localhost:3000. No API key needed to see the shell. Quality gates:

```sh
node --test tests/*.mjs          # payos · orders · coupons · engines
pnpm --dir web lint
pnpm --dir web exec tsc --noEmit
pnpm --dir web build
```

### PayOS + Supabase setup (production)

1. Create a payOS merchant account at [my.payos.vn](https://my.payos.vn), finish verification, create a payment channel, and copy **Client ID**, **API Key**, **Checksum Key**.
2. Fill `web/.env.local` (git-ignored). On Vercel, set the same values in **Project Settings → Environment Variables** — the build reads env from the host, not from GitHub:

```ini
PAYLOS_CLIENT_ID=...
PAYLOS_API_KEY=...
PAYLOS_CHECKSUM_KEY=...
SUPABASE_URL=https://<project-ref>.supabase.co
SUPABASE_SERVICE_ROLE_KEY=...   # server only
```

Optional: `PAYLOS_DISCOUNT_CODES=WELCOME=10000,PARTNER=25000` (`CODE=amount off, VND`). Empty means every code is rejected — the safe default.

3. Apply both migrations in order — `web/supabase/migrations/0001_zc_orders.sql` then `0002_zc_coupons.sql` — via Supabase CLI `supabase db push`, the SQL Editor, or the Management API. DDL cannot go through PostgREST.
4. Seed the first admin by hand, once:

```sql
insert into zc_users (email, role) values ('you@example.com', 'admin')
on conflict (email) do nothing;
```

5. Register the webhook in the payOS channel as `https://zero-council-ebon.vercel.app/api/payos/webhook` — HTTPS public only. `localhost` needs a tunnel (`cloudflared tunnel --url http://localhost:3000`) before registering.

Secret hygiene: secrets live in the host env, never in git. Skipping step 3 or 5 does not crash the build — it surfaces as `503 PAYLOS_NOT_CONFIGURED` or `SUPABASE_400:<body>` at the first real transaction. Test one real payment before taking money.

## Current Scope — Read This Before You Quote the Landing Page

The landing copy describes the product as it is meant to be. The engine is deliberately staged, and this list splits what is real from what is structure-only:

| Area | Status |
|---|---|
| UI, bilingual copy, themes, adaptive layout, dialog focus, clipboard truth | ✅ real, keyboard- and screen-reader-driven |
| Auth (email + Google/Discord), roles, admin, account store | ✅ real, behind the one seam in `currentUser.ts` |
| Deliberation **shape** (mode, rounds, matrix geometry, Chair synthesis) | ✅ real — but `runDeliberation` still returns canned text behind the seam |
| Council room routing (A2A handoffs, caps, stop/cancel, per-turn timeout) | ✅ real, proven with a scripted generator |
| BYOK adapters + link-attach | ✅ code-complete, provider calls never ran against a live key |
| payOS checkout + webhook + coupons + grants | ✅ code-complete, one real payment still to verify end-to-end |
| Subscription auto-renewal, per-round memory, server-side transcript storage | ❌ not built |

Key handling is honest: keys live in tab RAM and transcripts in `sessionStorage` — readable by that browser, lost when the tab closes, and not encrypted at rest. The landing page's "AES-256" and "encrypted conversations" claims are landing copy, not app behavior. Full inventory: [`features/FEATURE_MAP.md`](features/FEATURE_MAP.md).

## Conclusion

Built as a focused, honest first release: a structured council with real billing and auth, and an AI engine that drops in when the seam is ready. The decision stays yours — Zero Council just helps you see every angle before you commit.

<br><br>

&nbsp;
<h6 align="center">Tiếng Việt</h6>

# Tổng quan

**Zero Council** là hội đồng quyết định song ngữ cho những quyết định thực sự khó. Bạn định khung câu hỏi, mời nhiều cố vấn với góc nhìn khác nhau, và đi qua quyết định bằng một khung có thể kiểm chứng — kết thúc bằng tiêu chí xem lại và bước tiếp theo. Quyết định cuối cùng vẫn thuộc về bạn.

**Trải nghiệm tại [zero-council-ebon.vercel.app](https://zero-council-ebon.vercel.app/).** Đây không phải tư vấn chuyên môn — không phải pháp lý, y tế, tài chính hay thuế. Hãy coi kết quả như một góc nhìn thứ hai có cấu trúc, đừng thay cho một chuyên gia có giấy phép.

## Vì sao có dự án này

Quyết định khó hiếm khi là một câu hỏi với một đáp án. Cùng một câu hỏi nhìn từ chi phí, rủi ro, mục đích và thời điểm — và một luồng chat dồn hết vào một cột. Zero Council giữ nguyên cấu trúc: định khung câu hỏi, để mỗi cố vấn tranh luận từ góc của mình, rồi tổng hợp bất đồng thành tiêu chí xem lại và bước tiếp theo thay vì một phán quyết chắc chắn.

### Những gì bạn có thể làm

- 🧭 **Định khung một câu hỏi thật** bằng ngôn ngữ thường, chọn khung phân tích và chọn cố vấn.
- 🗣️ **Chạy một vòng họp** ở chế độ độc lập, tranh luận hoặc chuỗi — các vòng là lịch sử đóng băng, đổi phương thức không bao giờ viết lại vòng đã xong.
- 💬 **Mở phòng hội đồng** nơi cố vấn trao lượt bằng `@tên`, `@all`, `stop` hoặc `[SILENT]` — chuyển lượt là dữ liệu có cấu trúc, không đọc từ văn phong.
- 🔑 **Dùng khóa của bạn (BYOK)** — adapter Anthropic/OpenAI gọi thẳng từ trình duyệt. Khóa nằm trong RAM của tab, không vào bundle, không vào log.
- 💳 **Thanh toán một lần qua payOS** — webhook verify chữ ký HMAC ở server, số tiền đọc từ một file duy nhất, trình duyệt không bao giờ gửi giá. Chưa có subscription.
- 🌐 **Đọc toàn bộ bằng tiếng Anh hoặc tiếng Việt** — giao diện, metadata và tài liệu pháp lý đổi tức thì và được nhớ lại.

## Thử ngay tại đây: [Zero Council](https://zero-council-ebon.vercel.app/)

---

## 🎬 Cách thử

### 1. Bắt đầu hội đồng

Mở trang chủ và bấm **Bắt đầu hội đồng miễn phí**. Mô tả quyết định, chọn khung phân tích, rồi tiếp tục.

### 2. Cùng suy nghĩ

Chọn cách cố vấn nói chuyện — *Độc lập* (mỗi người một mình), *Tranh luận* (mỗi người trả lời người trước), *Chuỗi* (mỗi người tiếp nối người trước). Chạy một vòng, thêm câu hỏi tiếp hay hủy vòng đang chạy.

### 3. Đọc kết quả

Bản tổng hợp của Ghế chủ tọa đi kèm tiêu chí xem lại và bước tiếp theo. Đổi sang khung khác (Nhánh kịch bản, Sáu chiếc mũ tư duy, Ma trận quyết định) và panel vẽ lại — gồm cả thanh trượt weight trực quan trên ma trận.

---

## Tính năng chính

- 🧭 **3 khung quyết định** — Nhánh kịch bản (thuận lợi / trung tính / khó khăn), Sáu chiếc mũ tư duy (sự thật → cảm xúc → rủi ro → lợi ích → phương án khác → quá trình), và Ma trận quyết định có trọng số: kéo weight là mọi phương án chấm lại ngay.
- 💬 **Phòng hội đồng với chuyển lượt có cấu trúc** — cố vấn trao lượt bằng tool call `message_agent` có cấu trúc, không gạch `@tên` trong câu chữ. Trích dẫn `@tên` không bao giờ tự chuyển lượt. Streaming, timeout từng lượt (30s) và nút dừng thật dừng ngay đã có.
- 🧑‍💼 **Cố vấn tùy chỉnh** — tên, nguyên mẫu, quan điểm, mô hình, hướng dẫn riêng cho từng người; giới hạn theo gói (2 / 4 / 8 người cùng lúc).
- 🔗 **Ghim link vào một vòng** — link đọc một lần, gắn chặt vào vòng đó và được trích dẫn trong thảo luận. Đọc phía trình duyệt bị CORS chặn: website chặn CORS thì phòng báo thẳng thay vì giả vờ đọc được.
- 🌐 **EN / VI đầy đủ** — chuyển đổi tức thì, nhớ bằng `localStorage` (`zc-lang`), metadata tài liệu cũng dịch. Font tự host có dấu tiếng Việt; build và runtime đều không gọi Google Fonts.
- 🎨 **Giao diện tối / sáng** — điều khiển thật qua `data-theme` trên `<html>`, lưu ở `zc-theme`, áp trước lần vẽ đầu tiên nên không nháy màu sai.
- 🔐 **Auth + phân quyền trên Supabase** — email/mật khẩu cộng Google/Discord, vai trò (`admin` / `user`) trong `zc_users`, trang quản trị (`/admin`, poll 5s) cho coupon và vai trò.
- 💸 **Checkout payOS một lần** — `POST /api/payos/create-payment` đọc số tiền tự `plans.ts` ở server và từ chối khách ẩn danh (401 `NEED_LOGIN`); webhook chỉ đổi đơn sang `PAID` khi chữ ký HMAC hợp lệ **và** số tiền khớp tuyệt đối. `PAID` là trạng thái cuối — thông báo thất bại đến muộn không bao giờ hạ nó.
- 🏷️ **Coupon chống lạm dụng** — giảm phần trăm, mỗi tài khoản dùng một mã một lần do database chặn, mã 100% chốt ngay trong hệ thống thay vì tốn phí giao dịch payOS.
- 📜 **Trang pháp lý thẳng thắn là bản nháp** — 7 tài liệu (Điều khoản, Riêng tư, Hoàn tiền, Cookie, Sử dụng chấp nhận được, Tuyên bố miễn trừ, Liên hệ) render từ một view; sự thật chưa có nguồn chân lý để lại `{{PLACEHOLDER}}` thay vì bịa chữ.
- ♿ **Nền tảng accessibility** — `<dialog>` gốc có trả focus, vùng chạm ≥44px, hỗ trợ `prefers-reduced-motion`, không tràn layout từ 320px đến màn hình lớn.

## Công nghệ

| Lớp | Công nghệ |
|---|---|
| **Ứng dụng** | Next.js 16.3.5 (App Router) · React 19.2.8 · TypeScript · Tailwind CSS v4 |
| **Auth & lưu trữ** | Supabase (Postgres qua PostgREST, Auth, RLS) |
| **Thanh toán** | payOS v2 (`/v2/payment-requests`), verify chữ ký HMAC-SHA256 |
| **Adapter BYOK** | Anthropic (`/v1/messages`) · OpenAI (`/v1/chat/completions`) — chạy phía trình duyệt |
| **Hosting** | Vercel |

## Giá

Giá nằm ở **một file duy nhất** — `web/src/prototype/data/plans.ts` (`priceVnd` là số nguyên gốc; `priceUsd` là chuỗi tĩnh đã duyệt, không tính lại bằng tỷ giá). Mọi nơi có giá đều đọc từ đó. VNĐ luôn là số tiền thật; USD chỉ để tham khảo.

| Gói | Giá | Sức chứa |
|---|---|---|
| Free | 0₫ / $0 | tối đa 2 cố vấn cùng lúc |
| Pro | 139.000₫ / $5.99 | tối đa 4 cố vấn |
| Ultra | 379.000₫ / $16.99 | tối đa 8 cố vấn |

## Kiến trúc dự án

```
Zero-Council/
├── web/                        # App Next.js 16 (deploy trên Vercel)
│   ├── src/
│   │   ├── app/
│   │   │   ├── page.tsx        # "/" — render shell prototype
│   │   │   ├── fixture/        # nội dung tham chiếu song ngữ cố định
│   │   │   ├── auth/           # đăng nhập / đăng ký (Google, Discord, email)
│   │   │   ├── checkout/return/# trang trạng thái sau thanh toán
│   │   │   ├── admin/          # quản trị coupon + vai trò (chỉ admin)
│   │   │   └── api/
│   │   │       ├── council/    # payload tham chiếu cố định (UI không gọi)
│   │   │       ├── payos/      # create-payment · webhook · orders/[orderCode]
│   │   │       └── admin/      # coupons · users (chặn theo vai trò)
│   │   ├── lib/
│   │   │   ├── currentUser.ts  # đúng một đường seam: authenticateFromSession
│   │   │   ├── deliberation/   # seam runDeliberation + logic plan/ma trận
│   │   │   ├── payos/          # chữ ký HMAC + order store (Postgres / file fallback)
│   │   │   ├── store/account.ts# users, grants, redemptions
│   │   │   └── supabase/      # server + client + proxy
│   │   └── prototype/          # shell mà "/" render
│   │       ├── App.tsx         # bộ chuyển view (22+ view)
│   │       ├── context/AppContext.tsx # trạng thái lang/theme/view
│   │       ├── chat/           # engine A2A · adapter BYOK · store sessionStorage · read-link
│   │       ├── data/plans.ts   # nguồn sự thật duy nhất cho mọi giá
│   │       └── i18n.ts         # mọi chuỗi EN/VI (kể cả nháp pháp lý)
│   ├── supabase/migrations/    # 0001 orders · 0002 coupons + users
│   └── .env.example            # mẫu PayOS + Supabase (copy thành .env.local)
├── src/lib/budget.mjs          # guard scaffold cũ (không nối vào app)
├── tests/                     # bộ node --test (payos, orders, coupons, engine)
├── .github/workflows/         # verify (tự boot + evidence) · sync Vercel env (thủ công)
├── .agent/                    # SPEC · HANDOFF · GOVERNANCE · evidence
└── features/FEATURE_MAP.md    # kiểm kê trung thực: đã chứng minh vs copy landing
```

## Bắt đầu

Yêu cầu: Node 24 LTS + pnpm 11.5.2.

```sh
pnpm --dir web install --frozen-lockfile
pnpm --dir web dev
```

Chạy tại http://localhost:3000. Xem shell không cần API key. Cổng chất lượng:

```sh
node --test tests/*.mjs          # payos · orders · coupons · engine
pnpm --dir web lint
pnpm --dir web exec tsc --noEmit
pnpm --dir web build
```

### Cài đặt payOS + Supabase (production)

1. Tạo tài khoản merchant tại [my.payos.vn](https://my.payos.vn), xác minh, tạo cổng thanh toán, copy **Client ID**, **API Key**, **Checksum Key**.
2. Điền `web/.env.local` (đã git-ignore). Trên Vercel, đặt cùng giá trị ở **Project Settings → Environment Variables** — build đọc env từ host, không từ GitHub:

```ini
PAYLOS_CLIENT_ID=...
PAYLOS_API_KEY=...
PAYLOS_CHECKSUM_KEY=...
SUPABASE_URL=https://<project-ref>.supabase.co
SUPABASE_SERVICE_ROLE_KEY=...   # chỉ server
```

Tùy chọn: `PAYLOS_DISCOUNT_CODES=WELCOME=10000,PARTNER=25000` (`MÃ=số tiền giảm, VNĐ`). Để trống nghĩa là mọi mã đều bị từ chối — mặc định an toàn.

3. Apply cả hai migration theo thứ tự — `web/supabase/migrations/0001_zc_orders.sql` rồi `0002_zc_coupons.sql` — bằng Supabase CLI `supabase db push`, SQL Editor, hoặc Management API. DDL không chạy qua PostgREST.
4. Seed admin đầu tiên bằng tay, một lần:

```sql
insert into zc_users (email, role) values ('you@example.com', 'admin')
on conflict (email) do nothing;
```

5. Đăng ký webhook trong cổng payOS là `https://zero-council-ebon.vercel.app/api/payos/webhook` — chỉ HTTPS public. `localhost` cần tunnel (`cloudflared tunnel --url http://localhost:3000`) trước khi đăng ký.

Vệ sinh secret: secret nằm ở env của host, không vào git. Bỏ qua bước 3 hoặc 5 không làm build crash — nó lộ ra ở giao dịch đầu tiên dưới dạng `503 PAYLOS_NOT_CONFIGURED` hoặc `SUPABASE_400:<body>`. Chạy một đơn thật từ đầu đến cuối trước khi nhận tiền.

## Phạm vi hiện tại — đọc trước khi trích dẫn landing

Copy landing mô tả sản phẩm khi đã hoàn thiện. Engine được tách giai đoạn có chủ ý, và bảng này tách rõ thứ thật với thứ chỉ mới có khung:

| Hạng mục | Trạng thái |
|---|---|
| UI, copy song ngữ, theme, layout adaptive, focus dialog, clipboard truth | ✅ thật, điều khiển bằng bàn phím và đọc được bằng screen reader |
| Auth (email + Google/Discord), vai trò, admin, account store | ✅ thật, qua đúng một seam trong `currentUser.ts` |
| **Hình dạng** deliberation (mode, vòng, hình ma trận, tổng hợp Chair) | ✅ thật — nhưng `runDeliberation` vẫn trả văn bản cố định sau seam |
| Routing phòng hội đồng (handoff A2A, trần, stop/hủy, timeout) | ✅ thật, đã chứng minh bằng scripted generator |
| Adapter BYOK + ghim link | ✅ code xong, chưa từng gọi provider bằng key thật |
| Checkout payOS + webhook + coupon + grant | ✅ code xong, cần verify một lượt thanh toán thật đầu-cuối |
| Subscription gia hạn, memory từng vòng, lưu transcript server-side | ❌ chưa xây |

Xử lý key nói thẳng: key nằm trong RAM của tab, transcript nằm trong `sessionStorage` — trình duyệt đó đọc được, đóng tab là mất, không mã hóa lúc lưu. Câu "AES-256" và "hội thoại được mã hóa" trên landing là copy marketing, không phải hành vi của app. Kiểm kê đầy đủ: [`features/FEATURE_MAP.md`](features/FEATURE_MAP.md).

## Kết luận

Xây dựng như một bản phát hành tập trung và trung thực: hội đồng có cấu trúc với thanh toán và auth thật, và một engine AI sẽ lắp vào đúng seam khi sẵn sàng. Quyết định vẫn thuộc về bạn — Zero Council chỉ giúp bạn nhìn mọi góc độ trước khi chốt.
