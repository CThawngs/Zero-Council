# Zero Council

Website hội đồng AI hỗ trợ ra quyết định — Đồ án Chuyên ngành, lớp 25C2-LTM1.
Nhóm: Nguyễn Chí Thắng, Lê Tấn Minh Tâm, Đào Nguyên Anh.

## Trạng thái

Scaffold Next.js 16.3.5 / React 19.2.8 / TypeScript / Tailwind 4 tại `web/`.
Trang tiếng Việt có hội đồng và phân tích **viết sẵn**, nút mở/ẩn; không gọi model, không thu/lưu dữ liệu người dùng.
**Chưa có** chat tự do, fan-out thật, auth Google, Supabase/session, upload, BYOK runtime, web search hoặc decision framework chạy thật. Không dùng scaffold làm production.

## Chạy

Node 24 LTS, pnpm 11.5.2. Tại repo root:

```sh
pnpm --dir web install --frozen-lockfile
pnpm --dir web dev
```

URL mặc định http://localhost:3000; xem terminal nếu port bận. Không cần API key để xem mẫu.

```sh
node --test tests/budget.test.mjs
pnpm --dir web lint
pnpm --dir web build
```

Guard giá ở `src/lib/budget.mjs` kiểm quote chi phí nhóm, chưa nối app/provider và không chặn user BYOK trả phí.

## Tài liệu

- [Thiết lập Supabase Free và Google OAuth](docs/SETUP.md) — chủ dự án tự tạo project.
- [Spec](.agent/SPEC.md) — đọc cập nhật S4 trước các OPEN lịch sử.
- [Bàn giao](.agent/HANDOFF.md) — evidence và phần chưa kiểm.
- [Quy trình](AGENTS.md).

Thay đổi qua nhánh task/PR. Không commit secret hoặc `.env.local`; không bật dịch vụ trả phí với ngân sách nhóm 0 USD. Chưa chọn license; repo public không đồng nghĩa được cấp license mã nguồn mở.
