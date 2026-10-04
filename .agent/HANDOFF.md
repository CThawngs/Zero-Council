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
2. Hero glow: thêm đúng một `.glow` brass theo spec. ~~`CouncilOrb` 4 node chuyển sang cùng hue brass, phân cấp bằng opacity; bỏ `--node-color`~~ — **đã hoàn tác lượt 7**, xem mục 10.
3. Theme toggle: xoá hẳn khỏi `Header`, `SettingsView`, `AppContext` (`Theme`/`toggleTheme`), `types.ts`, và bỏ khối palette `html.light` trong `globals.css`.
4. Copy: viết lại toàn bộ EN + VI trong `i18n.ts`; xoá key chết; header không còn dòng phụ dưới logo; nav public = How it works / Why Zero Council / Pricing; hero, 3 card How-it-works, 3 card framework, section mới "Why Zero Council" (thay cho access map), footer `© 2026 Zero Council.`
5. `PricingView` được render thật (`App.tsx`, view `pricing` là public page).
6. Hydration mismatch: `<body suppressHydrationWarning>` tại `layout.tsx` — do extension (Grammarly) chèn `data-gr-ext-installed` / `cz-shortcut-listen` vào `<body>`, không phải code app.
7. `/fixture` + `council-fixture.ts` chuyển từ "illustrative" sang "reference".
8. **Hệ thống pricing** (lượt 3, giá chủ dự án chốt 2026-09-26): `data/plans.ts` là nguồn giá duy nhất; 6 màn hiển thị giá đọc từ đó; checkout luôn nêu VNĐ là số thật.
9. **Thanh toán payOS end-to-end** (lượt 4): 3 route server (`create-payment`, `webhook`, `orders/[orderCode]`), trang `/checkout/return`, nút "Thanh toán qua PayOS" trong drawer, bảng mã giảm giá server-side, `.env.example`, 4 test HMAC.
10. **Logo header + khôi phục màu persona** (lượt 7): dùng lại `CouncilOrb` ở kích thước mark 24px trong header; 4 node màu persona quay lại sau khi lượt 2 đã xoá nhầm.
11. **Sửa bug chuyển view không về đầu trang** (lượt 7): `navigate()` thiếu `window.scrollTo(0, 0)`.
12. **Order store lên Supabase** (lượt 7): migration `public.zc_orders`, `orders.ts` đọc/ghi qua PostgREST bằng `fetch`, `serverEnv` tách khỏi `payos/`, 7 test với stub PostgREST.
13. **Workflow `sync-vercel-env.yml`** (lượt 7): bấm tay trong GitHub Actions để đẩy 5 secret sang Vercel — dành cho người không có quyền vào Vercel dashboard. Deploy vẫn tự động bằng push.

## Evidence (lượt 7, đã commit 7f39fbe)

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

## Coupon + subscription + admin (lượt 9)

**Đồng nghiệp làm phần này.** Toàn bộ việc còn lại đã dựng xong quanh hợp đồng `currentUser()`, nên khi auth có mặt chỉ cần điền đúng một chỗ.

**Quyết định đã chốt (theo trả lời của bạn):**

| Câu hỏi | Chốt |
|---|---|
| Coupon giảm gì | **chỉ %**, áp dụng cho **một lần mua**, không cấp gói |
| Thời hạn | **1 tháng**, khớp bảng giá `plans.ts`. Không bịa giá 2/3 tháng |
| Hạn dùng | **tính lúc đọc**, không cron |
| Ai xem trang admin | tài khoản có `role='admin'`. Admin là **thẻ vai trò**, nên nhiều người cùng làm |
| Admin đầu tiên | **SQL seed thủ công** trong migration. Không có đường tự phong admin |
| Trang admin đồng bộ | **poll 5s** |

**Hai ô trong ảnh:** `expires_at` (null = không bao giờ hết hạn) và `max_total_redemptions` (null = không giới hạn). Trang admin đặt tên là "Never expires" và "Unlimited" cho đúng hai giá trị null đó.

