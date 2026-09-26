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
- Header responsive: dưới 40rem chỉ giữ language/theme/menu; 40–64rem thêm CTA (public) hoặc settings icon (workspace) và menu; từ 64rem hiện desktop nav và ẩn menu.
- Mobile navigation panel là disclosure panel `position:absolute` dưới header, `max-height: calc(100dvh - 76px)`, `overflow-y:auto`, `overscroll-behavior:contain`; focus trap giới hạn trong panel, Escape đóng và trả focus về menu button, pointerdown ngoài header đóng panel.
- Layout chống overflow: `.content-shell width: min(100%, 72rem)`, modal dùng `calc(100% - gutter)` (không `100vw` vì scrollbar), mọi flex/grid con dài dùng `min-w-0` + `truncate`/`break-words`, icon dùng `shrink-0`.
- Input/select/textarea giữ `font-size: 1rem` để iOS không zoom khi focus.
- Font nạp qua `next/font/google` trong `web/src/app/fonts.ts`: `Inter` cho sans, `Fraunces` cho serif, cả hai với `subsets: ['latin', 'vietnamese']` và `display: 'swap'`. Font tự self-host ở build nên runtime không có request ra ngoài origin.
- `@theme` trong `globals.css` trỏ `--font-sans`/`--font-serif` vào CSS variable của `next/font`; fallback là các font có dấu tiếng Việt (`system-ui`, `Segoe UI`, `Iowan Old Style`, `Palatino Linotype`, `Palatino`) để webfont bị chặn vẫn hiển thị dấu đúng thay vì thay glyph từng ký tự.

## Tiêu chí chấp nhận

- AC-01: Fresh load không console error/warning và không hydration mismatch.
- AC-02: EN/VI copy hiển thị đúng; metadata đổi theo language; `/fixture` cũng đổi language.
- AC-03: New deliberation flow chạy bằng input tùy ý nhưng output luôn fixed và được gắn nhãn minh họa.
- AC-12: Không còn từ "demo / sample / fixture / prototype / local-only" trong bất kỳ chuỗi nào người dùng thấy ở `/`, `/fixture`, title hay meta description; chỉ còn nhãn "minh họa" hoặc "chưa có trong bản này".
- AC-13: Không thêm claim đo được (accuracy, confidence, ranking, ROI, ISO/compliance) vào bất kỳ view nào.
- AC-04: New advisor validation và valid submission hoạt động; persona mới localizes khi đổi language.
- AC-05: Dialog mở/đóng bằng button, Escape và backdrop; focus trả về trigger.
- AC-06: Clipboard success/failure không báo thành công giả.
- AC-07: Không có fetch/XHR/WebSocket/storage từ UI; `/api/council` không được gọi bởi prototype.
- AC-08: Không có dữ liệu định danh, tài khoản, credential, invoice, renewal hoặc payment giả.
- AC-09: Không overflow ở 320/360/375/390/414/600/640/768/900/1024/1280/1440; interactive targets ≥44px; reduced motion không còn transition/animation.
- AC-10: Lint, TypeScript, production build, budget test, `git diff --check`, Lighthouse và browser evidence pass trên final commit.
- AC-11: Dấu tiếng Việt render bằng glyph thật của webfont, không phải fallback từng ký tự; không có mojibake (`U+FFFD`) trong copy VI; runtime không có request tới `fonts.googleapis.com` hoặc `fonts.gstatic.com`.

## Verify cuối

Ghi command, URL, commit SHA và kết quả thật vào `.agent/HANDOFF.md` sau khi chạy. Không tái sử dụng evidence cũ của PR #4, #5 hoặc #6 cho source đã đổi.

## Ngoài scope

Task này (giai đoạn 1) chỉ đổi copy và metadata. AI inference, provider adapters, real orchestration, web search, uploads, real calculations, Google/Supabase auth, BYOK, persistence, payments, subscriptions, analytics, deployment và production privacy/compliance claims để giai đoạn 2, mở task và PR riêng.

## Risk / recovery

- Risk: bỏ nhãn demo nhưng engine chưa có — người dùng tưởng có phân tích thật. Giảm thiểu: mọi điểm kết quả vẫn gắn nhãn minh họa; mở nhóm copy ngữ cảnh vào điểm vào; FAQ nói rõ chưa có AI. Nếu cần giai đoạn 2, chỉ bỏ nhãn sau khi có bằng chứng chạy thật.
- Risk: `Reveal` không còn fallback khi thiếu `IntersectionObserver`; trình duyệt không hỗ trợ sẽ giữ nội dung ở trạng thái trước khi hiện. Recovery: thêm CSS fallback trong `globals.css` khi cần.
- Risk: copy làm giả production, localization stale, hydration mismatch, dialog focus regression, unsupported claims.
- Risk responsive: unlayered component CSS (`.button-primary`, `.icon-button`) đè Tailwind layered utilities nên `hidden`/`sm:inline-flex` bị bỏ qua — dùng semantic class unlayered riêng (`.header-cta`, `.header-settings`, `.header-menu`) với `display` tường minh trong media query.
- Risk font: khai báo tên font mà không nạp file thật khiến browser fallback từng ký tự; `Fraunces` không có sẵn nên heading rơi về `Georgia` với dấu tiếng Việt rất yếu. Recovery: dùng `next/font` với `subsets` chứa `vietnamese` và fallback có dấu.
- Risk font: `next/font/google` cần mạng lúc build để tải và cache font. Nếu build offline không có cache, build fail — recovery: dùng `next/font/local` với file đặt sẵn trong repo, không thêm dependency.
- Recovery: revert PR/commit trên branch task; không reset/stash/xóa thay đổi worktree khác.

## OPEN / delegated

- Required GitHub checks và ruleset được xác nhận sau khi push PR mới.
- Không deploy, cấu hình cloud, tạo account/provider hoặc dùng secret.
