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

## Ngoài scope

- [ ] Giai đoạn 2: engine thật, provider, persistence, auth, deploy. Landing hiện mô tả hành vi chưa có code sau lưng.
- [ ] **Auth (đồng nghiệp)**: chỉ cần làm `authenticateFromSession` trong `web/src/lib/currentUser.ts`. Mọi thứ còn lại đã dựng sẵn quanh nó.
- [ ] Hạn mức 2/4/8 advisor vẫn là con số hiển thị, chưa có chỗ nào chặn.
- [ ] `.agent/skills/verify-app/` + `features/` + `FEATURE_MAP.md` (28.2, 32.2–32.4) — chưa sinh, mở task riêng.

---

# TODO — Deliberation loop (2026-09-27)

Worktree `.worktrees/deliberation-loop`; branch `deliberation-loop`; base `cb4bee8` (`origin/main`).
Yêu cầu lượt này (chủ dự án): nhìn được nhiều AI tranh luận với nhau; phương thức giao tiếp phải chọn được, không gói gọn một kiểu; data ảo trước, engine thật nối sau; không thiết kế lại layout.

## Cấp 1 — Seam engine

- [x] `web/src/lib/deliberation/plan.ts`: logic thuần, không phụ thuộc i18n — `clampScale`, `HAT_ORDER`, `MATRIX_*_IDS`, `MAX_WEIGHT`, `MAX_SCORE`, `planContributions`, `scoreMatrix`.
- [x] `web/src/lib/deliberation/engine.ts`: `runDeliberation` là **một** hàm duy nhất mà UI gọi; `buildFixtureRound` đồng bộ để seed session mà không await. `FIXTURE_DELAY_MS = 900`.
- [x] Engine trả **id** cho ma trận, UI map sang nhãn — giữ `plan.ts` test được bằng `node --test` không bundler.
- [x] Không thêm dependency. Runtime vẫn đúng 4: `next`, `react`, `react-dom`, `lucide-react`.

## Cấp 2 — Ba phương thức, người dùng chọn

- [x] `independent` (không tham chiếu chéo) / `debate` (`rebuts`) / `chain` (`buildsOn`) — phân biệt được **bằng dữ liệu**, không bằng tên.
- [x] Segmented control `role="group"` + `aria-pressed` trong `SessionActiveView`, khoá khi đang chờ.
- [x] Đổi giữa phiên: áp cho vòng sau, vòng cũ giữ nguyên phương thức đã chạy. Có dòng "Applies from the next round".
- [x] `vote` cố tình **không** làm: trùng Decision Matrix.

## Cấp 3 — Mặt phằng tranh luận

- [x] `RoundThread`: rail chọn vòng, câu hỏi, các đóng góp có badge tham chiếu chéo, phần Chair (đồng ý / bất đồng / đề xuất).
- [x] `FrameworkPanel`: dispatch theo `round.frameworkOutput.kind` → 3 nhánh kịch bản / 6 khối Six Thinking Hats / bảng ma trận có trọng số.
- [x] Ma trận: kéo weight chấm lại tổng ngay, đổi người dẫn đầu, weight 0 bị bỏ qua (không chia), tất cả tổng bằng 0 → `winnerId = null` thay vì bịa thắng.
- [x] `SessionConcludedView` đọc vòng cuối, dùng chung `FrameworkPanel`, thay 3 bản sao `ScenarioBranch` trước đó.
- [x] Bảngnghi ngôn ngữ ở cả `RoundThread` lẫn màn kết luận khi `round.language` khác ngôn ngữ đang xem.

## Cấp 4 — Bất biến lịch sử

- [x] Thêm bảngnghi `frameworkAppliesNext` khi `session.framework` khác `round.framework` — trước đó đổi framework **không hiện gì**, tưởng nút hỏng.
- [x] Weight ma trận là view state, `key={index-framework}` reset theo vòng/framework; vòng đã xong không bị viết đè.

## Cấp 5 — Kiểm chứng

- [x] `npx tsc --noEmit` → 0. `npx eslint` → 0, không warning. `npx next build` → 0.
- [x] `node --test tests/*.test.mjs` → **44/44** (28 cũ + 16 mới trong `tests/deliberation.test.mjs`).
- [x] Test mới khoá 3 hợp đồng: 3 mode phân biệt được bằng `JSON.stringify`; kéo một weight không kéo theo các khoản khác; "không có người thắng" là câu trả lời hợp lệ.
- [x] Test mới khoá parity i18n hai chiều + placeholder `{...}` khớp giữa en và vi.
- [x] App thật (`next start -p 8793`): mode switch đổi loại badge; vòng 2 tạo được còn vòng 1 xem lại được; Hats = 6 khối, Matrix = bảng có weight, Scenarios = 3 nhánh; Cancel dừng vòng đang chờ; chuyển VI không vỡ.

