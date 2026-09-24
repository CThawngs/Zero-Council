# 00_INDEX — Zero Council

Governance: v7.1. Cập nhật: 2026-09-24.

## Workspace hiện tại

- Main checkout: `C:\Users\nguye\OneDrive\Documents\Projects\Zero-Council`
- Task worktree: `.worktrees/feature-prototype-ui-integration`
- Branch: `feature/prototype-ui-integration`
- Remote: `https://github.com/CThawngs/Zero-Council.git`
- Không merge PR và không sửa main checkout.

## File agent

- `AGENTS.md`: quy tắc dự án.
- `.agent/GOVERNANCE.md`: governance v7.1.
- `.agent/SPEC.md`: yêu cầu sản phẩm lịch sử và task addendum prototype UI.
- `.agent/TODO.md`: checklist task hiện tại.
- `.agent/HANDOFF.md`: scope, evidence, ranh giới runtime và bàn giao.

## Hiện trạng prototype

- `/` dùng `web/src/prototype/App.tsx`, UI-only local mock.
- `/fixture` giữ fixture tiếng Việt cũ.
- `/api/council` vẫn là fixed fixture route; prototype không gọi network.
- Không có AI, auth, payment, provider, credential, persistence hoặc deploy trong task.
- Chỉ thêm dependency `lucide-react@0.546.0`.

## Verify hiện tại

- Lint, TypeScript, production build, budget test đã chạy trên worktree trước commit cuối; xem `HANDOFF.md`.
- Browser QA đã kiểm mobile, navigation, modal/drawer, storage, network và console.
- Commit/push/PR còn tiếp theo. Không merge.
