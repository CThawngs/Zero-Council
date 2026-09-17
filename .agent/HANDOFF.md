# HANDOFF — Zero Council

Cập nhật: 2026-09-18. Governance v7.0; SPEC 0.2. Status: chờ duyệt PR; chưa có sản phẩm chạy.

## Git đã kiểm bằng lệnh

- Remote origin https://github.com/CThawngs/Zero-Council.git, trước đó trống (`git ls-remote --symref`, `--heads`).
- GitHub MCP: CThawngs, push/admin; repo public.
- Push theo ủy quyền S4: `docs/spec-foundation:main` → main = 00a6102 (bootstrap, remote trống). Sau đó: task branch push riêng 7127bbd, tracking đã chuyển về `origin/docs/spec-foundation`.
- Lịch sử: 77ea08e checkpoint (tài liệu + guard/test) → 00a6102 handoff → 7127bbd index. `node --test tests/budget.test.mjs`: 2 pass, 0 fail (Node v24.18.0). Working tree sạch.
- Lỗi edit lần trước: old_string sai; quy tắc: đọc file trước khi sửa, sửa có kiểm chứng. Đã sửa 00_INDEX ngay sau push bằng commit mới; không force-push, không rewrite.

## Quyết định S4 (2026-09-18)

- Supabase: mới dự định chọn, chưa có project/schema; chưa tạo tài khoản/dịch vụ.
- 0 USD chỉ chi phí nhóm; user BYOK tự chịu chi phí model trả phí.
- File lưu theo session, xóa cùng session, giới hạn dung lượng (ngưỡng OPEN).

## Chưa làm / OPEN

- PR `docs/spec-foundation` → `main` để tự review lần đầu (diff 1 file). Merge sau khi người duyệt độc lập đạt; self-review không thay phê duyệt bắt buộc.
- Chưa: deploy, gọi model, tạo Supabase, cấu hình OAuth, CI ruleset. Governance bản lưu chưa đối chiếu nguyên văn.
- OPEN: ngưỡng dung lượng file, provider đầu tiên (Google-only, chưa có key), demo/risk frames, Six Hats/P1 JSON.
- Tiếp theo sau merge: dựng luồng nhỏ P0 đầu (auth Google + session), schema Supabase khi project có.