**Điều quan trọng nhất:** `zc_coupon_redemptions` có khóa chính `(coupon_code, user_email)`. "Một mã, một lần mỗi tài khoản" do **database** chặn, không phải bằng đọc-rồi-ghi (đọc-rồi-ghi thì hai lần đổi mã chạy song song đều lọt).

**Coupon 100% không đi qua payOS** — payOS thu phí mỗi giao dịch và không biết "0 đồng" nghĩa là gì. Giao dịch này chốt ngay trong hệ thống: ghi đơn PAID, ghi redemption, cấp 1 tháng. Coupon dưới 100% thì **chưa** tiêu mã lúc checkout — chờ webhook xác nhận mới tiêu, nên bỏ checkout không mất lượt dùng.

## Evidence (lượt 9)

Chạy thật trên `next start -p 3200`, HTTP thật, 20 kịch bản:

```
18/20 pass
```

**2 fail là kỳ vọng của tôi trong test sai, không phải bug.** Đã verify riêng từng cái:

- `ALREADY_USED` trả **400** chứ không phải 409 — vì `checkCoupon` chặn trước; 409 là nhánh *thua race* giữa check và redeem. File store xác nhận đúng **1** redemption `FULLFREE`. Cả hai đường đều chặn đúng.
- `LAST_ADMIN` không nổ vì lúc đó còn **2** admin nên hạ 1 cái là hợp lệ. Chạy lại: hạ admin cuối → **409 LAST_ADMIN**, admin API vẫn truy cập được, phong lại → 200.

Cổng chất lượng: test **28/28** (budget 2 · payos 5 · order-store 7 · sync 5 · coupon-store 9), `TSC=0`, `LINT=0`, `BUILD=0`.

Test lộ ra một điều: `effectivePlan` đọc đồng hồ hệ thống bên trong hàm, không có tham số `now`. Test phải đóng băng `Date` toàn cục — và `new Date()` **không** đi qua `Date.now`, nên bịt `Date.now` một mình là test rỗng.

## OPEN

1. **Chưa mua được hàng thật.** Toàn bộ đường đi đã kiểm chứng bằng credential giả; payOS từ chối ở tầng cổng thanh toán (`214`). Cần tài khoản + 3 biến môi trường + webhook URL public của chủ dự án. Hướng dẫn: `README.md` → "Thanh toán (payOS)".
2. **Webhook → PAID vẫn chưa từng quan sát được.** Cần URL public của Vercel. 2 link payOS thật đã tạo trong lúc test, đều **chưa trả tiền**.
3. **Nhánh PostgREST chưa từng chạy với Supabase thật.** Mới có stub trong test — chứng minh request đúng và mapping đúng, không chứng minh Supabase đã cấu hình. Phải chạy lại sau khi đồng nghiệp apply migration. Lỗi lệch cột sẽ ra `SUPABASE_400:<body>`.
4. **Migration + env chưa ai apply.** `0001_zc_orders.sql` **và `0002_zc_coupons.sql`** chưa chạy lên project nào; `SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY` chưa có ở đâu cả. Đây là việc của đồng nghiệp, không phải của lượt này.

   **Hệ quả phải biết trước khi deploy:** `putOrder` nay gửi `user_email` / `coupon_code` / `coupon_percent` trong mọi lần ghi đơn. PostgREST **từ chối cột lạ** (`PGRST204`), nên **thiếu `0002` thì thanh toán hỏng luôn**, chứ không chỉ mất coupon. Lỗi sẽ hiện dạng `SUPABASE_400:<body>`. Phải apply đủ hai migration rồi mới deploy.
