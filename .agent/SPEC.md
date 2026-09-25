# Zero Council — UI/UX local mock spec

Cập nhật: 2026-09-25. Governance: v7.1.
Trạng thái: IMPLEMENTED / FINAL_QA_PASS.
Worktree task: `.worktrees/vi-font-fix`; branch: `vi-font-fix`; base `49ec347` (`origin/main` tại task start, sau khi PR #6 merge).

## Mục tiêu

Giao diện trình diễn cấu trúc hội đồng đa góc nhìn bằng dữ liệu cố định, song ngữ EN/VI, responsive và accessible. Đây là local UI concept, không phải sản phẩm AI, tư vấn chuyên môn, dịch vụ tài chính/y tế/pháp lý, auth, payment hoặc production system.

## Ranh giới runtime

- `/` render `web/src/prototype/App.tsx` bằng deterministic initial React state để tránh hydration mismatch.
- Sample sessions/personas tồn tại trong React/browser memory; refresh đặt lại state.
- Câu hỏi tùy ý không được phân tích; flow dùng fixed generic illustrative text.
- `/fixture` chỉ hiển thị fixed bilingual sample content.
- `/api/council` trả fixed English fixture; prototype `/` không gọi endpoint này.
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
- AC-02: EN/VI copy hiển thị đúng; metadata đổi theo language; fixture route cũng đổi language.
- AC-03: New sample flow chạy bằng input tùy ý nhưng output luôn fixed/local và được gắn nhãn rõ.
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

AI inference, provider adapters, real orchestration, web search, uploads, real calculations, Google/Supabase auth, BYOK, persistence, payments, subscriptions, analytics, deployment và production privacy/compliance claims.

## Risk / recovery

- Risk: copy làm giả production, localization stale, hydration mismatch, dialog focus regression, unsupported claims.
- Risk responsive: unlayered component CSS (`.button-primary`, `.icon-button`) đè Tailwind layered utilities nên `hidden`/`sm:inline-flex` bị bỏ qua — dùng semantic class unlayered riêng (`.header-cta`, `.header-settings`, `.header-menu`) với `display` tường minh trong media query.
- Risk font: khai báo tên font mà không nạp file thật khiến browser fallback từng ký tự; `Fraunces` không có sẵn nên heading rơi về `Georgia` với dấu tiếng Việt rất yếu. Recovery: dùng `next/font` với `subsets` chứa `vietnamese` và fallback có dấu.
- Risk font: `next/font/google` cần mạng lúc build để tải và cache font. Nếu build offline không có cache, build fail — recovery: dùng `next/font/local` với file đặt sẵn trong repo, không thêm dependency.
- Recovery: revert PR/commit trên branch task; không reset/stash/xóa thay đổi worktree khác.

## OPEN / delegated

- Required GitHub checks và ruleset được xác nhận sau khi push PR mới.
- Không deploy, cấu hình cloud, tạo account/provider hoặc dùng secret.
