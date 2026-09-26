# HANDOFF — Zero Council product voice, Literata, brass-only hero

Cập nhật: 2026-09-26. Governance: v7.4. Worktree `vi-font-fix` và các worktree khác không đụng tới; handoff cũ của `vi-font-fix` giữ nguyên lịch sử ở commit trước.

## Git và phạm vi

- Worktree: `C:\Users\nguye\OneDrive\Documents\Projects\Zero-Council\.worktrees\product-voice-ui`
- Branch: `product-voice-ui`
- Base: `83ee993` (`origin/main` sau PR #9 merge)
- Remote: `https://github.com/CThawngs/Zero-Council.git`
- **Đã push** `product-voice-ui` (4 commit: `ce05457`, `c2f0dc4`, `2234875`, `8d951f8`). **PR chưa mở** — chờ chủ dự án duyệt.

## Đã làm

1. Font: `Fraunces` → `Literata` (`web/src/app/fonts.ts`, weight 500/600, subset `latin` + `vietnamese`), Inter giữ nguyên; `globals.css` đổi `--font-serif` và bỏ fallback chain cũ.
2. Hero glow: thêm đúng một `.glow` brass theo spec; `CouncilOrb` 4 node chuyển sang cùng hue brass, phân cấp bằng opacity; bỏ `--node-color`.
3. Theme toggle: xoá hẳn khỏi `Header`, `SettingsView`, `AppContext` (`Theme`/`toggleTheme`), `types.ts`, và bỏ khối palette `html.light` trong `globals.css`.
4. Copy: viết lại toàn bộ EN + VI trong `i18n.ts`; xoá key chết; header không còn dòng phụ dưới logo; nav public = How it works / Why Zero Council / Pricing; hero, 3 card How-it-works, 3 card framework, section mới "Why Zero Council" (thay cho access map), footer `© 2026 Zero Council.`
5. `PricingView` được render thật (`App.tsx`, view `pricing` là public page).
6. Hydration mismatch: `<body suppressHydrationWarning>` tại `layout.tsx` — do extension (Grammarly) chèn `data-gr-ext-installed` / `cz-shortcut-listen` vào `<body>`, không phải code app.
7. `/fixture` + `council-fixture.ts` chuyển từ "illustrative" sang "reference".
8. **Hệ thống pricing** (lượt 3, giá chủ dự án chốt 2026-09-26): `data/plans.ts` là nguồn giá duy nhất; 6 màn hiển thị giá đọc từ đó; checkout luôn nêu VNĐ là số thật.
9. **Thanh toán payOS end-to-end** (lượt 4): 3 route server (`create-payment`, `webhook`, `orders/[orderCode]`), trang `/checkout/return`, nút "Thanh toán qua PayOS" trong drawer, bảng mã giảm giá server-side, `.env.example`, 4 test HMAC.

## Evidence (trên working tree này, chưa commit lúc ghi)

Tất cả lệnh chạy tại `web/`, budget test ở root.

### Static

- `pnpm --dir web exec tsc --noEmit` — exit `0`.
- `pnpm --dir web lint` — exit `0`.
- `pnpm --dir web build` — exit `0`.
- `node --test tests/budget.test.mjs` — exit `0`.

### Browser QA (prod build, `next start -p 3202`)

- Landing: nav đúng 3 mục, logo không dòng phụ, không có nút theme, hero tag/headline/body/2 nút đúng spec, card trust dùng `ShieldCheck` với câu "Your conversations are encrypted and visible only to you."
- Computed `h1` = `Literata, "Literata Fallback", Georgia, "Times New Roman", serif`; `document.fonts` = `Literata 500 loaded`, `Inter 400/500/600 loaded`.
- Font VI: `measureText` trên canvas cho `quyết định` (210.14) / `phương án` (210.62) / `ễ ậ ở ự` (121.60) khác fallback-face (200.83 / 201.55 / 128.00) và khác Georgia → glyph do webfont vẽ, không rơi fallback từng ký tự.
- Glow: `getComputedStyle(.glow).backgroundImage` = đúng chuỗi radial-gradient trong spec.
- Orb nodes: cả 4 = `rgb(201, 162, 75)`, opacity `1 / 0.78 / 0.56 / 0.34`.
- Flow: Start free council → nhập câu hỏi → Get recommendation; màn kết luận hiện "Council recommendation / Recommendation / Review conditions / Next step", không trùng nhãn.
- Quét DOM từng view (landing, session-active, session-concluded, sessions, advisors, integrations, settings) bằng regex `demo|sample|prototype|fixture|illustrative|walkthrough|not connected|local only` → 0 hit, trừ nhãn trạng thái BYOK "Not connected".
- VI: `document.title` = `Zero Council — Hội đồng quyết định AI`, `lang="vi"`, hero + 3 card Why Zero Council + footer dịch đúng.
- Console: không message nào.
- `<body>` không có attribute lạ (chỉ `class`).

### Pricing (prod `-p 3205`)

- EN landing teaser: `Free $0/mo · Up to 2`, `Pro $5.99/mo · Up to 4`, `Ultra $16.99/mo · Up to 8`.
- Pricing 3 card EN: `$0/mo` / `$5.99/mo` / `$16.99/mo`; VI: `0₫/tháng` / `139.000₫/tháng` / `379.000₫/tháng`.
- Checkout EN: Amount = `₫139,000 (~$5.99)`; dòng "Charged in Vietnamese Đồng (VNĐ) via PayOS. USD shown for reference only." **có**; Discount "Base price before any code: ₫139,000 (~$5.99)".
- Checkout VI: Amount = `₫139,000 (~$5.99)`, dòng USD **không** hiện; Discount "Giá gốc trước khi áp mã: ₫139,000 (~$5.99)".
- Checkout Free = `₫0 (~$0)`, Ultra = `₫379,000 (~$16.99)`.
- Settings > Plan EN: `Free · Current plan · $0/mo`, `Pro $5.99/mo`, `Ultra $16.99/mo`.
- Billing history EN `Free $0/mo`; VI `Free 0₫/tháng`; danh sách hoá đơn rỗng (chưa có billing backend).
- Console sạch; `scrollWidth == clientWidth` (không overflow).
- Sweep repo: 0 match `149.000|149000|149,000|299.000|299000|149k|299k|3 advisors|6 advisors|2/3/6`.

### Thanh toán payOS (prod `-p 3210` → `-p 3212`, credential giả)

- `node --test tests/payos.test.mjs` — 4 pass / 0 fail. Payload sort đúng thứ tự alphabet, bỏ giá trị rỗng; chữ ký 64 hex; đổi 1 field là vỡ chữ ký; chữ ký rác / thiếu / cắt cụt đều `false` chứ không throw; bảng mã rỗng thì từ chối mọi mã, entry rác bị bỏ qua.
- `create-payment` (curl, thân JSON viết ra file vì PowerShell nuốt dấu nháy):
  - `{"planId":"free"}` → `400 FREE_PLAN_NOT_BILLABLE`
  - `{"planId":"enterprise"}` → `400 UNKNOWN_PLAN`
  - `{"planId":"pro","code":"FAKE"}` → `400 UNKNOWN_DISCOUNT_CODE`
  - `{"planId":"pro","code":"welcome"}` → `502 PAYLOS_REJECTED`
  - `{"planId":"ultra"}` → `502 PAYOS_REJECTED`
  - Server log: `create-payment rejected: HTTP 200 code=214 body={"code":"214","desc":"Cổng thanh toán không tồn tại hoặc đã tạm dừng…"}` → request đã tới đúng endpoint payOS v2, chỉ thiếu cổng thật.
- `webhook` (ký bằng chính `signature.ts` của repo, secret `test-checksum-key`):
  - không có signature → `401 invalid signature`
  - signature ký trên amount khác → `401`
  - amount bị đổi (1000 vs 139000) → `409 amount mismatch`
  - orderCode lạ → `404 unknown order`
  - `code: "99"` → `400 unknown code`
  - hợp lệ → `200 {"ok":true}`, store chuyển `PENDING` → `PAID` kèm `paidAt` + `reference` + `bankAccount`
  - webhook `01` (failed) đến sau → `200` nhưng order **vẫn `PAID`**
- Trình duyệt (prod build, port 3212): Pricing → Choose Pro → drawer hiện `AMOUNT ₫139,000 (~$5.99)` + dòng EN-only PayOS + nút "Pay with PayOS". Bấm nút → hiện lỗi, **không** rời trang (đúng hành vi khi chưa cấu hình).
- `/checkout/return?orderCode=…` cho order `PAID` → heading `Đã nhận thanh toán`, số tiền `₫129,000 (~$5.99)`.

### Ba lỗi thật đã bắt được (đáng đọc)

1. **`process.env.PAYOS_CHECKSUM_KEY` bị Next inline lúc build** → biến thành `undefined` → webhook trả `503 not configured` mãi mãi. Sửa bằng cách đọc dynamic qua `payosEnv(key)`. Đây là loại lỗi im lặng: test type và lint đều xanh.
2. **Endpoint sai**: `/v1/payment/create` (docs cũ) trả `404 Endpoint not found`. payOS hiện dùng `POST /v2/payment-requests`. Chỉ phát hiện được vì log đã in HTTP status + body thay vì chỉ `code`/`desc`.
3. **`data.code` không tồn tại**: payOS đặt `code` ở top-level envelope, không phải trong `data`. Đọc sai → mọi webhook rơi về `PENDING`, kể cả thanh toán thật. Test bắt được vì trang quay lại báo trung thực `PENDING` thay vì `PAID` giả.

## OPEN

1. **Chưa mua được hàng thật.** Toàn bộ đường đi đã kiểm chứng bằng credential giả; payOS từ chối ở tầng cổng thanh toán (`214`). Cần tài khoản + 3 biến môi trường + webhook URL public của chủ dự án. Hướng dẫn: `README.md` → "Thanh toán (payOS)".
2. **`PAID` chưa cấp quyền gì cho tài khoản** vì chưa có auth. Người mua thấy "Đã nhận thanh toán" nhưng chưa có gói nào mở. Phải xử lý trước khi bán thật.
3. **Order store là một file JSON** (`ponytail:`): một tiến trình Node + ổ đĩa bền. Hỏng trên serverless, trên nhiều instance, và race khi ghi đồng thời.
4. **Claim vượt code** — landing copy giờ mô tả AI advisors, AES-256 BYOK, mã hoá hội thoại, "Start free council". Repo **không có** engine AI, không có provider call, không có auth, không có persistence, không có mã hoá nào. Đây là quyết định của chủ dự án theo yêu cầu bỏ ngôn ngữ demo; nếu muốn thu hồi thì chỉ sửa `i18n.ts`.
5. Mô tả "cyan/magenta + streak lines" trong yêu cầu không khớp code: không có class `glow` hay màu cyan/magenta nào trong repo trước khi sửa; nguồn màu đa sắc là 4 node persona của `CouncilOrb`. Đã hiện thực hoá theo ý định "chỉ còn 1 hào quang brass".
6. Tỷ giá USD là chuỗi tĩnh trong `plans.ts`, **không phải** hằng số env. Khi cần đổi, sửa `plans.ts` (rule 28.3: giá lấy từ nguồn chân lý do chủ dự án cung cấp).
7. Mã giảm giá chưa có giá trị nào được duyệt — bảng đọc từ `PAYLOS_DISCOUNT_CODES`, để trống là từ chối mọi mã.
8. `.agent/skills/verify-app/`, `features/`, `FEATURE_MAP.md` (rule 28.2/32) — chưa sinh, mở task riêng.

## Bàn giao

1. ~~Sửa code + docs~~ — xong.
2. ~~Commit trên `product-voice-ui`~~ — xong, đã push.
3. Push + PR vào `main` — **cần chủ dự án duyệt** (commit thanh toán chưa push).
4. Chủ dự án làm phần PayOS: tài khoản, credential, webhook URL — theo hướng dẫn trong `README.md`.
5. Dừng server tạm trước khi kết thúc.