5. **`PAID` chưa cấp quyền gì cho tài khoản** vì chưa có auth. Người mua thấy "Đã nhận thanh toán" nhưng chưa có gói nào mở. Phải xử lý trước khi bán thật.
6. **Claim vượt code** — landing copy giờ mô tả AI advisors, AES-256 BYOK, mã hoá hội thoại, "Start free council". Repo **không có** engine AI, không có provider call, không có auth, không có persistence, không có mã hoá nào. Đây là quyết định của chủ dự án theo yêu cầu bỏ ngôn ngữ demo; nếu muốn thu hồi thì chỉ sửa `i18n.ts`.
7. Tỷ giá USD là chuỗi tĩnh trong `plans.ts`, **không phải** hằng số env. Khi cần đổi, sửa `plans.ts` (rule 28.3: giá lấy từ nguồn chân lý do chủ dự án cung cấp).
8. Mã giảm giá chưa có giá trị nào được duyệt — bảng đọc từ `PAYLOS_DISCOUNT_CODES`, để trống là từ chối mọi mã.
9. **`colorToken` trong `types.ts` vẫn chưa component nào dùng.** 4 màu persona đã quay lại orb, nhưng thẻ advisor trong app vẫn chưa dùng trường này.
10. Logo 24px đọc ra **3 chấm nằm ngang, không phải 4 chấm trên vòng** — vì logo không xoay nên scene phẳng, node 0°/180° chiếu về chung tâm. Đã ghi trong comment CSS. Muốn đúng 4 thì phải bật lại spin hoặc dùng SVG phẳng.
11. `.agent/skills/verify-app/`, `features/`, `FEATURE_MAP.md` (rule 28.2/32) — chưa sinh, mở task riêng.
12. **Workflow chưa từng gọi Vercel thật.** 5/5 test pass với HTTP stub — chứng minh URL, method, header, payload, xử lý 403 và dọn file tạm. Không chứng minh Vercel nhận token hay body đúng schema. Chạy một lần sau khi có `VERCEL_TOKEN`.
13. **`actions/checkout` đang ghim tag `@v4`, chưa phải SHA** (rule 20). Chưa "dùng thật" nên chấp nhận được, nhưng phải đổi trước lần chạy thật đầu tiên.
14. **Còn phụ thuộc đồng nghiệp ở 3 chỗ**, không giảm được bằng workflow: (a) deploy, (b) apply migration, (c) **redeploy sau mỗi lần đổi secret** — Vercel chụp biến theo từng deployment. Muốn bỏ hẳn (c) thì cách duy nhất là thêm chủ dự án vào Vercel project.

## Bàn giao

1. ~~Sửa code + docs~~ — xong.
2. **Lượt 7 đã commit và push** lên `product-voice-ui` sau `f748243` (7f39fbe). PR #10 vẫn OPEN, chờ thanh toán thật.
3. Push lên PR #10 (đang mở) — **cần chủ dự án duyệt**. PR #10 vẫn chờ verify thanh toán thật mới merge.
4. **Đồng nghiệp**: apply `web/supabase/migrations/0001_zc_orders.sql`, đặt `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` trong Vercel env, đăng ký webhook URL payOS.
5. **Chủ dự án**: tạo tài khoản payOS + điền 3 credential — theo hướng dẫn trong `README.md`.
6. Dừng server tạm trước khi kết thúc.

---

# HANDOFF — Deliberation loop (2026-09-27)

Worktree `.worktrees/deliberation-loop`; branch `deliberation-loop`; base `cb4bee8` (`origin/main`).
Các worktree cũ (`product-proposal-ui`, `feature-prototype-ui-integration`, `governance-v74`, `responsive-polish`, `ui-ux-local-mock`, `vi-font-fix`) **không đụng tới**, vẫn chờ chủ dự án quyết.

## Đã làm

