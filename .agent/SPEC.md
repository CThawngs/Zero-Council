# Zero Council — UI/UX spec (in-browser release)

Cập nhật: 2026-09-26. Governance khi soạn: v7.4. Worktree task: `.worktrees/product-voice-ui`; branch: `product-voice-ui`; base `83ee993` (`origin/main` sau PR #9 merge).
Trạng thái: IMPLEMENTED (chờ PR).

## Quyết định định vị — 2026-09-26 (chủ dự án)

- CONFIRMED: copy người dùng thấy phải dùng giọng sản phẩm, không dùng "demo / sample / fixture / prototype / local-only".
- CONFIRMED: giai đoạn này chỉ đổi lớp vỏ và copy. Engine thật (model, provider, orchestration, persistence) để giai đoạn sau, mở task riêng.
- CONFIRMED: người dùng vẫn được nhập câu hỏi tự do; kết quả luôn gắn nhãn là nội dung minh họa, không phải khuyến nghị được tính ra.
- CONFIRMED: không được hiện claim về độ chính xác, confidence, ranking, ROI, ISO/compliance. Ranh giới tính năng chưa có (auth, payment, provider, AI, server storage) vẫn phải nói rõ là "chưa có trong bản này".
- OPEN: tên gọi, giá và chính sách thương mại thật — chưa có nguồn chân lý, chưa được phép bịa.
- Rủ lý do: bỏ nhãn demo mà engine vẫn trả dữ liệu cố định sẽ là copy làm giả production. Vì vậy nhãn "minh họa" được giữ ở mọi điểm kết quả.

## Mục tiêu

Giao diện sản phẩm song ngữ EN/VI cấu trúc quyết định khó: định khung câu hỏi, đối chiếu nhiều góc nhìn, kết thúc bằng tiêu chí xem lại và bước tiếp theo. Nội dung hội đồng là văn bản minh họa cố định đi kèm ứng dụng. Không phải dịch vụ tư vấn chuyên môn, tài chính/y tế/pháp lý, và chưa phải sản phẩm AI, auth, payment hay hệ thống production.

## Ranh giới runtime

- `/` render `web/src/prototype/App.tsx` bằng deterministic initial React state để tránh hydration mismatch.
- Session/persona tồn tại trong React/browser memory; refresh đặt lại state.
- Câu hỏi tùy ý không được phân tích; flow dùng fixed generic illustrative text.
- `/fixture` chỉ hiển thị fixed bilingual illustrative content.
- `/api/council` trả fixed English content; prototype `/` không gọi endpoint này.
- Không có model/provider call, credentials, auth, payment, analytics, server storage, transcript persistence hoặc deployment.
- Provider/model names chỉ là internal fixture IDs được render thành nhãn địa phương hóa.
- Paid/auth surfaces không provision; không có checkout, billing, sign-in, account, invoice hoặc dữ liệu định danh giả.
- Không cam kết ISO/compliance, encryption, accuracy, latency, confidence, ranking, conversion, ROI hoặc hiệu quả chuyên môn.

## Hành vi chính

- English mặc định. Language toggle cập nhật visible copy, `document.documentElement.lang`, title và description.
- Navigation đổi view trong React memory; main view nhận focus sau navigation.
- New sample yêu cầu câu hỏi, framework label và fixed personas; active view nói rõ scripted state.
- Concluded view dùng fixed synthesis/scenarios/testimonies; không gắn output với câu hỏi như lời khuyên cá nhân hóa.
- New persona kiểm tra required fields, tạo nhãn `Sample {archetype}`, giữ user archetype/stance/instructions trong memory và tạo semantic toast đúng ngôn ngữ hiện tại.
- Provider toggles chỉ đổi local placeholder state; không nhận/lưu/gửi key.
- Clipboard copy chỉ chạy sau user action và chỉ báo success sau khi `navigator.clipboard.writeText()` resolve.
- Native `<dialog>`: `showModal()`, `close()`, Escape, backdrop coordinate check, focus return; explicit close button có accessible name.
- Tương tác dùng native hover/focus/cursor feedback; motion CSS-only và bị tắt qua `prefers-reduced-motion`.
- Header responsive: dưới 40rem chỉ giữ language/menu; 40–64rem thêm CTA (public) hoặc settings icon (workspace) và menu; từ 64rem hiện desktop nav và ẩn menu.
- Header public chỉ có một chủ đề tối — không có nút bật/tắt theme và không có biến palette `html.light`. Một control trông như có tác dụng nhưng không có hành vi thật là bug.
- Mobile navigation panel là disclosure panel `position:absolute` dưới header, `max-height: calc(100dvh - 76px)`, `overflow-y:auto`, `overscroll-behavior:contain`; focus trap giới hạn trong panel, Escape đóng và trả focus về menu button, pointerdown ngoài header đóng panel.
- Layout chống overflow: `.content-shell width: min(100%, 72rem)`, modal dùng `calc(100% - gutter)` (không `100vw` vì scrollbar), mọi flex/grid con dài dùng `min-w-0` + `truncate`/`break-words`, icon dùng `shrink-0`.
- Input/select/textarea giữ `font-size: 1rem` để iOS không zoom khi focus.
- Font nạp qua `next/font/google` trong `web/src/app/fonts.ts`: `Inter` cho sans, `Literata` cho serif, cả hai với `subsets: ['latin', 'vietnamese']` và `display: 'swap'`. Font tự self-host ở build nên runtime không có request ra ngoài origin. Literata thay Fraunces vì Fraunces là serif "vintage" xử lý dấu tiếng Việt xếp chồng (ậ/ễ/ở) kém.
- `@theme` trong `globals.css` trỏ `--font-sans`/`--font-serif` vào CSS variable của `next/font`; fallback là các font có dấu tiếng Việt (`ui-sans-serif`, `system-ui`, `Segoe UI` cho sans; `Georgia`, `Times New Roman` cho serif) để webfont bị chặn vẫn hiển thị dấu đúng thay vì thay glyph từng ký tự.
- Hero chỉ có một hào quang: `.glow` dùng `radial-gradient(circle, rgba(201,162,75,0.22) 0%, rgba(201,162,75,0.06) 45%, rgba(201,162,75,0) 70%)`. Không accent màu thứ hai cạnh nó; node của `CouncilOrb` cùng hue brass, phân cấp bằng opacity.

## Tiêu chí chấp nhận

- AC-01: Fresh load không console error/warning và không hydration mismatch.
- AC-02: EN/VI copy hiển thị đúng; metadata đổi theo language; `/fixture` cũng đổi language.
- AC-03: New deliberation flow chạy bằng input tùy ý nhưng output luôn fixed và được gắn nhãn minh họa.
- AC-12: Không còn từ "demo / sample / fixture / prototype / illustrative / walkthrough / local-only / not connected" trong bất kỳ chuỗi nào người dùng thấy ở mọi view. Ngoại lệ đã duyệt: nhãn trạng thái BYOK "Not connected" và trang `/fixture` vốn là trang tham chiếu nội dung.
- AC-13: Không thêm claim đo được (accuracy, confidence, ranking, ROI, ISO/compliance) vào bất kỳ view nào.
- AC-14: Header không có nút bật/tắt theme; không còn palette `html.light`; `Theme`/`toggleTheme` không tồn tại trong `types.ts`/`AppContext`.
- AC-15: Nav public đúng 3 mục — How it works (`#how-it-works`), Why Zero Council (`#why-zero-council`), Pricing (render `PricingView`). Footer chỉ có `© 2026 Zero Council.`
- AC-16: Hero có đúng một hào quang brass theo `AC` mục font ở trên; mọi node `CouncilOrb` cùng hue brass.
- AC-17: Serif là Literata; dấu tiếng Việt vẽ bằng glyph webfont (đo bề rộng khác cả fallback-face và Georgia).
- AC-18: Giá chỉ tồn tại ở một chỗ: `web/src/prototype/data/plans.ts` (`priceVnd` số nguyên là nguồn gốc, `priceUsd` là chuỗi tĩnh từ bảng quy đổi đã duyệt). Không component nào tự chứa số tiền; không gọi API tỷ giá.
- AC-19: `locale=vi` → `139.000₫/tháng`; `locale=en` → `$5.99/mo`. Đổi ngôn ngữ chỉ đổi cách viết, không sinh hệ giá thứ hai.
- AC-20: Màn thanh toán luôn hiện `₫139,000 (~$5.99)` (VNĐ là số chính) và dòng EN-only "Charged in Vietnamese Đồng (VNĐ) via PayOS. USD shown for reference only." Dòng đó không hiện ở locale vi.
- AC-21: Mọi nơi có giá dùng cùng con số: Pricing 3 card, teaser landing `#pricing`, Settings > Plan, Billing history, khối Amount, dòng giá gốc của Discount code. Không còn `149.000`/`299.000` hay "3/6 advisors" ở bất kỳ đâu.
- AC-04: New advisor validation và valid submission hoạt động; persona mới localizes khi đổi language.
- AC-05: Dialog mở/đóng bằng button, Escape và backdrop; focus trả về trigger.
- AC-06: Clipboard success/failure không báo thành công giả.
- AC-07 (sửa ở lượt thanh toán): UI không tự gọi payOS. Nút "Thanh toán qua PayOS" chỉ POST tới route cùng origin `/api/payos/create-payment`; mọi secret và mọi lệnh gọi ra payOS nằm ở server route. `/api/council` vẫn không được prototype gọi.
- AC-08: Không có dữ liệu định danh, tài khoản, credential, invoice, renewal hoặc payment giả. Lượt thanh toán chỉ thêm order thật do payOS xác nhận — không có dòng nào tự báo "đã thanh toán".
- AC-09: Không overflow ở 320/360/375/390/414/600/640/768/900/1024/1280/1440; interactive targets ≥44px; reduced motion không còn transition/animation.
- AC-10: Lint, TypeScript, production build, budget test, `git diff --check`, Lighthouse và browser evidence pass trên final commit.
- AC-11: Dấu tiếng Việt render bằng glyph thật của webfont, không phải fallback từng ký tự; không có mojibake (`U+FFFD`) trong copy VI; runtime không có request tới `fonts.googleapis.com` hoặc `fonts.gstatic.com`.

- AC-22: Số tiền thanh toán lấy từ `plans.ts` ở server, không bao giờ từ request của client. Client chỉ gửi `planId` (+ `code`).
- AC-23: Webhook payOS chỉ đổi trạng thái order khi (a) `verifySignature` chạy qua `timingSafeEqual` với Checksum Key và (b) `data.amount` khớp đúng `amountVnd` đã lưu. Sai chữ ký → 401, sai số tiền → 409, không có order → 404, `code` lạ → 400. Không có đường nào tự báo PAID.
- AC-24: `POST /v2/payment-requests` (payOS v2; `/v1/payment/create` đã 404). Response cũng phải verify signature trước khi trả `checkoutUrl` cho trình duyệt.
- AC-25: Mọi secret đọc qua `serverEnv(key)` (dynamic). Không dùng `process.env.PAYOS_*` dạng literal — Next inline lúc build thành `undefined` và webhook trả 503 vĩnh viễn.
- AC-26: Order `PAID` là trạng thái kết thúc. Webhook muộn (`01` failed) không được hạ một order đã trả.
- AC-27: Trạng thái plan chưa được cấp cho tài khoản nào — không có auth. Trang `/checkout/return` chỉ báo trạng thái đơn, không mở khoá gì.
- AC-28: Order store đọc/ghi Postgres (`public.zc_orders`) qua PostgREST bằng `fetch`; không thêm dependency. Hợp đồng bảng nằm trong `web/supabase/migrations/0001_zc_orders.sql`.
- AC-29: Không có `SUPABASE_URL`/`SUPABASE_SERVICE_ROLE_KEY` thì chỉ được rơi về file JSON khi **đĩa bền**. Guard theo `VERCEL=1` (đĩa tạm), KHÔNG theo `NODE_ENV` — `next start` là production build và là cách verify local, dùng `NODE_ENV` sẽ chặn nhầm. Host đĩa tạm mà thiếu DB thì throw, không ghi file.
- AC-30: Xoá sạch project local không được làm app hoặc secret mất. Secret nằm ở env của host; code nằm ở GitHub. Order store phải theo, nếu không thì deploy xong là mất đơn.

## Verify cuối

Ghi command, URL, commit SHA và kết quả thật vào `.agent/HANDOFF.md` sau khi chạy. Không tái sử dụng evidence cũ của PR #4, #5 hoặc #6 cho source đã đổi.

## Ngoài scope

Giai đoạn 2 vẫn mở: AI inference, provider adapters, real orchestration, web search, uploads, real calculations, auth, BYOK, persistence, subscriptions (gia hạn), analytics, deployment và production privacy/compliance claims. Thanh toán một lần đã có; subscription, entitlements và hạn mức advisor (2/4/8) thì chưa.

Lượt này khác giai đoạn 1 ở một điểm phải nói rõ: chủ dự án yêu cầu bỏ hết ngôn ngữ demo, **kể cả các câu giải thích rằng tính năng chưa có**. Landing copy hiện mô tả hành vi chưa tồn tại trong code (AI advisors, AES-256 BYOK, mã hoá hội thoại, "Start free council"). Giảm thiểu: giữ AC-01/AC-02/AC-06/AC-07 (không fetch, không báo thành công giả) và báo rõ trong HANDOFF để chủ dự án quyết định hoặc làm giai đoạn 2, hoặc thu hồi claim.

## Risk / recovery

- Risk: landing copy mô tả sản phẩm chưa tồn tại — người dùng hiểu là có AI thật. Giảm thiểu: ghi OPEN ở HANDOFF; nếu chủ dự án chọn thu hồi, chỉ sửa `i18n.ts` (không đụng component).
- Risk: bảng giá là dữ liệu thương mại, không có nguồn chân lý trong repo. Đã xử lý: giá do chủ dự án cung cấp và nằm trong `data/plans.ts`; cấu hình đổi giá = sửa đúng file đó, không sửa 6 chỗ hiển thị.
- Risk: nhiều chỗ hiển thị giá dễ lệch số. Giảm thiểu: mọi màn đọc từ `PLANS`/`planPrice`/`planAmountLine`; không component nào hard-code con số.
- Risk: `Reveal` không còn fallback khi thiếu `IntersectionObserver`; trình duyệt không hỗ trợ sẽ giữ nội dung ở trạng thái trước khi hiện. Recovery: thêm CSS fallback trong `globals.css` khi cần.
- Risk: order store đã nâng sang Postgres/Supabase. Còn lại: race khi hai webhook cùng lúc ghi một order (đã giảm nhờ `status.neq.PAID` nằm trong chính câu ghi, nhưng chưa có transaction). Nếu đổi sang nhiều instance mà vẫn để fallback file thì phải set DB, nếu không guard chỉ bắt được Vercel.
- Risk: nhánh PostgREST **chưa từng chạy với Supabase thật**, mới chỉ có stub. Nếu tên cột lệch migration sẽ ra `SUPABASE_400:<body>` — body có trong message để tìm ra cột nào sai. Bắt buộc test lại sau khi project tồn tại, trước khi nhận tiền thật.
- Risk: `PAID` chỉ là trạng thái order, chưa cấp quyền cho tài khoản nào. Người mua thấy "đã nhận thanh toán" nhưng chưa có gì mở — phải nói rõ với chủ dự án trước khi bán.
- Risk: webhook cần URL HTTPS public. Localhost không nhận được webhook; test local phải dùng tunnel (cloudflared/ngrok).
- Risk: nếu payOS đổi cách chuẩn hoá chữ ký response, `verifySignature` chặn người mua thật. Dấu hiệu nhận biết nằm trong log `[payos] create-payment rejected: response signature did not verify`; sửa `toSignaturePayload` theo tài liệu mới.
- Risk: `PAYLOS_CHECKSUM_KEY` lộ ra trong client bundle là lộ toàn bộ. Đã chặn: secret chỉ đọc trong server route, không có `NEXT_PUBLIC_` nào.
- Risk: copy làm giả production, localization stale, hydration mismatch, dialog focus regression, unsupported claims.
- Risk responsive: unlayered component CSS (`.button-primary`, `.icon-button`) đè Tailwind layered utilities nên `hidden`/`sm:inline-flex` bị bỏ qua — dùng semantic class unlayered riêng (`.header-cta`, `.header-settings`, `.header-menu`) với `display` tường minh trong media query.
- Risk font: khai báo tên font mà không nạp file thật khiến browser fallback từng ký tự. Recovery: dùng `next/font` với `subsets` chứa `vietnamese` và fallback có dấu; đã đo bề rộng để xác nhận glyph VI do webfont vẽ.
- Risk font: `next/font/google` cần mạng lúc build để tải và cache font. Nếu build offline không có cache, build fail — recovery: dùng `next/font/local` với file đặt sẵn trong repo, không thêm dependency.
- Risk hydration: extension trình duyệt (Grammarly) chèn attribute vào `<body>` (`data-gr-ext-installed`, `cz-shortcut-listen`). Recovery: `suppressHydrationWarning` trên `<body>`; không được dùng nó để che lỗi render của app.
- Recovery: revert PR/commit trên branch task; không reset/stash/xóa thay đổi worktree khác.

## OPEN / delegated

- Bảng giá đã chốt (chủ dự án, 2026-09-26): Free 0₫/$0 · 2 advisor; Pro 139.000₫/$5.99 · 4 advisor; Ultra 379.000₫/$16.99 · 8 advisor. "Advisor" = số persona active cùng lúc trong 1 phiên, KHÔNG phải số model riêng.
- Mã giảm giá: chưa có giá trị nào được duyệt. Bảng đọc từ `PAYLOS_DISCOUNT_CODES`; để trống = mọi mã bị từ chối. Chủ dự án tự điền sau.
- payOS credential: cần `PAYLOS_CLIENT_ID` / `PAYLOS_API_KEY` / `PAYLOS_CHECKSUM_KEY` từ tài khoản thật của chủ dự án. Không tự tạo tài khoản, không tự đăng ký cổng thanh toán.
- Landing copy mô tả AI/BYOK/mã hoá trong khi repo chưa có: chủ dự án quyết định làm giai đoạn 2 hay thu hồi claim.
- Required GitHub checks và ruleset được xác nhận sau khi push PR mới.
- Không deploy, cấu hình cloud, tạo account/provider hoặc dùng secret. Lượt thanh toán: việc cần chủ dự án làm là tạo tài khoản payOS, điền 3 biến môi trường, và đăng ký webhook URL — không phải viết code.
- **DELEGATED (lượt 7, 2026-09-27)**: deploy, auth và tạo project Supabase là của đồng nghiệp chủ dự án, ngoài phạm vi. Việc chờ đồng nghiệp: apply `web/supabase/migrations/0001_zc_orders.sql`, đặt `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` trong Vercel env. Không tự tạo gì trong project của người khác.
- Xoá local (rule 12): **mốc 70–80% không phải quyền xoá**. Folder local hiện 628 MB, trong đó `node_modules` 438 MB + `.next` 189 MB; pnpm store 5.4 GB nằm ngoài folder. Dữ liệu nặng không phải `.env.local` (vài trăm byte).

---

# Phụ lục — Deliberation loop (2026-09-27)

Worktree `.worktrees/deliberation-loop`; branch `deliberation-loop`; base `cb4bee8` (`origin/main`).
Trạng thái: IMPLEMENTED + VERIFIED (chờ PR, chưa merge).

## Quyết định chủ dự án (phỏng vấn nhiều vòng)

- CONFIRMED: phần tương tác là việc chung chủ dự án + kỹ sư; lượt này dựng UI với data ảo, engine thật nối vào sau.
- CONFIRMED: **phương thức cố vấn giao tiếp phải chọn được, không gói gọn một phương thức**. Người dùng chọn mỗi lúc muốn á.
- CONFIRMED: không thiết kế lại layout; chỉ bổ sung thành phần còn thiếu + điều khiển tương tác.
- OBSERVED: `data/mockData.ts` không hề rẽ nhánh theo `framework`; UI là một lượt tĩnh, không có ô nhập sau khi gửi, không có vòng, không có mặt phẳng tranh luận.
- ASSUMPTION: danh sách 3 phương thức dưới đây là mặc định đề xuất; chủ dự án được sửa bất kỳ lúc nào.

## Ranh giới runtime (bổ sung)

- `Round` là đơn vị lịch sử: `mode` và `framework` được đóng băng tại lúc tạo. Đổi cả hai trong phiên chỉ áp dụng cho vòng kế tiếp; UI nói rõ điều này thay vì sửa lịch sử.
- Toàn bộ đường AI nằm sau **hai** module: `engine.ts` là *hợp đồng* (validation, deadline, cancel, streaming) và không import gì ngoài `plan.ts`; `fixture.ts` là câu trả lời cứng. Vì engine không dính bảng copy, hợp đồng chạy được bằng `node --test` không cần bundler.
- Lời văn sinh ra là dữ liệu cố định, đã dán nhãn minh họa. Câu trả lời giữ nguyên ngôn ngữ lúc sinh; UI hiện bảngnghi khi `round.language` khác ngôn ngữ đang xem.
- Ma trận quyết định: engine trả **id** (`cost`/`speed`/`risk`/`reversibility` × `optionA/B/C`), UI mới map sang nhãn — nhờ vậy `plan.ts` không phụ thuộc i18n và test được bằng `node --test` không cần bundler.
- Weight là **view state**, không ghi vào round. Kéo slider chấm lại bảng đang xem nhưng không viết đè vòng đã xong.
- Chỉ một vòng chạy tại một thời điểm, chặn bằng `busyRef` chứ không bằng state — state chưa kịp render thì hai click vẫn chạy song song.

## Rủ lý ro mới

- Risk: đổi framework giữa phiên trước đây **không hiện gì** (panel bám `round.framework`), người dùng tưởng nút hỏng. Đã thêm bảngnghi `frameworkAppliesNext` nói rõ framework mới áp từ vòng sau.
- Risk: chạy nhiều `click()` trong cùng một tick đọc DOM cũ của React — đã làm tôi kết luận sai về mode. Khi kiểm chứng bằng trình duyệt phải chờ render giữa mỗi thao tác. Textarea cũng bị thay node khi hiện pending panel, nên phải query lại chứ không giữ tham chiếu.
- Risk: `aria-pressed` không hợp lệ trên `role="tab"` (chặn bởi `jsx-a11y/role-supports-aria-props`). Toggle group dùng `role="group"` + `aria-pressed`.
- Risk: `runRound` từng `throw` lỗi không phải cancel → unhandled rejection, im lặng. Đã bắt mọi lỗi thành toast và giữ nguyên câu hỏi trong ô.
- Risk: engine không có deadline nghĩa là một provider treo là spinner vĩnh viễn. `ENGINE_TIMEOUT_MS` biến nó thành lỗi nhìn thấy được.
- Recovery: engine thật = viết một `RoundProducer` rồi bọc `createDeliberationEngine`, đổi **một** dòng import trong `AppContext`. Không component nào phải đổi.
