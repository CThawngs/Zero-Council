# TODO — Zero Council

Cập nhật: 2026-09-24. Governance: v7.1. Worktree: `.worktrees/feature-prototype-ui-integration`.

## Cấp 1 — Mục tiêu

- [X] Tích hợp prototype UI tại `/`; giữ fixture cũ tại `/fixture`
- [X] English mặc định; giữ toggle Vietnamese
- [X] Giữ rõ ranh giới mock, không giả AI/auth/payment/provider/credential

## Cấp 2 — Thành phần tích hợp

- [X] Copy prototype vào `web/src/prototype/`
- [X] Nối `web/src/app/page.tsx` vào `PrototypeApp`
- [X] Tạo route `/fixture`
- [X] Thêm `lucide-react` làm dependency icon duy nhất
- [X] Audit accessibility, keyboard controls, heading order, contrast

## Cấp 3 — Kiểm chứng

- [X] `pnpm lint` từ `web/`
- [X] `pnpm exec tsc --noEmit` từ `web/`
- [X] `pnpm build` từ `web/`
- [X] `node --test tests/budget.test.mjs` từ repo root
- [X] Browser QA mobile/desktop, navigation, modal/drawer flows, storage/network/console
- [X] Commit source evidence: `8df4160` (docs follow-up records final tree)

## Cấp 4 — Git

- [ ] Commit source + governance docs trên `feature/prototype-ui-integration`
- [ ] Push branch
- [ ] Mở PR vào `main`
- [ ] Kiểm tra PR open, CI/review state; không merge

## Ngoài scope

- [ ] Supabase/Google OAuth runtime
- [ ] Provider/model inference, BYOK credential flow
- [ ] Payment rail, invoice, webhook, deployment
- [ ] Persistence, uploads, search, real account state

Không tự mở các hạng mục ngoài scope khi demo prototype.
