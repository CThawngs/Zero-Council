# HANDOFF — Zero Council prototype UI integration

Cập nhật: 2026-09-24. Governance: v7.1.

## Git và phạm vi

- Worktree: `C:\Users\nguye\OneDrive\Documents\Projects\Zero-Council\.worktrees\feature-prototype-ui-integration`
- Branch: `feature/prototype-ui-integration`
- Base: `52764ea8f3d52e82662374af133158b58196fa72` (`main` tại lúc bắt đầu)
- Remote: `https://github.com/CThawngs/Zero-Council.git`
- Prototype nguồn: `CThawngs/Prototype-UI-Zero-Council`, commit `fb0742e375ae82af9d494f757b82211b270ed857`
- Main checkout không bị sửa. Không merge PR.

## Đã tích hợp

- `/` render `web/src/prototype/App.tsx`; giữ navigation, view, visual system, modal/drawer, language/theme toggle và state React tạm.
- `/fixture` giữ fixture tiếng Việt cũ.
- `web/src/app/layout.tsx` đổi metadata sang prototype mock và English mặc định.
- `web/src/app/globals.css` mang theme variables của prototype.
- `lucide-react@0.546.0` là dependency mới duy nhất.
- Đã thêm accessible names, labels, `fieldset/legend`, `aria-pressed`, keyboard-safe session cards và heading/contrast fixes.
- Checkout không còn bank/account/company/memo/payment code; QR chỉ decorative `aria-hidden`, có cảnh báo sample-only.
- Provider slots chỉ đổi state mock; không có credential input, lưu, truyền hoặc provider request.

## Ranh giới runtime

- Client prototype không có `fetch`, XHR, WebSocket, storage API, auth, payment, model/provider call hoặc persistence.
- `/api/council` còn tồn tại như fixed fixture route của app; prototype tại `/` không gọi route đó.
- Tên model/provider là nhãn fixture. Checkout, billing, persona, settings và reset chỉ là local mock.
- Không deploy, tạo Supabase project, OAuth, CI, billing hoặc production account trong task này.

## Evidence

Các lệnh dưới đây chạy trên worktree trước commit cuối; sau commit phải ghi hash implementation vào bản HANDOFF tiếp theo:

- `pnpm lint` — pass, exit 0.
- `pnpm exec tsc --noEmit` — pass, exit 0.
- `pnpm build` — pass, exit 0; static `/`, static `/fixture`, dynamic `/api/council`.
- `node --test tests/budget.test.mjs` — 2 pass, 0 fail.
- Browser `http://127.0.0.1:3100/`, viewport `390x844`: `scrollWidth=390`, không overflow.
- Fresh reload: không console error/warning/issue; không XHR/fetch/WebSocket; `localStorage` và `sessionStorage` rỗng.
- Đã click: overview/sample session, round navigation, concluded synthesis, export toast, counter-draft, framework modal, settings language/theme, provider mock connection, pricing/checkout; `/fixture` cũng đã kiểm trước final edits.
- Accessibility snapshot xác nhận icon-only controls có accessible names; checkout có alert `SAMPLE ONLY — DO NOT TRANSFER MONEY`.

## Bàn giao

1. Commit source + docs, push branch.
2. Mở PR vào `main`; kiểm tra trạng thái open và checks/review nếu có.
3. Không merge.
4. Giữ worktree/branch cho review. ZeroVault lesson ghi sau khi PR mở.
