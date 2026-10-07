# LƯỢT 11 — Engine viết lại: A2A có cấu trúc (2026-10-07)

Lượt này viết lại `engine.ts` từ đầu. Phần cũ của HANDOFF (lượt 9, billing/coupon) giữ nguyên.

## Quyết định nền tảng: bỏ regex trên prose

Bản cũ trao lượt A2A bằng cách đọc `@name` trong **văn bản** bot. Sai ở tầng kiến trúc:

- Nhắc (*"dreamer, what do you think?"*) bị nhầm là trao lượt — nhất là khi trích dẫn code block.
- Model quên quy ước `@` → rơi về fallback im lặng, không báo lỗi.
- Tên nhiều từ dễ không resolve.
- Không phân biệt được *muốn ai trả lời* với *nhắc tới ai*.

Hermes làm đúng việc này bằng tool call có cấu trúc (`message_agent(target=…)`). Vì vậy:

```ts
export interface BotTurn { text: string; handoffs: string[]; silent?: boolean }
export type BotGenerator = (request: ChatTurnRequest) => Promise<BotTurn> | BotTurn;
```

Engine đọc `handoffs`, **không bao giờ** đọc prose. BYOK thay đúng một export (`scriptedGenerator`) là xong — `runTurn` không đổi.

Có test *"prose alone never routes — a quoted mention is not a handoff"* chắc chắn **thất bại** dưới thiết kế cũ.

## Bug tìm ra khi lái app thật

Cả hai đều **không** lộ ra qua test — chỉ lộ khi lái Chrome thật (rule 19):

1. **`stop @bot` vẫn chạy thành một lượt.** Advisor vừa bị hold nên không còn trong roster, mention không resolve → `speakers = []` → phòng hiện "No advisor answered this round" cho một tin **không phải câu hỏi**. Đó là lời nói dối về chính hội đồng.
2. **Nhận diện directive dùng sai roster.** Dòng cũ dùng roster **đã lọc**; advisor cần bị dừng thì đương nhiên không có trong đó → không bao giờ nhận ra lệnh dừng.

Sửa: directive nhận diện trên **roster đầy đủ**; `stop` là lệnh thuần nên **không** chạy vòng; `@all` thì **phải** chạy vòng (user đang bảo hội đồng tiếp tục — im lặng mới là lỗi).

## Evidence

Cổng chất lượng: `tsc --noEmit` exit 0 · `eslint src` exit 0 · `next build` exit 0 · `node --test tests/chat-engine.test.mjs` **25/25**.

**Lái app thật: `ALL_CHECKS_PASS`** (`next start -p 3230`). Bằng chứng: `.agent/evidence/council-room.png`, `.agent/evidence/council-drive.json`.

| Tình huống | Kết quả quan sát được |
|---|---|
| Câu hỏi không mention | Pragmatist mở lượt → `@The Dreamer` → Dreamer trả lời → `@user` |
| `@The Dreamer …` | Dreamer mở lượt, Pragmatist **không** mở |
| `stop @The Pragmatist` | Không cố vấn nào nói, **không** báo "nobody answered" |
| `@all carry on` | Pragmatist quay lại, mở lượt, handoff tiếp sang Dreamer |

Cap theo gói xác nhận luôn chạy: modal hiện "2 of 2 selected" trên gói Free.

`tests/drive-council.mjs` lái Chrome thật qua CDP **không thêm dependency** — Node 24 có `WebSocket` + `fetch` sẵn. `agent-browser` chưa cài; cài global là thay đổi máy nên không tự ý làm (rule 9).

## OPEN (vòng 11)

1. **Trần vòng lặp chưa chốt — mâu thuẫn đang mở.** Spec gốc: "vòng lặp vô tận cho đến khi user kêu dừng". Chủ dự án từng chốt 3 lượt. Đang chạy `DEFAULT_MAX_TURNS = 12` + `DEFAULT_ROOM_BUDGET = 200`. Muốn "vô tận" thật thì phải chặn bằng **ngân sách tiền**, không phải số lượt — vòng không có khiến thì đốt token vô hạn.
2. **`scriptedGenerator` không suy nghĩ.** Nó tuân thủ hợp đồng nên chứng minh **routing** đúng; **không** chứng minh model thật sẽ phát ra handoff. Chỉ BYOK mới trả lời được. Đây là giới hạn lớn nhất còn lại.
3. **Persistence chưa có.** Phòng chỉ sống trong React; F5 là mất. Hermes có memory riêng từng thành viên + `/compress` — chưa làm.
4. **Claim vượt code (mục OPEN 6 cũ vẫn đúng).** Landing hứa BYOK AES-256, hội thoại mã hoá. Repo không có mã hoá nào. `currentUser.ts` trả `null`, `SignInView` còn rỗng.
5. `features/` + `FEATURE_MAP.md` (rule 28.2/32) — chưa sinh.

## Bàn giao (vòng 11)

1. Code + docs: xong.
2. **Chưa commit.** Tree đang có thay đổi ở `main` — cần chủ dự án chốt hướng commit/PR.
3. Dừng server tạm: xong (xem `.agent/evidence/council-drive.json` để chạy lại).

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
