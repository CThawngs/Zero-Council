# Thiết lập local — Zero Council UI mock

Bản này chỉ chạy giao diện local với dữ liệu mẫu cố định. Không cần tài khoản, API key, cloud project, database, auth, payment hoặc provider.

## Chạy

Yêu cầu: Node 24 LTS (đã thử v24.18.0), pnpm 11.5.2. Tại repo root:

```sh
pnpm --dir web install --frozen-lockfile
pnpm --dir web dev
```

Mở URL terminal báo, mặc định `http://localhost:3000`.

- `/`: giao diện song ngữ, state mẫu trong React/browser memory.
- `/fixture`: fixture song ngữ cố định.
- `/api/council`: route fixture riêng; UI `/` không gọi route này.

## Kiểm tra trước PR

```sh
node --test tests/budget.test.mjs
pnpm --dir web lint
pnpm --dir web exec tsc --noEmit
pnpm --dir web build
```

## Ranh giới runtime

- Không có model/provider call, real orchestration, web search, upload hoặc tính toán khung.
- Không có Supabase, Google OAuth, session, credential input, BYOK runtime, payment, billing, analytics, server storage hoặc deployment.
- Câu hỏi tùy ý chỉ mở fixed generic illustrative text; không phải tư vấn chuyên môn.
- Refresh đặt lại state trình duyệt.

## Tài liệu hiện hành

- [Spec](../.agent/SPEC.md): phạm vi và tiêu chí chấp nhận.
- [Handoff](../.agent/HANDOFF.md): evidence và trạng thái PR.
- [Governance](../.agent/GOVERNANCE.md): quy tắc repository.

Không tạo cloud project, credential hoặc tài khoản ngoài khi có scope và quyền cụ thể.