## Ngoài scope

- [ ] Engine thật: thay thân `runDeliberation`. Cần thêm `onContribution` để stream từng cố vấn thay vì chờ trọn vòng.

---

# TODO — Ổn định hoá engine (2026-10-04)

Yêu cầu: làm cho engine chắc và ổn định **trước khi** cấu hình API key. Khung + engine thôi, brain thêm sau.

## Phát hiện được khi đọc code

- [x] `else throw error` trong `runRound` biến mọi lỗi thành unhandled rejection — đúng cái sẽ xảy ra ngay khi có provider thật.
- [x] Chặn chạy song song dựa trên `isDeliberating` (state) — hai click cùng tick đều đọc `false`, tạo hai vòng **cùng số thứ tự**.
- [x] `startNewSession` không đụng `abortRef`: vòng đang chạy vẫn ghi vào phiên cũ và kéo `selectedRoundIndex` của phiên mới.
- [x] `createSession` không nhận `AbortSignal` → không hủy được, cùng `isDeliberating` dùng chung cho hai việc.
- [x] Không timeout: engine treo là spinner vĩnh viễn.
- [x] `engine.ts` import `@/prototype/i18n` nên `node --test` không chạy được — **contract không kiểm chứng được chỉ vì nó dính bản dịch**.

## Cấp 1 — Tách seam cho test được

- [x] `engine.ts` = hợp đồng thuần, không import gì ngoài `./plan.ts`. Dùng đuôi `.ts` tường minh vì ESM không đoán đuôi.
- [x] `fixture.ts` = câu trả lời cứng + `pacedProducer`. Nơi duy nhất cần bảng copy.
- [x] `createDeliberationEngine(produce, timeoutMs?)` — app gọi hàm đã bọc, không gọi producer.
- [x] `types.ts` re-export `Language` từ engine thay vì định nghĩa trùng.

## Cấp 2 — Bốn bảo đảm của contract

- [x] `requestProblems()` trả **danh sách** vấn đề, chặn trước khi làm việc — không bao giờ gọi provider với request hỏng.
- [x] Deadline gấp với signal của người dùng; producer treo thành `DeliberationError` chứ không phải spinner.
- [x] Kết quả tới **sau khi** hủy vẫn bị bỏ, không commit.
- [x] `onContribution` báo từng cố vấn theo thứ tự nói, ghế chủ tọa đi sau.

## Cấp 3 — Sửa ổn định ở Context

- [x] `busyRef` chặn chạy song song ngay lập tức, không đợi render.
- [x] `createSession` nhận `AbortSignal`; `startNewSession` hủy vòng cũ trước khi tạo phiên mới.
- [x] `runRound` bắt **mọi** lỗi, trả `boolean`, không rethrow.
- [x] Composer **giữ câu hỏi** khi vòng hỏng hoặc bị hủy; chỉ xoá khi vòng thật sự ghi vào.
- [x] `onContribution` nối vào `roundProgress`; pending panel hiện từng cố vấn đã trả lời.

## Cấp 4 — Kiểm chứng

- [x] `node --test` 54/54 (26 trong deliberation: 7 validation + 5 contract + 14 cũ).
- [x] Tìm ra 1 bug thật bằng test: signal đã abort **trước** khi gọi không được thừa nhận, vì listener forward gắn vào signal đã nổ rồi nên không bao giờ chạy. Không có test nào bắt được trước đó.
- [x] `tsc` 0 · `eslint` 0, không warning · `next build` 0.
- [x] App thật: streaming hiện đúng thứ tự (thinking → answered cho từng cố vấn, Chair sau cùng); bấm Run round hai lần cùng tick chỉ sinh **một** vòng; Cancel giữ nguyên câu hỏi trong ô; thành công thì ô được xoá.

## Chưa kiểm chứng

- [ ] Toast `toastRoundFailed` **chưa từng hiện** trên trình duyệt — fixture không bao giờ hỏng. Đường đi được unit test ở tầng engine, nhưng cái toast thì không.
- [ ] Deadline 30 giây không chạy thật trên trình duyệt (test dùng 20ms qua tham số).
- [ ] Tạo phiên đầu tiên vẫn không có pending panel — `EmptyChamberView` không đọc `isDeliberating`.
- [ ] Bảngnghi này viết sau khi đã lái app, không phải trước. `features/` + `FEATURE_MAP.md` (28.2) vẫn chưa sinh.
