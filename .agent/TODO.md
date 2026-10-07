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
- [x] `web/src/lib/serverEnv.ts` — đọc secret bằng key động. **Bắt buộc**: `process.env.PAYOS_*` literal bị Next inline lúc build thành `undefined` (đã gặp thật: webhook trả 503 vĩnh viễn). Tách khỏi `payos/` vì Supabase cũng dùng.
- [x] `web/src/lib/payos/orders.ts` — order store Postgres (Supabase) qua PostgREST; `PAID` là trạng thái kết thúc.
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

## Cấp 9 — Order store lên Supabase + chuẩn bị xoá project local (lượt 7, 2026-09-27)

Yêu cầu: khi xoá sạch folder ở máy, app + secret vẫn phải chạy. Deploy + auth + tạo project
Supabase là của đồng nghiệp, không thuộc phạm vi task này.

- [x] `web/supabase/migrations/0001_zc_orders.sql` — hợp đồng bảng `public.zc_orders`. Nằm trong repo để review được, không nằm trong máy ai. DDL **không** chạy được qua PostgREST, phải qua CLI / SQL Editor / Management API.
- [x] `orders.ts` chuyển sang Postgres qua PostgREST bằng `fetch` — **không thêm dependency** (vẫn 4 gói runtime).
- [x] `PAID` là kết thúc nằm **trong chính câu lệnh ghi** (`status.neq.PAID`), không chỉ ở caller.
- [x] Host có đĩa tạm (Vercel) mà thiếu DB thì **fail loudly**, không rơi về file. Guard dùng `VERCEL=1` chứ không dùng `NODE_ENV` — `next start` cũng là production build và là cách verify local, dùng `NODE_ENV` sẽ chặn nhầm.
- [x] Fallback file JSON chỉ để chạy local trước khi có Supabase.
- [x] `tests/order-store.test.mjs` — 7/7 pass với stub PostgREST (URL, method, mapping 2 chiều, PAID terminal, lỗi schema, guard đĩa tạm, fallback local).
- [x] `.env.example` ghi rõ `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` và chỗ đặt secret ở host.
- [x] Evidence thật trên `next start -p 3200`: create-payment 503 khi thiếu env, order không tồn tại 404, đọc đơn gieo sẵn 200 rồi 404 sau khi xoá file.
- [ ] **Đồng nghiệp**: apply `web/supabase/migrations/0001_zc_orders.sql` lên project Supabase.
- [ ] **Đồng nghiệp**: đặt `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` trong Vercel env.
- [ ] **Chưa verify**: nhánh PostgREST mới chỉ chạy với stub, chưa chạy với Supabase thật. Phải test lại sau khi project tồn tại.
- [ ] **Chưa chạm**: `SUPABASE_ACCESS_TOKEN` (`sbp_`) để apply migration không tự động, vì tạo gì đó trong project của người khác cần đồng nghiệp tự chạy.

## Coupon + subscription + trang admin

- [x] Migration `0002_zc_coupons.sql`: `zc_users` (role), `zc_coupons`, `zc_coupon_redemptions` (khóa chính `(coupon_code, user_email)`), `zc_grants`; `ALTER zc_orders` thêm `user_email` / `coupon_code` / `coupon_percent`.
- [x] `currentUser.ts` — **hợp đồng auth là 1 hàm**. `authenticateFromSession` để trống cho đồng nghiệp. `ZC_DEV_LOGIN_EMAIL` chỉ chạy local, **từ chối cứng** khi `VERCEL=1`.
- [x] `lib/store/account.ts` — PostgREST + fallback file, 4 bảng, không thêm dependency.
- [x] `lib/coupons.ts` — coupon **chỉ giảm %**, áp dụng cho **một lần mua**, không cấp gói.
- [x] Coupon 100% **không gọi payOS**: ghi đơn PAID + redemption + grant 1 tháng ngay trong hàm.
- [x] Coupon < 100%: **không tiêu mã lúc checkout**, chờ webhook xác nhận rồi mới tiêu + cấp quyền. Bỏ checkout không mất lượt dùng.
- [x] Hạn dùng **tính lúc đọc**, không cron. Grant mới **cộng dồn** (`starts_at = max(now, expires_at hiện tại)`), mua sớm không mất ngày.
- [x] `addMonth` kẹp ngày theo cuối tháng ngắn (31/01 → 28/02), không tràn sang tháng 3.
- [x] API admin: CRUD coupon + đổi role, chặn server-side qua `adminOnly()`.
- [x] Chặn bỏ admin cuối cùng (`LAST_ADMIN`) — không có đường quay lại.
- [x] Trang `/admin`: CRUD + đổi role + **poll 5s** để các admin thấy nhau. Song ngữ en/vi.
- [x] `web/scripts/promote.mjs` — đường local tương đương câu SQL seed admin đầu tiên.
- [x] Test: `tests/coupon-store.test.mjs` 9/9; toàn bộ 28/28.
- [x] Evidence app thật (`next start -p 3200`): 18/20 kịch bản, 2 fail là **kỳ vọng test sai**, đã verify riêng (xem HANDOFF).
- [x] `.gitignore` chặn `.zc-account.json` — file store chứa email thật, gần như lọt vào commit.

