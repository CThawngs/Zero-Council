# 00_INDEX — Zero Council

Governance: v7.4. Cập nhật: 2026-09-26.

## Workspace hiện tại

- Task worktree: `.worktrees/vi-font-fix`
- Branch: `vi-font-fix`
- Base: `origin/main` tại `49ec347` (PR #6 đã merge làm base)
- Remote: `https://github.com/CThawngs/Zero-Council.git`
- Main checkout và các worktree khác (`responsive-polish`, `ui-ux-local-mock`, `feature-prototype-ui-integration`) không sửa/xóa.

## File agent

- `AGENTS.md`: quy tắc dự án — 20 rule theo Phụ lục A của governance v7.4. Chỉ khác mẫu ở rule 14 (thêm câu giữ style ngắn gọn của dự án); các rule khác nguyên văn.
- `.agent/GOVERNANCE.md`: governance v7.4, lưu nguyên văn từ `Temporary/prompts/autonomous-governance-v7.4.md`. SHA256 bản nguồn trên máy Windows: `1CBEB340619DBAFC676823D16F28DAE41D319F4A3A4D5CC9D92DB1AF9A58E07F` — hash này phụ thuộc CRLF, chỉ dùng để so trên cùng nền tảng; git blob chuẩn hoá LF trong repo là `389d4df192150ac73a684a4ba498ecbfebb0bd1d`. Bản trước trong repo chỉ là 14 rule rút gọn (29 dòng), không phải nguyên văn; nay chỉ còn trong git history.
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
- Font: `Inter` (sans) + `Fraunces` (serif) nạp qua `next/font/google` trong `web/src/app/fonts.ts` với subset `latin` + `vietnamese`, tự self-host ở build. Không có request tới Google khi chạy.

## File governance v7.4 yêu cầu nhưng chưa có — OPEN, owner: chủ dự án

- `.agent/skills/verify-app/` + `features/`, `.agent/FEATURE_MAP.md` (mục 28.2, 32.2–32.4): chưa sinh. Rule 15 và 19 của `AGENTS.md` **chưa thi hành được** tới khi có skill.
- `.agent/SOURCES.md` (28.3): chưa có. Giá, thương hiệu, chính sách nếu xuất hiện phải hỏi hoặc ghi OPEN, không đoán.
- `.agent/DECISIONS.md`: chưa có; quyết định hiện nằm trong handoff/index.
- `ci/verify-smoke.config.yml` + `.github/workflows/verify-smoke.yml` (32.6): chưa cài.

## Lịch sử governance

- v7.1 → v7.4 (2026-09-26, PR #8): lưu nguyên văn v7.4; `AGENTS.md` lấy lại 20 rule Phụ lục A. Kiểm tĩnh PASS bằng `check-governance-v7.py` (32 mục, 3 phụ lục, 25 tình huống, 127 mệnh đề) — chỉ kiểm cấu trúc tĩnh; hành vi agent và sẵn sàng vận hành vẫn UNVERIFIED. Một assert trong script (giữ bản cũ để so sánh) không kiểm được vì máy không có file v7.3; dòng "previous versions retained" trong output khi đó **không còn được kiểm chứng**.

## Verify

- Lint, TypeScript, production build, budget test, browser QA và Lighthouse: xem `HANDOFF.md` sau khi commit.
- Không dùng evidence cũ của PR #4, #5 hoặc #6 cho source hiện tại.
- PR mới chỉ merge sau khi mọi required check bắt buộc pass.
