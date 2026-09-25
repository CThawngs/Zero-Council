# TODO — Zero Council responsive polish

Cập nhật: 2026-09-25. Governance: v7.1.
Worktree: `.worktrees/responsive-polish`; branch: `responsive-polish`; base `c8c1e68` (`origin/main` sau PR #5 merge).

## Cấp 1 — Mục tiêu

- [x] Audit responsive mobile/tablet/desktop trên source hiện tại.
- [x] Sửa header không còn overflow/đè control ở mọi width; menu panel dùng được dưới 64rem.
- [x] Giữ EN/VI localization, accessibility (dialog, focus, 44px, reduced motion) và truth boundary local mock.
- [x] Không thêm dependency, không đổi mock output, không thêm persistence/analytics/payment.

## Cấp 2 — Thành phần

- [x] `.content-shell` dùng `min(100%, 72rem)`; bỏ `100vw` ở modal dùng `calc(100% - gutter)`.
- [x] Header: CTA/settings/menu theo breakpoint qua semantic class unlayered; nav desktop từ 64rem.
- [x] Mobile nav panel: absolute, `max-height: calc(100dvh - 76px)`, scroll, focus trap, Escape/outside close, focus return.
- [x] Long-text/overflow ở Personas, New advisor, Session active/concluded, Sidebar, Toast, Framework/Counter dialog.
- [x] Input `font-size: 1rem` để iOS không zoom khi focus.

## Cấp 3 — Kiểm chứng

- [x] `pnpm lint`, `pnpm exec tsc --noEmit`, `pnpm build` exit `0` trên final source.
- [x] `node --test tests/budget.test.mjs` → `2 pass, 0 fail`; `git diff --check` sạch.
- [x] Browser QA: header/workspace ở 320/360/375/390/414/600/640/768/900/1024/1280/1440 không overflow; CTA/menu đúng breakpoint.
- [x] Browser QA: VI 320–1280 `lang="vi"`, không overflow; long question không vỡ layout.
- [x] Browser QA: menu Tab-trap loop, outside click đóng, Escape đóng + focus về menu button.
- [x] Browser QA: dialog width 320/375/640/768/1024, không overflow, focus return.
- [x] Browser QA: reduced motion → transition/animation `1e-05s`; console không error/warning.
- [x] Browser QA: không fetch/XHR/WebSocket từ app; localStorage/sessionStorage/cookie rỗng; IDB chỉ có `__next_debug_channel` của Next dev tooling.
- [x] Lighthouse snapshot: mobile và desktop đều Accessibility/Best Practices/SEO/Agentic Browsing `100`, `0` failed.
- [x] Audit subagent: không có finding sau các sửa; mọi thay đổi đều nhỏ và không thêm abstraction.

## Cấp 4 — Git

- [x] Commit source + governance docs trên `responsive-polish`.
- [x] Push branch và tạo PR mới vào `main` (không dùng PR #4, không mở lại PR #5).
- [x] Inspect required checks/ruleset; self-merge PR mới khi final status clean.
- [ ] Dừng QA server trước bàn giao.

## Ngoài scope

- [ ] AI inference, provider adapters, web search, uploads, real framework calculations.
- [ ] Google/Supabase auth, session, persistence, BYOK runtime.
- [ ] Payments, subscriptions, checkout, billing, analytics, deployment.

Không mở hạng mục ngoài scope trong PR responsive này.