## Cấp 10 — Phòng hội đồng: loop A2A bằng `@` (2026-10-05)

Yêu cầu: luồng chat nhiều bot — popup chọn bot + cơ chế, chat như messenger, mỗi AI một card,
trao lượt bằng `@`, bot được mention đọc toàn bộ lịch sử rồi đi tiếp, vòng lặp đến khi user kêu dừng.

**Quyết định lượt này (chủ dự án trả lời 2026-10-05):**

| Câu hỏi | Chốt |
|---|---|
| Engine AI | **Loop + UI với generator script trước**, xác minh workflow chạy đúng; BYOK thêm sau, thay đúng 1 export |
| Auth | Gate local bằng `ZC_DEV_LOGIN_EMAIL` (đã có sẵn trong `currentUser.ts`) |
| Trần loop | **3 lượt serial** như Hermes |
| Mode "tổng hợp" | Cả nhóm trả lời nối tiếp rồi bot cuối tổng hợp |

- [x] `web/src/prototype/chat/engine.ts` — routing thuần: `parseMentions` (alias bỏ dấu, mention nhiều từ, tên lạ → không resolve), `planSpeakers` (round-robin / panel), `runTurn` (queue động, handoff `@`, hard cap), `isStopDirective` (`stop @bot` giữ bot; giữa câu là prose).
- [x] `web/src/prototype/chat/scripted.ts` — `scriptedGenerator` sinh `@handoff`/`@user` giả định; **đây là điểm duy nhất BYOK sẽ thay**.
- [x] `tests/chat-engine.test.mjs` — 13/13 pass thật.
- [x] `JoinRoomModal.tsx` — chọn bot (cap theo plan) + chọn mode.
- [x] `ChatRoomView.tsx` — messenger UI, 1 bot = 1 card, composer Enter gửi / Shift+Enter xuống dòng.
- [x] Chặn cap 2/4/8 ở `addPersona` + disable nút ở `PersonasView` (đóng lỗ hổng TODO mục "Ngoài scope").
- [x] `tsc --noEmit` exit 0, `eslint` exit 0.
- [~] ~~`next build` CHƯA chạy~~ → **đã chạy exit 0** ở Cấp 11.
- [~] ~~Chưa lái app thật trên browser~~ → **đã lái, `ALL_CHECKS_PASS`** ở Cấp 11b.
- [~] ~~13/13 pass thật~~ → bộ test này đã **bị viết lại** ở Cấp 11. Nó assert *parser*, tức là
  chứng minh regex trên prose hoạt động — đúng thứ **không** nên làm. Số liệu cũ không còn ý nghĩa.

## Cấp 11 — Engine viết lại: A2A có cấu trúc, không regex trên văn bản (2026-10-07)

Yêu cầu: "A2A phải thực sự hoạt động giống như Hermes bots mode. Engine là fondation."

**Vấn đề gốc:** bản trước đọc `@name` trong prose của bot để trao lượt. Sai ở tầng kiến trúc —
regex không phân biệt được *nhắc* với *trích dẫn*, không đảm bảo tên luôn resolve, và model
quên quy ước thì rơi về fallback im lặng. Hermes dùng `message_agent(target=...)`: tool call có cấu trúc.

