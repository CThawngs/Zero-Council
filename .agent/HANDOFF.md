# HANDOFF — Zero Council

Cập nhật 2026-09-18. Task: scaffold Next.js, cài dependency, hướng dẫn Supabase, commit/push/PR/merge được chủ dự án ủy quyền. Không deploy hoặc tạo dịch vụ.

## Git và phạm vi

Base `origin/main` 94e53b2 là merge PR #1; GitHub không tự đồng bộ hai nhánh như từng suy đoán. Nhánh task `feature/scaffold-webapp` từ base này. Khi tiếp phiên kiểm `git status` và trạng thái PR thực tế, không suy commit hash cuối từ tài liệu này.
PR #2 (scaffold + docs, commit 509c3cf) tạo và merge theo ủy quyền S5; sau merge xác nhận bằng `git fetch`/`git log origin/main`.
Thêm app độc lập ở `web/` để giữ guard/test root. Root Directory dự kiến trên Vercel là `web`. Không đổi GUI DSH cổng 8787.

## Đã thực hiện và kiểm

- create-next-app sinh Next.js 16.3.5, React 19.2.8, TypeScript/Tailwind/ESLint; `pnpm install` thành công, lockfile lưu trong web. Node v24.18.0, pnpm 11.5.2.
- `pnpm lint` và `pnpm build` tại web sau chỉnh UI/layout: exit 0. Dùng font hệ thống, không tải Google Fonts khi build.
- `node --test tests/budget.test.mjs`: 2 pass, 0 fail. Guard chưa tích hợp runtime, chỉ dành chi phí nhóm khi nối sau này.
- Browser production preview http://127.0.0.1:3100: title Zero Council, lang vi; nút mở mẫu có aria-expanded=true, 4 article hiện; bấm lại aria-expanded=false và hidden=true. Console không có error/warning trong phiên kiểm. Preview tạm đã yêu cầu dừng sau kiểm.
- Read-only subagent review app/config/docs: không phát hiện blocking trong phạm vi fixture; nhắc handoff cũ, đã thay bản này. Không coi review là audit bảo mật toàn sản phẩm.
- Installer báo ESLint 9.39.5 deprecated; giữ major tương thích scaffold. Cần đánh giá nâng cấp riêng, không bỏ warning hoặc tự tuyên bố hết rủi ro dependency.

## Trạng thái đúng

Trang tiếng Việt với câu hỏi thực tập và 3 ý kiến + tổng hợp viết sẵn. Nút chỉ mở/ẩn; không input tự do, API council, fan-out, model hoặc dữ liệu AI sinh. Các phát ngôn trong phiên về thêm API mock là đề xuất chưa triển khai; không mở scope khi đang chốt scaffold.
Chưa có Supabase SDK/project/schema/auth callback/session/upload/BYOK runtime/search/decision frameworks. Không có CI hoặc ruleset được thiết lập trong task này. Không gọi AI tính phí hoặc gửi dữ liệu user.
Nguồn setup: docs/SETUP.md, đã đọc docs Google OAuth chính thức. README root và web ghi trạng thái không production-ready.

## Quyết định còn hiệu lực và bước tiếp

- Supabase Free đã chốt nhưng chủ dự án tự tạo; chỉ Google OAuth cho login, không phải chỉ Google cho AI.
- 0 USD chỉ nhóm/demo/hạ tầng; user BYOK được dùng model trả phí bằng key của họ.
- File private lưu theo session, xóa cùng session; ngưỡng mỗi file/session/user và retention bên thứ ba còn OPEN.
- Chủ dự án làm bước 2–3 docs/SETUP.md, không gửi secret. Task tiếp: auth Google + RLS/session có migration, hoặc API council giả lập có test khi chưa có project; chốt task trước triển khai.
- Review/checks thực của PR phải đạt trước merge, không bypass. License, quotas cụ thể, provider đầu tiên, Six Hats/P1 JSON vẫn cần chốt.
