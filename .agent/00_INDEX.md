# 00_INDEX — Zero Council

Governance: v7.0. Cập nhật: 2026-09-18 (ngày máy đã kiểm).
Nguồn yêu cầu: tài liệu tổng hợp do chủ dự án cung cấp; spec nháp 0.2 chưa duyệt toàn bộ.

## File hiện có

- `AGENTS.md`: luật vào cửa. DSH đã đưa nội dung cập nhật vào phiên này; chưa kiểm tự nạp trong phiên mới hoặc client khác.
- `.agent/GOVERNANCE.md`: quy trình v7.0 đã lưu trước đó. Chưa xác minh nguyên văn; đã nhận thấy khác định dạng và thiếu câu giải thích khoảng trắng ở sơ đồ mục 10. Không gọi bản sao nguyên văn cho đến khi đối chiếu đầy đủ.
- `.agent/SPEC.md`: mục tiêu, yêu cầu P0/P1/P2, nguồn, tiêu chí nháp, lịch học, phân công dự kiến và OPEN-01–05.
- `.agent/HANDOFF.md`: bằng chứng môi trường, giới hạn và việc tiếp.

## Hiện trạng

Workspace: `C:\Users\nguye\OneDrive\Documents\Projects\Zero-Council`.
Remote do user cung cấp: https://github.com/CThawngs/Zero-Council.
Remote public, default branch `main` với commit đầu 00a6102 đã được ủy quyền push (bootstrap, remote trước đó trống). Từ giờ mọi thay đổi qua nhánh task + PR; main không push trực tiếp. GitHub MCP xác thực `CThawngs`, quyền push/admin; ruleset chưa cấu hình.
Có scaffold Next.js tại `web/`, trang mẫu không gọi AI; guard/test ngân sách tại `src/lib/budget.mjs`, `tests/budget.test.mjs` chưa nối runtime. `README.md` hướng dẫn chạy; `docs/SETUP.md` hướng dẫn chủ dự án tạo Supabase/Google OAuth. Chưa có auth, session, upload hay fan-out thật. Xem HANDOFF cho bằng chứng kiểm tra.

## Nạp theo task

Luôn đọc AGENTS, governance mục 01–03, spec và handoff liên quan.
Phỏng vấn: mục 05; Git/cộng tác: 12,15; xây dựng: 13–14; release:16; incident:19; xóa local:25.
Các file kiến trúc, TODO, decisions, setup, legal, runbook chỉ tạo khi có nội dung cần thiết; chưa có không đồng nghĩa được bỏ cổng liên quan.
Ngày 2026-02-15 ở bản index/handoff trước là lỗi ghi nhận của agent, không phải ngày dự án khởi tạo đã kiểm chứng.