- [x] `engine.ts` — `BotTurn { text, handoffs, silent? }`, `BotGenerator` trả `BotTurn`. Routing đọc `handoffs`, **không** đọc prose. `WhyStop` đủ 5 nhánh: `user | silent | max-turns | budget | failed`. `TurnFailure` có kind `silent|timeout|transient|fatal`; chỉ `transient` retry đúng 1 lần.
- [x] Queue động: handoff kéo được cố vấn **không có trong vòng đã lên lịch**, nhưng không được nhảy lên đầu hàng đã xếp.
- [x] `buildContext`: 200 tin / 32k ký tự / excerpt 8k. Sửa bug tin quá lớn bị **âm thầm rớt** (check ngân sách chạy trước check kích thước → `continue` thay `break`).
- [x] Ngồi yên đúng nghĩa: chỉ `silent` khi hàng cạn mà **không ai nói** (`produced === 0`). Bản cũ cắt sau 2/3 cố vấn.
- [x] `scripted.ts` trả `BotTurn`. Đây là **điểm duy nhất** BYOK sẽ thay — engine không đổi.
- [x] `AppContext.sendMessage` — `stoppedBy: WhyStop | null`, `failures: TurnFailure[]`, `turns` cộng dồn (trước reset mỗi lượt).
- [x] `ChatRoomView` hiện 5 lý do dừng, mỗi cái một câu riêng; thêm 3 khoá copy EN + VI.

**Bug tìm ra khi lái app thật (rule 19), không lộ ra qua test:**

- [x] `stop @bot` vẫn chạy thành một lượt. Vì advisor vừa bị hold nên không còn trong roster, mention không resolve → `speakers = []` → phòng báo "No advisor answered" cho một tin **không phải câu hỏi**. Đã sửa: `stop` là lệnh thuần, không chạy vòng.
- [x] Nhận diện directive phải dùng **roster đầy đủ**, không dùng roster đã lọc — advisor cần bị dừng thì đương nhiên không có trong roster rút gọn.
- [x] `@all` **phải** chạy một vòng (user đang bảo hội đồng tiếp tục; im lặng mới là lỗi). Chỉ `stop` mới không chạy.
- [x] Ràng buộc trần: `DEFAULT_MAX_TURNS = 12`, `DEFAULT_ROOM_BUDGET = 200`. **Chưa chốt với chủ dự án** — yêu cầu gốc là "vòng lặp vô tận", đang dùng trần để chặn chi phí.

## Cấp 11b — Kiểm chứng thật (2026-10-07)

- [x] `tests/chat-engine.test.mjs` — **25/25**. Assert **hành vi** (ai được trao lượt, khi nào vòng dừng, xử lý generator lỗi), không assert parser. Có test *"prose alone never routes"* chắc chắn thất bại dưới thiết kế cũ.
- [x] `tests/drive-council.mjs` (mới) — lái Chrome thật qua CDP, **không thêm dependency** (Node 24 có `WebSocket` + `fetch` sẵn). `agent-browser` chưa cài; cài global là đụng máy nên không tự ý làm.
- [x] `next build` → exit 0, `BUILD_ID` mới.
- [x] **Lái app thật: `ALL_CHECKS_PASS`** trên `next start -p 3230`. Screenshot + JSON ở `.agent/evidence/`.

| Tình huống | Kết quả thật |
|---|---|
| Gửi câu hỏi không mention | Pragmatist mở lượt → `@The Dreamer` → Dreamer trả lời → `@user` |
| `@The Dreamer ...` | Dreamer mở lượt, Pragmatist **không** mở |
| `stop @The Pragmatist` | Không cố vấn nào nói, **không** báo "nobody answered" |
| `@all carry on` | Pragmatist quay lại, mở lượt, handoff tiếp |

- [x] `tsc --noEmit` exit 0 · `eslint src` exit 0.
- [x] Xoá scratch `.zc-*`.

## Cấp 12 — BYOK: nối model thật vào seam (2026-10-07)

Chủ dự án chốt: **Anthropic + OpenAI**, key gửi **thẳng từ trình duyệt** ra provider, không qua server ta.

- [x] `chat/byok.ts` (mới): adapter Anthropic + OpenAI. Không SDK — `fetch` đủ cho cả hai wire format.
- [x] Tool `message_agent(target)` — **trùng tên và shape với Hermes**. Đây là điểm nối với bản tham chiếu, không phải chi tiết tuỳ chọn.
- [x] Key nằm trong RAM của tab, **không** storage, **không** server. Đổi lại: F5 là mất key.
- [x] Phòng là **hỗn hợp provider**: mỗi cố vấn gọi đúng vendor của nó. Cố vấn không có key thì rơi về scripted, không làm hỏng vòng.
- [x] Xoá `Model label A/B/C` + `Provider label A/B/C` → id thật (`claude-sonnet-4-5`, `gpt-4o`, `gpt-4o-mini`, `anthropic`, `openai`). Xoá 6 khoá i18n chết.
- [x] Tên vendor/model là proper noun nên **không dịch** — xoá luôn lớp `modelLabel(x, language)` / `providerLabel(x, language)`.

