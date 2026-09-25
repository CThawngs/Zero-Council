# TODO — Zero Council Vietnamese font fix

Cập nhật: 2026-09-25. Governance khi lập: v7.1. Repo đã lên v7.4 ngày 2026-09-26 (PR #8); checklist này chưa rà lại dưới v7.4.
Worktree: `.worktrees/vi-font-fix`; branch: `vi-font-fix`; base `49ec347` (`origin/main` sau PR #6 merge).

## Cấp 1 — Mục tiêu

- [x] Xác định nguyên nhân thật: font khai báo trong CSS nhưng không được nạp, nên browser fallback.
- [x] Nạp font thật qua `next/font` (built-in Next, không thêm dependency).
- [x] Bảo đảm dấu tiếng Việt render bằng glyph thật, không phải fallback từng ký tự.
- [x] Giữ nguyên localization EN/VI, accessibility, truth boundary local mock, không thêm persistence/analytics/payment.

## Cấp 2 — Thành phần

- [x] `web/src/app/fonts.ts` mới: `Inter` + `Fraunces`, `subsets: ['latin','vietnamese']`, `display: 'swap'`, expose `--font-inter` / `--font-fraunces`.
- [x] `layout.tsx` gắn `sans.variable` + `serif.variable` vào `<html>`.
- [x] `globals.css`: `--font-sans` / `--font-serif` trỏ vào biến `next/font`; fallback dùng font có dấu tiếng Việt.
- [x] Bỏ `, Georgia, serif` thừa ở `.page-header h1` và `.panel-title` (đã có trong fallback chain).
- [x] Không thêm dependency mới; `lucide-react` vẫn là dependency icon duy nhất.

## Cấp 3 — Kiểm chứng

- [x] `pnpm lint` exit `0`.
- [x] `pnpm exec tsc --noEmit` exit `0`.
- [x] `pnpm build` exit `0`; 10 file `.woff2` self-host trong `.next/static/media/`.
- [x] `node --test tests/budget.test.mjs` → `2 pass, 0 fail`; `git diff --check` sạch.
- [x] Browser: `document.fonts` có `Inter` và `Fraunces` ở trạng thái `loaded`; CSS variable resolve đúng tên font.
- [x] Browser: pixel signature chứng minh glyph tiếng Việt được vẽ bởi chính family, khác `monospace`; `Fraunces` khác `Georgia` (bug cũ đã hết).
- [x] Browser: không có external request; không có request tới `fonts.googleapis.com` / `fonts.gstatic.com`.
- [x] Browser: VI toggle → `lang="vi"`, không mojibake `U+FFFD`, heading đọc đúng dấu.
- [x] Browser: 12 width 320–1440 không overflow, header giữ 76px, control nằm trong viewport.
- [x] Lighthouse mobile: Accessibility / Best Practices / SEO / Agentic Browsing đều `100`, `0` failed.
- [x] Console không error.

## Cấp 4 — Git

- [x] Commit source + governance docs trên `vi-font-fix`.
- [x] Push branch và tạo PR mới vào `main`.
- [x] Inspect required checks/ruleset; self-merge khi final status clean.
- [ ] Dừng QA server trước bàn giao.

## Ngoài scope

- [ ] AI inference, provider adapters, web search, uploads, real framework calculations.
- [ ] Google/Supabase auth, session, persistence, BYOK runtime.
- [ ] Payments, subscriptions, checkout, billing, analytics, deployment.

Không mở hạng mục ngoài scope trong PR font này.