1. **Seam engine**: `web/src/lib/deliberation/engine.ts` — `runDeliberation(req): Promise<Round>` là hàm duy nhất UI gọi. Thay engine thật = thay một thân hàm. Có block comment `DELEGATED` soi cùng kiểu với `authenticateFromSession` để không ai vá chỗ khác.
2. **Logic thuần tách ra** `plan.ts` (không i18n, không dependency) để `node --test` chạy được không cần bundler. Engine trả **id** ma trận, UI map sang nhãn.
3. **Ba phương thức chọn được** (`independent` / `debate` / `chain`), phân biệt bằng dữ liệu: không cross-ref / `rebuts` / `buildsOn`. Người dùng chọn giữa phiên, áp cho vòng sau.
4. **`RoundThread`** + **`FrameworkPanel`**: rail chọn vòng, badge tham chiếu chéo, phần Chair; panel render 3 nhánh / 6 khối Hats / bảng ma trận có trọng số.
5. **`SessionActiveView`** viết lại: chọn phương thức, composer chạy vòng tiếp, trạng thái chờ + Cancel, `AbortSignal`.
6. **`SessionConcludedView`** đọc vòng cuối, dùng chung `FrameworkPanel`, xoá 3 bản sao `ScenarioBranch`.
7. **Bảngnghi `frameworkAppliesNext`**: trước đó đổi framework giữa phiên **không hiện gì** vì panel bám `round.framework` — người dùng tưởng nút hỏng.
8. **Test parity i18n** chốt thành test thường trực (parity hai chiều + placeholder khớp), không còn kiểm tay.
9. Xoá `testimonies` + `synthesis` + `scenarios` không vòng; thay bằng `rounds: Round[]` + `mode`.

## Evidence

Lái app thật bằng `next start` (không dùng dev server — HMR hỏng):

| Tiêu chí | Bằng chứng quan sát |
|---|---|
| Mode switch đổi loại badge | Round 2 ở Debate → `Answers The Pragmatist`, `Answers The Dreamer`; Round 1 giữ `Nobody saw the other answers.` |
| Vòng 2 tạo được, vòng 1 xem lại được | Rail `Round 1 / Round 2 / Round 3`; bấm `Round 1` → về đúng nội dung independent |
| Framework đổi hình dạng panel | Hats = 6 khối White/Red/Black/Yellow/Green/Blue; Matrix = bảng có weight; Scenarios = Favorable/Neutral/Difficult |
| Kéo weight chấm lại tổng | weight 3,4,5,1 → 30/51/32 của 65. Đổi cost 3→1 → 28/45/22 của 55. Đổi 1,1,1,5 → 26/17/23 của 40, người dẫn đầu chuyển sang `Roll out everywhere` |
| Cancel dừng vòng đang chờ | Panel "The council is deliberating…" hiện, bấm Cancel → rail vẫn 2 vòng, toast `Round stopped.` |
| Song ngữ | `html[lang=vi]`, toàn bộ nhãn đổi, bảngnghi "tạo bằng tiếng English" hiện đúng |

Cổng: `tsc` 0 · `eslint` 0 · `next build` 0 · `node --test` 44/44.

## Cần bạn nhìn kỹ

1. **Bug tôi tự tạo ra rồi tự sửa**: đổi framework giữa phiên lúc đầu **không hiện gì trên UI**. Tôi thêm bảngnghi thay vì sửa panel theo session, vì sửa panel sẽ phá nguyên tắc "vòng đã xong là lịch sử bất biến" mà phương thức giao tiếp đang giữ. Nếu bạn muốn đổi framework là thấy ngay thì phải đổi cả hai, tôi chưa làm.
2. **Danh sách 3 phương thức là giả định của tôi.** Bạn nói "có thể chọn phương thức", không chốt cụ thể. `vote` tôi cố tình bỏ vì trùng Decision Matrix.
3. **Ma trận đang chấm bằng weight view state.** Kéo slider không ghi vào round, chuyển vòng là về lại số cũ. Khi có engine thật, điều này có còn đúng không thì cần bạn chốt.
4. **Chưa có CI** (rule 32.6 còn thiếu). Ba cổng trên tôi chạy tay.
5. `actions/checkout` vẫn ghim tag `@v4` chứ không phải SHA (rule 20) — chưa dùng thật nên chấp nhận được, nhưng phải sửa trước lần chạy thật.
6. `features/` + `FEATURE_MAP.md` (rule 28.2) vẫn chưa sinh.
7. **PR chưa mở, chưa merge.** Cần bạn duyệt.

---

# Lượt 2 — Ổn định hoá engine trước khi cấu hình API key (2026-10-04)

Yêu cầu: `đảm bảo engine hoạt động tốt và ổn định trước khi config API Key. Khung + engine thôi, brain thêm sau.`
Chủ dự án chốt hai điểm khi hỏi: thêm `onContribution` ngay, và khi lỗi thì **cảnh báo + giữ câu hỏi để thử lại**.

