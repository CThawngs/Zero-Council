# HANDOFF — Zero Council

Cập nhật: 2026-09-18. Governance v7.0; SPEC nháp 0.2, cập nhật S3 ưu tiên trạng thái cũ.
Status: WAITING_FOR_INPUT cho quyết định còn mở; chưa có sản phẩm chạy.

## Evidence và trạng thái Git

- `pwd`: C:\Users\nguye\OneDrive\Documents\Projects\Zero-Council.
- Remote: https://github.com/CThawngs/Zero-Council.git. `git ls-remote --symref ... HEAD` thành công, không có refs.
- GitHub MCP get_me: CThawngs; search repository: public, default branch main, quyền push/admin. Không thay visibility/quyền.
- Đã `git init -b docs/spec-foundation`, `git remote add origin ...`. Chưa có base main để mở PR; chưa push/merge. Checkpoint commit được phép; kiểm lại `git status`/`git log` khi tiếp phiên để biết commit thực, không suy từ file này.
- File phạm vi checkpoint: AGENTS.md, .agent/GOVERNANCE.md, .agent/00_INDEX.md, .agent/SPEC.md, file này. Không có code/dependency/secret.
- `git diff --cached --check` phát hiện dòng trắng thừa EOF SPEC; đã sửa, cần chạy lại trước commit. Chỉ kiểm whitespace, không phải kiểm runtime.
- Governance trước bị báo nguyên văn nhưng có khác biệt định dạng và thiếu câu mục 10; chưa đối chiếu đầy đủ. Ngày 2026-02-15 và nhận định một người giữ mọi vai ở bản trước là lỗi agent, không dùng làm evidence.
- DSH đã nạp AGENTS cập nhật trong phiên này; chưa kiểm client/phiên mới.

## Quyết định S3 và giới hạn

- Công khai đăng ký, chỉ Google OAuth, lưu chat/session; xóa UI phải hard-delete khỏi DB hoạt động. File/backup/provider retention chưa chốt; không hứa dung lượng vật lý giảm ngay.
- Nhóm dùng Supabase Free theo user báo, chưa kiểm project/schema. Vercel free dự kiến, ngân sách 0 USD; không có tài khoản/API key provider AI.
- Agent được Git/commit/push nhánh task, self-review, merge khi ổn. Không bỏ required checks/reviewer do nền tảng bắt buộc; self-review không phải độc lập.
- Không tạo tài khoản/dịch vụ, cài package, dùng API trả phí, xóa dữ liệu thật hoặc deploy. File policy không thay quyền nghiệp vụ; không xin sandbox escalation.
- Đã tạo src/lib/budget.mjs và tests/budget.test.mjs: guard thuần yêu cầu inputPrice/outputPrice/requiredFees đều bằng số 0, từ chối thiếu/sai kiểu/khác 0. `node --test tests/budget.test.mjs` trên Node v24.18.0: 2 pass, 0 fail. Chưa nối vào app/provider, chưa xác thực nguồn giá, quota hoặc điều khoản. Không coi guard là bảo đảm tổng chi phí 0 USD.
- Không background job. Test/build/runtime/CI/BYOK/restore chưa kiểm; tài liệu chỉ kiểm tĩnh.

## Nguồn đọc và việc tiếp

Nguồn chính thức Vercel Hobby, Supabase size/backups, Gemini pricing được liên kết trong SPEC; không coi tài liệu giá là bằng chứng quota hoặc quyền tài khoản thực.

1. Xác nhận Supabase schema có sẵn hay mới định chọn; chỉ xin URL dashboard/schema không secret.
2. Chốt 0 USD áp dụng chi phí nhóm hay cả key trả phí do user tự trả; file tạm hay theo session.
3. Đề xuất demo học tập/thực tập rủi ro thấp trong SPEC; chưa áp dụng giới hạn tuổi/quốc gia mà user chưa chọn.
4. Thống nhất bootstrap main đầu tiên ở remote trống trước push nhánh đầu tiên (GitHub có thể lấy nhánh đầu làm default). Không tự push main hoặc đổi default để lách task-only.
5. Chốt lỗi cố vấn/Six Hats/P1 JSON, rồi chia luồng nhỏ. Không oneshot P0–P2; không thử hard-delete trên DB thật.
