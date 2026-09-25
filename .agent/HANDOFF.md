# HANDOFF — Zero Council Vietnamese font fix

Cập nhật: 2026-09-25. Governance: v7.1.

## Git và phạm vi

- Worktree: `C:\Users\nguye\OneDrive\Documents\Projects\Zero-Council\.worktrees\vi-font-fix`
- Branch: `vi-font-fix`
- Base: `49ec347` (`origin/main` tại task start, sau khi PR #6 merge)
- Remote: `https://github.com/CThawngs/Zero-Council.git`
- Main checkout và các worktree khác (`responsive-polish`, `ui-ux-local-mock`, `feature-prototype-ui-integration`) unchanged.
- Không mở lại PR #4, #5 hoặc #6.

## Nguyên nhân (đã kiểm chứng, không phải giả định)

`globals.css` khai báo `--font-sans: "Inter"` và `--font-serif: "Fraunces"`, nhưng repo **không có** `next/font`, `@font-face` hay file `.woff2` nào. Tên font chỉ là chuỗi trong stack nên browser luôn fallback.

Đo bằng canvas `measureText` với tên font giả (`__zzz__`) làm mốc:

- `Fraunces` cho width giống hệt tên font giả → **không được cài**. Mọi heading serif vì thế rơi về `Georgia`.
- `Georgia` có dấu tiếng Việt nhưng thiết kế dấu rất yếu, khớp với ảnh báo lỗi của bạn.
- `Inter` tình cờ có sẵn trên máy này, nên phần sans nhìn ổn và che mất vấn đề.

## Đã triển khai (task này)

- `web/src/app/fonts.ts` (mới): `Inter` + `Fraunces` qua `next/font/google`, `subsets: ['latin', 'vietnamese']`, `display: 'swap'`, expose `--font-inter` / `--font-fraunces`.
- `web/src/app/layout.tsx`: gắn `sans.variable` + `serif.variable` vào `<html>`.
- `web/src/app/globals.css`: `--font-sans` / `--font-serif` trỏ vào biến trên; fallback dùng font có dấu tiếng Việt tốt (`system-ui`, `Segoe UI`, `Iowan Old Style`, `Palatino Linotype`, `Palatino`).
- `globals.css`: bỏ `, Georgia, serif` thừa ở `.page-header h1` và `.panel-title` (đã nằm trong fallback chain).
- Không thêm dependency; không đổi nội dung copy, không đổi layout, không đổi truth boundary.

## Ranh giới runtime (không đổi)

- Không có fetch/XHR/WebSocket từ UI, không có storage API, không có provider call, auth, payment, analytics.
- `next/font` tải và self-host font ở **build time**; runtime không có request ra ngoài origin.
- Build cần mạng lần đầu để tải font. Nếu build offline không có cache sẽ fail; recovery là `next/font/local` với file đặt sẵn.

## Evidence

Source commit: `eec591be938d8cf1108bd6de4b8e600f16f9bdd7` (`fix(web): load Inter and Fraunces with the Vietnamese subset`, branch `vi-font-fix`).

Evidence dưới đây chạy trên đúng source commit này. Commit kế tiếp chỉ cập nhật dòng SHA trong chính file handoff này và không đổi runtime source. Tất cả lệnh chạy tại worktree `vi-font-fix`, `web/` trừ budget/diff ở root.

### Static

- `pnpm install --frozen-lockfile` — exit `0`, không thêm dependency.
- `pnpm lint` — exit `0`.
- `pnpm exec tsc --noEmit` — exit `0`.
- `pnpm build` — exit `0`; compiled successfully, static pages generated.
- 10 file `.woff2` trong `.next/static/media/` → font được self-host, không phải link ngoài.
- `node --test tests/budget.test.mjs` — `2 pass, 0 fail`.
- `git diff --check` — sạch.

### Browser QA (dev server `http://127.0.0.1:3212`, Playwright)

- `document.fonts` liệt kê `Inter` và `Fraunces` ở trạng thái `loaded`, weight range `100 900`.
- `html` class chứa `inter_…-module__…__variable` và `fraunces_…-module__…__variable`.
- Computed `h1` = `Fraunces, "Fraunces Fallback", "Iowan Old Style", …`; computed `body` = `Inter, "Inter Fallback", system-ui, …`.
- Pixel signature (canvas render + hash): chữ với `Ủy quyền riêng tư — Giao diện hội đồng cục bộ` và bộ dấu nặng `Ỷ Ỵ ỹ Ặ ặ ẫ ầ ễ ệ ọ ỏ` khác `monospace` → browser không thay glyph từng ký tự.
- `Fraunces` render khác `Georgia` → bug fallback Georgia đã hết.
- `h1` serif và `body` sans cho hai pixel signature khác nhau → không nhầm font.
- Request audit: `externalRequests: []` — không có request ra ngoài `http://127.0.0.1:3212`, không có `fonts.googleapis.com` / `fonts.gstatic.com`.
- VI toggle: `documentElement.lang = "vi"`, title `Zero Council — Giao diện hội đồng cục bộ`, heading `Cấu trúc lựa chọn khó.` đúng dấu, `hasMojibake: false` (không có `U+FFFD`).
- Layout regression 320/360/375/390/414/600/640/768/900/1024/1280/1440: `scrollWidth == innerWidth`, `offenders: []`, `headerH: 76`, `maxCtrlRight <= width - 16` ở mọi width.
- Console: không error.

### Lighthouse (chrome-devtools, snapshot mode)

- Mobile: Accessibility `100`, Best Practices `100`, SEO `100`, Agentic Browsing `100`; `33` passed, `0` failed.

## Git / PR

- Source commit: `eec591be938d8cf1108bd6de4b8e600f16f9bdd7`.
- Không mở lại PR #4, #5, #6.
- PR number, required checks và ruleset status: ghi sau khi push.
- Self-merge PR mới chỉ sau khi xác nhận `mergeable=MERGEABLE`, `mergeStateStatus=CLEAN`, không có required check pending và ruleset cho phép.

## Bàn giao

1. ~~Stage source + governance docs.~~ — xong.
2. ~~Commit final source/docs.~~ — xong.
3. Push `vi-font-fix`, tạo PR mới vào `main`, kiểm tra checks rồi merge nếu sạch.
4. Dừng QA server trước khi kết thúc.

## ZeroVault

- Đã refresh/search/load skill liên quan trong session.
- Persist lesson về font fallback tiếng Việt và cách kiểm chứng bằng pixel signature: xem mục sau khi commit.
