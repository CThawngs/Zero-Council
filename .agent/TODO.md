# TODO — Zero Council UI/UX local mock

Cập nhật: 2026-09-25. Governance: v7.1.
Worktree: `.worktrees/ui-ux-local-mock`; branch: `ui-ux-local-mock`.

## Cấp 1 — Mục tiêu

- [x] `/` dùng polished local mock với responsive desktop/mobile.
- [x] English mặc định; toggle Vietnamese đầy đủ cho copy và metadata.
- [x] Không giả AI, provider, auth, BYOK, payment, analytics, persistence hoặc deploy.
- [x] Input tùy ý chỉ mở fixed generic fixture; không cá nhân hóa khuyến nghị.

## Cấp 2 — Thành phần

- [x] Ranh giới mock/fixed sample hiển thị rõ trong UI.
- [x] Persona configuration dùng model/provider labels; không credential input.
- [x] Paid/auth surfaces không provision và không có dữ liệu định danh/billing giả.
- [x] Native `<dialog>` cho framework, draft, clear-state confirmations.
- [x] Focus return, Escape, backdrop close, 44px controls, focus-visible, reduced motion.
- [x] `/fixture` bilingual fixed text; `/api/council` fixed English fixture.
- [x] Không thêm dependency ngoài `lucide-react`.

## Cấp 3 — Kiểm chứng

- [x] Chạy lại `pnpm lint`, `pnpm exec tsc --noEmit`, `pnpm build` trên final source.
- [x] Chạy `node --test tests/budget.test.mjs` và `git diff --check`.
- [x] Browser QA final source: language, persona submit, dialogs, clipboard, reduced motion, responsive widths, console/network/storage.
- [x] Lighthouse final source không có failed audit.
- [x] Cập nhật evidence sau commit; không dùng evidence cũ.
- [x] Audit subagent không có finding sau khi sửa modal close target; target đo `44×44px`.

## Cấp 4 — Git

- [x] Commit source + governance docs trên `ui-ux-local-mock`.
- [ ] Push branch và tạo PR mới vào `main` (không dùng PR #4).
- [ ] Chờ required checks pass; self-merge PR mới khi ruleset cho phép.
- [ ] Dừng QA server trước bàn giao.

## Ngoài scope

- [ ] AI inference, provider adapters, web search, uploads, real framework calculations.
- [ ] Google/Supabase auth, session, persistence, BYOK runtime.
- [ ] Payments, subscriptions, checkout, billing, analytics, deployment.

Không mở hạng mục ngoài scope trong PR local mock này.