## Vì sao phải tách seam mới kiểm chứng được

`engine.ts` import `@/prototype/i18n` chỉ để lấy câu trả lời cứng. Node không resolve alias nên **contract không test được** — và nó chỉ dính bản dịch. Đã tách:

- `engine.ts` — hợp đồng thuần, import duy nhất là `./plan.ts`
- `fixture.ts` — câu trả lời cứng + `pacedProducer`, nơi duy nhất cần bảng copy

`createDeliberationEngine(produce, timeoutMs?)` bọc producer; app gọi hàm đã bọc. Khi có engine thật: viết producer + đổi **một** dòng import trong `AppContext`.

## Năm lỗi tìm được khi đọc code trước khi cấu hình key

1. `else throw error` trong `runRound` → unhandled rejection, im lặng.
2. Chặn song song bằng `isDeliberating` (state) → hai click cùng tick đều thấy `false`, sinh hai vòng **cùng số thứ tự**. Đổi sang `busyRef`.
3. `startNewSession` không hủy vòng đang chạy → vòng cũ ghi vào phiên đã rời, kéo `selectedRoundIndex` của phiên mới.
4. `createSession` không nhận `AbortSignal` → không hủy được.
5. Không deadline → provider treo là spinner vĩnh viễn.

## Bug thật do test tìm ra

Signal đã abort **trước** khi gọi không được thừa nhận: listener forward được gắn vào một signal đã nổ, nên không bao giờ chạy lần nữa. Không test nào bắt được trước đó vì mọi test cũ đều abort *giữa* chừng.

## Evidence

`node --test` **54/54** (26 trong deliberation: 7 validation + 5 contract + 14 cũ) · `tsc` 0 · `eslint` 0 không warning · `next build` 0.

App thật (`next start -p 8794`):

| Tiêu chí | Quan sát được |
|---|---|
| Streaming đúng thứ tự | `thinking,thinking,thinking,thinking` → từng cố vấn `answered` lần lượt → `Chair=answered` cuối cùng |
| Bấm Run round hai lần cùng tick | Rail `Round 1..3` → `Round 1..4`: **một** vòng mới, không trùng số |
| Cancel giữ câu hỏi | Panel chờ hiện, Cancel → toast `Round stopped.`, ô nhập vẫn còn `A question I want to keep after cancelling` |
| Thành công thì xoá ô | Ô trống, toast `Round 5 added.` |

## Cần bạn nhìn kỹ

1. **Toast lỗi chưa từng hiện trên trình duyệt.** Fixture không bao giờ hỏng nên không có cách nào kích nó từ UI. Đường đi `DeliberationError` được unit test ở tầng engine, nhưng cái toast thì chỉ tin vào code đọc được chứ không phải quan sát được.
2. **Deadline 30 giây không chạy thật trên trình duyệt** — test dùng 20ms qua tham số `timeoutMs`. Con số 30.000 chỉ là điểm neo, chưa đo độ trễ provider thật.
3. **Tạo phiên đầu tiên vẫn không có pending panel** — `EmptyChamberView` không đọc `isDeliberating`, nên lúc tạo phiên người dùng thấy màn không đổi trong ~1.7 giây. Tôi để nguyên vì ngoài phạm vi lượt này, nhưng nó là ứng viên sửa tiếp theo rõ ràng.
4. **Không có giới hạn số vòng.** Người dùng bấm 500 lần thì mảng `rounds` phình trong bộ nhớ trình duyệt. Chưa chốt vì cần biết giới hạn thật của gói (Free 2 / Pro 4 / Ultra 8 advisor — nhưng đó là advisor, không phải vòng).
5. **`onContribution` chỉ báo chứ không còn giữ trong state vĩnh viễn** — progress bị xoá khi vòng xong, đúng nhưng nghĩa là nếu sau này muốn vòng chạy dở rồi mở lại thì phải thêm phần lưu riêng.
6. **PR #15 vẫn chưa merge.** Tôi không tự duyệt.