**Một quyết định thiết kế đáng ghi:** tool call **có mặt nhưng không đọc được** ≠ *không có tool call*.
Nếu gộp hai thứ, JSON hỏng sẽ bị đọc thành "cố vấn không trao lượt" và phòng treo im lặng. Vì vậy adapter trả
thêm cờ `attempted`; chỉ khi có tool call mà không resolve được tên thì mới đóng vòng về `user`.

**Một thiếu sót trong prompt:** nhánh "không closing" ban đầu không hề nhắc `user` là một target hợp lệ.
Cố vấn hết ý sẽ chọn bạn ngẫu nhiên thay vì trả câu hỏi về cho người, và vòng kéo dài. Đã sửa.

## Cấp 12b — Kiểm chứng (2026-10-07)

- [x] `tests/byok.test.mjs` — **9 test**, stub `fetch`: tool_use → `handoffs`, tool_call JSON → `handoffs`, arguments hỏng → mất handoff **nhưng giữ câu trả lời**, `[SILENT]` → pass, prose có `@name` → **không** route, lỗi HTTP → throw kèm status.
- [x] `tsc --noEmit` 0 · `eslint src` 0 · `next build` 0 · **34/34** test.
- [x] `tests/drive-keys.mjs` (mới) — lái Chrome thật, **14/14 pass**. Bằng chứng `.agent/evidence/council-keys.png`.

Check quan trọng nhất của driver này: **nối key sai rồi bắt cố vấn trả lời.** Kết quả thật:

```
YOU What should we ship first?
An advisor stopped working (fatal). The rest of the council is still here.
```

Không có câu scripted nào lọt. Nếu lọt, nghĩa là key bị bỏ qua và hội đồng **bịa** cố vấn — tệ hơn nhiều so với báo lỗi.

**Bug tôi tự gây ra rồi bắt được:** driver đầu tiên reload trang giữa chừng, mà reload **xoá key trong RAM**, nên phòng rơi về scripted và driver vẫn báo PASS. Check `From my lens` bị lừa. Đã sửa thứ tự: vào phòng → nối key → quay lại phòng bằng điều hướng trong app, không reload.

## Ngoài scope

- [ ] Giai đoạn 2: engine thật, provider, persistence, auth, deploy. Landing hiện mô tả hành vi chưa có code sau lưng.
- [ ] **Auth (đồng nghiệp)**: chỉ cần làm `authenticateFromSession` trong `web/src/lib/currentUser.ts`. Mọi thứ còn lại đã dựng sẵn quanh nó.
- [ ] Hạn mức 2/4/8 advisor: **đã chặn thật** ở `JoinRoomModal` + `PersonasView` + `joinRoom` (xác nhận trong browser: "2 of 2 selected").
- [ ] `.agent/skills/verify-app/` + `features/` + `FEATURE_MAP.md` (28.2, 32.2–32.4) — chưa sinh, mở task riêng.
- [ ] Persistence: phòng chỉ sống trong React, F5 là mất. Hermes có memory riêng từng thành viên + `/compress` — chưa làm.

## Cần bạn nhìn kỹ (rule 31.3)

- **Chưa từng gọi provider thật.** Toàn bộ bằng chứng dùng key giả và HTTP stub. Chứng minh *đường nối và ánh xạ* đúng; **không** chứng minh Anthropic/OpenAI nhận request và trả tool call. Muốn chắc thì cần một key thật chạy một vòng.
- **Key không lưu, mất khi F5.** Đây là cái giá của việc không cho server chạm vào key. Nếu muốn nhớ key thì phải chọn hoặc mã hoá phía client, hoặc để server giữ — hai đều đổi lại thứ đang được bán.
- **Trần vòng lặp chưa chốt.** Spec gốc "vòng lặp vô tận", chủ dự án từng chốt 3 lượt. Đang `12` + trần phòng `200`. Muốn vô tận thật thì phải chặn bằng **ngân sách tiền**.
- **Landing vẫn hứa** BYOK AES-256, hội thoại mã hoá. Giờ có key chạy thật, nhưng **không có mã hoá nào** và key sống trong RAM. `currentUser.ts` trả `null`, `SignInView` còn rỗng.
