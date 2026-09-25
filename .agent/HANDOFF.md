# HANDOFF — Zero Council responsive polish

Cập nhật: 2026-09-25. Governance: v7.1.

## Git và phạm vi

- Worktree: `C:\Users\nguye\OneDrive\Documents\Projects\Zero-Council\.worktrees\responsive-polish`
- Branch: `responsive-polish`
- Base: `c8c1e68` (`origin/main` tại task start, sau khi PR #5 merge)
- Remote: `https://github.com/CThawngs/Zero-Council.git`
- Main checkout, worktree `feature-prototype-ui-integration` và worktree `ui-ux-local-mock` unchanged.
- Không merge PR #4; PR #5 đã merge trước task này và không được mở lại.

## Đã triển khai (task này)

Chỉ sửa responsive/layout; không đổi nội dung mock, không thêm dependency, không thêm persistence/analytics/payment.

- `web/src/app/globals.css`
  - `.zc-modal` width `min(42rem, calc(100% - 2rem))` (mobile `calc(100% - 1rem)`) thay `100vw` để không bị scrollbar overflow.
  - `.content-shell` width `min(100%, 72rem)`; mobile `100%`.
  - Thêm `.mobile-navigation-panel` (absolute, `top:100%`, `max-height: calc(100dvh - 76px)`, `overflow-y:auto`, `overscroll-behavior:contain`).
  - Thêm semantic unlayered classes `.header-cta/.header-settings/.header-menu` với `display:none` mặc định; `min-width:40rem` hiện CTA/settings; `max-width:64rem` hiện menu; `min-width:64rem` ẩn menu và cho `.header-nav .nav-link{width:auto}`.
  - `.field input/select/textarea` `font-size:1rem` (iOS không zoom khi focus).
- `web/src/prototype/components/Header.tsx`
  - Header row `h-[75px]`; brand `min-h-11 min-w-0 shrink-0`; nav `header-nav hidden … lg:flex`.
  - Controls dùng `.header-compact-control`, `.header-settings`, `.header-cta`, `.header-menu`.
  - Focus trap chỉ bên trong mobile nav panel; Escape đóng và trả focus về menu button; pointerdown ngoài header đóng panel; đóng khi vượt 64rem.
- `PersonasView`, `NewAdvisorView`, `SessionActiveView`, `SessionConcludedView`, `Sidebar`, `Toast`, `FrameworkModal`, `CounterDraftModal`, `EmptyChamberView`: thêm `min-w-0`, `truncate`/`break-words`, `shrink-0` icon, `content-shell` width, form buttons full-width dưới `sm`, sidebar `h-[calc(100dvh-76px)]`.

## Ranh giới runtime (không đổi)

- Client UI không có `fetch`, XHR, WebSocket, storage API, provider/model call, auth, payment, analytics, server persistence.
- State mẫu trong React/browser memory, reset khi refresh.
- `/api/council` là fixed fixture route, prototype `/` không gọi.
- Không claim ISO/compliance, encryption, accuracy, latency, confidence, ranking, conversion, ROI hay hiệu quả chuyên môn.
- Không thêm dependency ngoài `lucide-react`.

## Evidence

Source commit: `b859caca4c78f921903ece476253682d935e79cb` (`fix(web): make responsive layout hold at 320-1440px`, branch `responsive-polish`).

Evidence bên dưới được chạy trên đúng source commit này; chỉ có dòng `Git / PR` của chính file này được cập nhật sau commit và không đổi runtime source. Tất cả lệnh chạy tại worktree `responsive-polish`, `web/` trừ budget/diff ở root.

### Static (exit `0`)

- `pnpm lint` — exit `0`.
- `pnpm exec tsc --noEmit` — exit `0`.
- `pnpm build` — exit `0`; Next `16.3.5` compiled successfully, static pages generated; routes `/`, `/_not-found`, `/fixture` static + `/api/council` dynamic.
- `node --test tests/budget.test.mjs` — `2 pass, 0 fail`.
- `git diff --check` — sạch.

### Browser QA (dev server `http://127.0.0.1:3210`, Playwright)

- Header/workspace ở 320/360/375/390/414/600/640/768/900/1024/1280/1440: `documentElement.scrollWidth == innerWidth`, `headerHeight == 76`, không element nào tràn ngang; public controls kết thúc ≤ `width-16`.
- Breakpoint: dưới 640 CTA ẩn (chỉ language/theme/menu); 640–1023 CTA/settings + menu; ≥1024 desktop nav hiện, menu ẩn.
- Workspace vào được ở ≥640; dưới 640 đi qua mobile menu `New sample`.
- VI (`Switch to Vietnamese`) ở 320/375/414/640/768/1024/1280: `documentElement.lang="vi"`, `scrollWidth == width`, không offender.
- Long question (240 ký tự không space) + submit ở 320/375/390/640/768/1024: `scrollWidth == width`, không offender, title wrap.
- Mobile menu 320: panel top `75`, width `320`, không overflow, focus vào item đầu; Tab loop giữ trong panel; Escape đóng + focus về `Menu`, `aria-expanded="false"`; pointerdown ngoài đóng panel.
- Dialog framework mở ở 320/375/640/768/1024: width `304/359/624/672/672`, `left/right` trong viewport, `scrollWidth == width`, body content không overflow; Escape đóng.
- Reduced motion (`prefers-reduced-motion: reduce`): transition/animation `1e-05s`.
- Console: không error/warning (chỉ React DevTools info + HMR log của dev server).
- Network: chỉ same-origin `_rsc` prefetch của Next; không có application fetch/XHR/WebSocket/API call.
- Storage: `localStorage`, `sessionStorage`, `document.cookie` rỗng; `indexedDB.databases()` chỉ có `__next_debug_channel` (Next dev tooling, không phải app).

### Lighthouse (chrome-devtools, snapshot mode)

- Mobile: Accessibility `100`, Best Practices `100`, SEO `100`, Agentic Browsing `100`; `33` passed, `0` failed.
- Desktop: cùng điểm; `33` passed, `0` failed.

## Git / PR

- Không merge PR #4; PR #5 đã merge trước task này và không được mở lại.
- Source commit: `b859caca4c78f921903ece476253682d935e79cb`.
- Branch `responsive-polish` push và tạo PR mới vào `main` sau final QA; PR number, required checks và ruleset status ghi sau khi push.
- Self-merge PR mới chỉ sau khi xác nhận `mergeStateStatus=CLEAN`, không có required check pending và ruleset cho phép.

## Bàn giao

1. Stage source + governance docs; loại toàn bộ `web/*.log` khỏi staging.
2. Commit final source/docs.
3. Push `responsive-polish`, tạo PR mới vào `main`.
4. Chờ required checks, merge PR mới nếu được phép, rồi dừng QA server.

## ZeroVault

- Đã refresh/search/load skill responsive liên quan trong session.
- Đã persist lesson `2026-09-25-responsive-polish-unlayered-css` (ZeroVault commit `aea7baa5a9033aadcff68bbd78dc6d5d3787bc62`).
