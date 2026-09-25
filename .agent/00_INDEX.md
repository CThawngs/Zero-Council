# 00_INDEX — Zero Council

Governance: v7.1. Cập nhật: 2026-09-25.

## Workspace hiện tại

- Task worktree: `.worktrees/responsive-polish`
- Branch: `responsive-polish`
- Base: `origin/main` tại `c8c1e68` (PR #5 đã merge làm base)
- Remote: `https://github.com/CThawngs/Zero-Council.git`
- Main checkout và worktree `feature-prototype-ui-integration` không sửa.
- Worktree `ui-ux-local-mock` (PR #5, đã merge) không sửa/xóa.

## File agent

- `AGENTS.md`: quy tắc dự án.
- `.agent/GOVERNANCE.md`: governance v7.1.
- `.agent/SPEC.md`: phạm vi và ranh giới local mock hiện tại.
- `.agent/TODO.md`: checklist task hiện tại.
- `.agent/HANDOFF.md`: scope, evidence, kiểm chứng và PR state.

## Hiện trạng

- `/` là giao diện song ngữ local mock, dùng React/browser memory.
- `/fixture` chỉ hiển thị văn bản minh họa cố định.
- `/api/council` là fixed fixture route; giao diện `/` không gọi route này.
- Không có AI, provider request, auth, credential, payment, analytics, persistence hoặc deploy.
- Provider/model chỉ là nhãn giao diện; paid/auth surfaces không được provision.
- Copy người dùng không được phân tích; mọi walkthrough dùng fixture cố định.
- Không thêm dependency mới; `lucide-react` là dependency icon duy nhất.
- Responsive hiện tại: header CTA/settings từ 40rem, menu panel dưới 64rem, desktop nav từ 64rem; content shell dùng `min(100%, 72rem)`; modal dùng `calc(100% - gutter)` thay `100vw`.

## Verify

- Lint, TypeScript, production build, budget test, browser QA và Lighthouse: xem `HANDOFF.md` sau khi commit.
- Không dùng evidence cũ của PR #4 hoặc PR #5 cho source hiện tại.
- PR mới chỉ merge sau khi mọi required check bắt buộc pass.
