# HANDOFF — Zero Council

Cập nhật: 2026-09-18. Governance v7.0; SPEC nháp 0.2. Status: chờ review checkpoints; chưa có sản phẩm chạy.

## Evidence Git (mọi lệnh đã chạy trong phiên, ngày 2026-09-18)

- `pwd`: C:\Users\nguye\OneDrive\Documents\Projects\Zero-Council.
- Remote origin https://github.com/CThawngs/Zero-Council.git; `git ls-remote --symref` và `--heads` xác nhận remote trống trước push.
- GitHub MCP: tài khoản xác thực CThawngs, quyền push/admin; repo public, default branch dự kiến main.
- Local: commit 77ea08e trên docs/spec-foundation; test Node 2 pass; whitespace check đạt.
- Lỗi edit tại chỗ (old_string sai) được xử lý bằng viết lại HANDOFF; luôn đọc lại file trước khi thay nội dung.

## Quyết định đã chốt (S4 — vòng 3, 2026-09-18)

- Supabase mới là dự định chọn, chưa có project/schema. Không coi schema tồn tại.
- Ngân sách 0 USD chỉ cho nhóm; user tự BYOK tự chịu chi phí model trả phí.
- File đính kèm lưu theo session, xóa cùng session, có giới hạn dung lượng (ngưỡng cụ thể OPEN).
- S3: public, Google-only, session storage, hard-delete session.

## Việc đã và chưa

- Đã: checkpoint commit 77ea08e (5 tài liệu + guard/test 2 pass); v4 auto-select.
- Được ủy quyền: tạo main, push main đầu tiên, sau đó mọi thay đổi theo nhánh task + PR.
- Chưa: deploy, gọi model, tạo project Supabase, test runtime, cấu hình OAuth/Google/Supabase.
- Governance bản lưu có khác biệt với nguồn; chưa đối chiếu, chưa sửa trong task này.
