# HANDOFF — Zero Council product voice, Literata, brass-only hero

Cập nhật: 2026-09-26. Governance: v7.4. Worktree `vi-font-fix` và các worktree khác không đụng tới; handoff cũ của `vi-font-fix` giữ nguyên lịch sử ở commit trước.

## Git và phạm vi

- Worktree: `C:\Users\nguye\OneDrive\Documents\Projects\Zero-Council\.worktrees\product-voice-ui`
- Branch: `product-voice-ui`
- Base: `83ee993` (`origin/main` sau PR #9 merge)
- Remote: `https://github.com/CThawngs/Zero-Council.git`
- **Chưa push, chưa tạo PR** — chờ chủ dự án duyệt.

## Đã làm

1. Font: `Fraunces` → `Literata` (`web/src/app/fonts.ts`, weight 500/600, subset `latin` + `vietnamese`), Inter giữ nguyên; `globals.css` đổi `--font-serif` và bỏ fallback chain cũ.
2. Hero glow: thêm đúng một `.glow` brass theo spec; `CouncilOrb` 4 node chuyển sang cùng hue brass, phân cấp bằng opacity; bỏ `--node-color`.
3. Theme toggle: xoá hẳn khỏi `Header`, `SettingsView`, `AppContext` (`Theme`/`toggleTheme`), `types.ts`, và bỏ khối palette `html.light` trong `globals.css`.
4. Copy: viết lại toàn bộ EN + VI trong `i18n.ts`; xoá key chết; header không còn dòng phụ dưới logo; nav public = How it works / Why Zero Council / Pricing; hero, 3 card How-it-works, 3 card framework, section mới "Why Zero Council" (thay cho access map), footer `© 2026 Zero Council.`
5. `PricingView` được render thật (`App.tsx`, view `pricing` là public page).
6. Hydration mismatch: `<body suppressHydrationWarning>` tại `layout.tsx` — do extension (Grammarly) chèn `data-gr-ext-installed` / `cz-shortcut-listen` vào `<body>`, không phải code app.
7. `/fixture` + `council-fixture.ts` chuyển từ "illustrative" sang "reference".

## Evidence (trên working tree này, chưa commit lúc ghi)

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

## OPEN

1. **Bảng giá thật** — chủ dự án nói sẽ gửi số; `PricingView` hiện chỉ có tiêu đề + câu "sẽ công bố tại đây". Không bịa số (rule 28.3).
2. **Claim vượt code** — landing copy giờ mô tả AI advisors, AES-256 BYOK, mã hoá hội thoại, "Start free council". Repo **không có** engine AI, không có provider call, không có auth, không có payment, không có persistence, không có mã hoá nào. Đây là quyết định của chủ dự án theo yêu cầu bỏ ngôn ngữ demo; nếu muốn thu hồi thì chỉ sửa `i18n.ts`.
3. Mô tả "cyan/magenta + streak lines" trong yêu cầu không khớp code: không có class `glow` hay màu cyan/magenta nào trong repo trước khi sửa; nguồn màu đa sắc là 4 node persona của `CouncilOrb`. Đã hiện thực hoá theo ý định "chỉ còn 1 hào quang brass".
4. `.agent/skills/verify-app/`, `features/`, `FEATURE_MAP.md` (rule 28.2/32) — chưa sinh, mở task riêng.

## Bàn giao

1. ~~Sửa code + docs~~ — xong.
2. Commit trên `product-voice-ui` — xong (chưa push).
3. Push + PR vào `main` — **cần chủ dự án duyệt**.
4. Dừng server tạm (3200/3201/3202) trước khi kết thúc.
