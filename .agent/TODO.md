# TODO — Zero Council product voice (giai đoạn 2)

Cập nhật: 2026-09-26. Governance: v7.4. Worktree: `.worktrees/product-voice-ui`; branch: `product-voice-ui`; base `83ee993` (`origin/main` sau PR #9 merge).

Yêu cầu lượt này (chủ dự án): bỏ toàn bộ ngôn ngữ demo, đổi serif sang Literata, thu gọn glow hero còn 1 hào quang brass, xoá nút bật/tắt theme.

## Cấp 1 — Font

- [x] `web/src/app/fonts.ts`: Fraunces → Literata (subset `latin` + `vietnamese`, weight 500/600), Inter giữ nguyên.
- [x] `globals.css` `--font-serif` → `var(--font-literata), Georgia, "Times New Roman", serif`.
- [x] Xác minh dấu tiếng Việt: bề rộng `quyết định` / `phương án` / `ễ ậ ở ự` khác cả fallback-face lẫn Georgia → webfont thật sự vẽ glyph, không rơi về font dự phòng.

## Cấp 2 — Glow hero

- [x] Thêm đúng 1 `.glow` với `radial-gradient(circle, rgba(201,162,75,0.22) 0%, …0.06) 45%, …0) 70%)`.
- [x] `CouncilOrb` 4 node → 1 màu brass, phân cấp bằng opacity (1 / .78 / .56 / .34); bỏ `--node-color`.
- Ghi chú: mô tả "cyan/magenta + streak" của yêu cầu không khớp code — không có class `glow` hay màu cyan/magenta nào trong repo; màu đa sắc thật sự là 4 node persona của `CouncilOrb`. Đã xử lý theo ý định "chỉ còn 1 hào quang brass".

## Cấp 3 — Bỏ ngôn ngữ demo

- [x] Header: xoá dòng phụ dưới logo, xoá nút theme, nav → How it works / Why Zero Council / Pricing, CTA "Get started".
- [x] `AppContext` + `types.ts` + `SettingsView`: xoá hẳn `Theme`/`toggleTheme`, xoá khối Theme trong Settings.
- [x] Hero: tag / headline / body / 2 nút / card trust (shield, không lock) theo yêu cầu.
- [x] 3 card "How it works" + 3 card framework viết lại thành mô tả chức năng thật.
- [x] Xoá section "What this version does—and does not do" → thay bằng "Why Zero Council" 3 cột.
- [x] Footer → `© 2026 Zero Council.` + link Pricing/Privacy.
- [x] `PricingView` được render thật trong `App.tsx` (`pricing` thành public page).
- [x] Sweep toàn bộ `web/src`: không còn demo/prototype/illustrative/walkthrough/"not connected" trong text hiển thị.
- [x] `i18n.ts`: viết lại EN + VI (giữ parity), xoá key chết (`theme/light/dark`, `faq*`, `access*`, `available*`, `unavailable*`, `scope*`, `returnOverview`, `footerNote`, `fixture`), thêm key mới.

## Cấp 4 — Lỗi hydration

- [x] `<body suppressHydrationWarning>` tại `layout.tsx` — extension (Grammarly) chèn attribute vào `<body>`; app không tự sinh ra.

## Cấp 5 — Kiểm chứng

- [x] `pnpm --dir web exec tsc --noEmit` → exit 0.
- [x] `pnpm --dir web lint` → exit 0.
- [x] `pnpm --dir web build` → exit 0.
- [x] `node --test tests/budget.test.mjs` → exit 0.
- [x] Prod `next start -p 3202`: lái landing → Start free council → Get recommendation; console sạch, không attribute lạ trên `<body>`.
- [x] Quét DOM từng màn hình (landing / session / concluded / sessions / advisors / integrations / settings) bằng regex cấm → 0 hit (trừ nhãn BYOK "Not connected" và trang `/fixture` mang chữ "reference").
- [x] VI: title, `lang`, hero, 3 card Why Zero Council, footer đều dịch đúng.

## Cấp 6 — Hệ thống pricing (lượt 3, 2026-09-26)

- [x] `web/src/prototype/data/plans.ts` (mới): `PLANS` là nguồn giá duy nhất — `priceVnd` số nguyên + `priceUsd` chuỗi tĩnh + `maxActiveAdvisors`; `planPrice()` và `planAmountLine()` là 2 hàm format.
- [x] Free 0₫/$0 · 2; Pro 139.000₫/$5.99 · 4; Ultra 379.000₫/$16.99 · 8. "Advisor" = persona active cùng lúc, không phải số model.
- [x] Pricing: 3 card dùng `planPrice`; bỏ nhân đôi "/mo" + "per month".
- [x] Landing: thêm section `#pricing` teaser 3 card + nút mở Pricing.
- [x] Settings > Plan: 3 card, gói Free gắn nhãn "Current plan", link sang Billing history.
- [x] Billing history: view mới được route (`billing`), hiện gói hiện tại + link sang Pricing; danh sách hoá đơn vẫn rỗng vì chưa có billing backend.
- [x] Checkout (`CheckoutDrawer` từ stub `null` → dùng `Modal`): khối Amount luôn `₫139,000 (~$5.99)`, dòng EN-only "Charged in Vietnamese Đồng (VNĐ) via PayOS…", panel Discount code in giá gốc từ `planAmountLine`.
- [x] i18n EN + VI thêm 15 key pricing; parity giữ nguyên.
- [x] Sweep repo: 0 match `149.000|149000|149,000|299.000|299000|149k|299k|3 advisors|6 advisors|2/3/6`.
- [x] `tsc` / `lint` / `build` / `budget test` / `git diff --check` → exit 0.
- [x] Prod `-p 3205`: teaser/giá/Settings/Billing/checkout EN+VI đều đúng số; console sạch; không overflow.

## Cấp 7 — Git

- [x] Push 3 commit của lượt 3 (`git push -u origin product-voice-ui` → `PUSH=0`, `* [new branch]`).
- [x] Tạo PR vào `main` — **cần bạn duyệt** (chưa mở).
- [ ] Dừng mọi server tạm trước bàn giao.

## Cấp 8 — Thanh toán payOS end-to-end (lượt 4, 2026-09-26)

- [x] `web/src/lib/payos/signature.ts` — HMAC SHA256 theo chuẩn payOS, `timingSafeEqual`.
- [x] `web/src/lib/payos/env.ts` — đọc secret bằng key động. **Bắt buộc**: `process.env.PAYOS_*` literal bị Next inline lúc build thành `undefined` (đã gặp thật: webhook trả 503 vĩnh viễn).
- [x] `web/src/lib/payos/orders.ts` — order store file JSON, `PAID` là trạng thái kết thúc.
- [x] `web/src/lib/payos/discount.ts` — bảng mã từ `PAYLOS_DISCOUNT_CODES`; trống = từ chối mọi mã.
- [x] `POST /api/payos/create-payment` — amount lấy từ `plans.ts`; `POST /v2/payment-requests`; verify chữ ký response; trả `checkoutUrl`.
- [x] `POST /api/payos/webhook` — verify chữ ký + so số tiền với order đã lưu.
- [x] `GET /api/payos/orders/[orderCode]` — trạng thái cho trang quay lại.
- [x] `/checkout/return` — poll trạng thái, hiện paid / pending / cancelled, không tự mở khoá gì.
- [x] `CheckoutDrawer` nối nút "Thanh toán qua PayOS" + trạng thái lỗi.
- [x] `web/.env.example` + `.gitignore` cho `.zc-orders.json`.
- [x] `tests/payos.test.mjs` — 4/4 pass.
- [x] Sửa endpoint sai: `/v1/payment/create` trả 404; payOS hiện dùng `/v2/payment-requests`.
- [x] Sửa lỗi đọc `data.code` (nằm ở top-level, không nằm trong `data`) khiến mọi webhook rơi về PENDING.
- [x] Evidence thật trên prod build: 6 case webhook (401/409/404/400/200/PAID-then-stays-PAID), 5 case create-payment, drawer + return page trên trình duyệt.
- [ ] **Chủ dự án**: tạo tài khoản payOS, điền 3 biến môi trường, đăng ký webhook URL. Hướng dẫn trong `README.md` mục "Thanh toán (payOS)".
- [ ] Mua được hàng thật: chưa chạy được vì không có credential thật. payOS trả `214` (cổng không tồn tại) khi dùng key giả — chứng minh request đã tới đúng endpoint, chỉ thiếu tài khoản.

## Ngoài scope

- [ ] Giai đoạn 2: engine thật, provider, persistence, auth, deploy. Landing hiện mô tả hành vi chưa có code sau lưng.
- [ ] Subscription + entitlement: `PAID` hiện chỉ là trạng thái order, chưa gắn gói vào tài khoản nào (chưa có auth). Hạn mức 2/4/8 advisor vẫn là con số hiển thị.
- [ ] Order store file JSON không dùng được trên serverless / nhiều instance — nâng Postgres/Supabase khi cần.
- [ ] `.agent/skills/verify-app/` + `features/` + `FEATURE_MAP.md` (28.2, 32.2–32.4) — chưa sinh, mở task riêng.
