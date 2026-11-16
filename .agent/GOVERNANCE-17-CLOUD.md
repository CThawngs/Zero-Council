# 17. CLOUD-FIRST, CONFIG VÀ MÔI TRƯỜNG

Hỏi cá nhân/nội bộ/public và mong muốn cloud từ đầu; chủ dự án ưu tiên cloud-first nhưng không biến thành lệnh mua dịch vụ. Chọn theo dữ liệu, quyền, ngân sách và khả năng tái lập.

Phân biệt:

1. Remote Git: code, docs, cấu hình không chứa secret.
2. Cloud dev/workspace: nơi người và agent code/test sau khi bỏ máy local.
3. Hosting production/preview: nơi phục vụ người dùng; không mặc định là môi trường coding đầy đủ.
4. DB/object storage/secret manager: dữ liệu và quyền riêng theo môi trường.

`.env` thường nhỏ. Dung lượng lớn chủ yếu từ dependencies, build, cache, media, container. Lưu secret tập trung vì bảo mật, phân quyền và vận hành; chuyển cloud dev để giảm phần nặng local.

### Config và secret

- Lưu giá trị secret vận hành ở secret manager hoặc cấu hình bảo vệ của đúng nền tảng/đúng môi trường. Không giả định Vercel và Supabase dùng chung kho hoặc tự đồng bộ.
- `.env.example` chỉ có tên, kiểu, bắt buộc/tùy chọn, giá trị mẫu an toàn, môi trường dùng và cách lấy quyền; config công khai không nhạy cảm có thể version trong Git.
- Phân loại public client config và server secret. Tiền tố như `NEXT_PUBLIC_`/`VITE_` có thể đưa giá trị vào bundle; không bao giờ đặt secret phía client. Supabase service-role hoặc quyền tương đương phải ở server, kiểm RLS/quyền theo thiết kế.
- Dev/preview không dùng khóa production. PR không tin cậy không nhận secret dù được deploy preview.
- Nếu cần local env, chỉ lấy secret dev tối thiểu bằng cơ chế được phép, file gitignored, quyền file phù hợp, không sync/chia sẻ ngoài ý muốn; xóa bản tạm theo vòng đời đã chốt. Không tự pull toàn bộ env.
- Secret có owner, scope, hạn/rotation, thu hồi khi rời team. Kiểm config thay đổi có cần rebuild/redeploy, không hứa mọi deploy tự nhận ngay.
- Test có thể dùng mock/seed không cần secret; không cố làm local không chạy được. DB dev local hoặc hosted đều hợp lệ nếu cô lập và phù hợp; không cấm SQLite cho mọi sản phẩm.

Dev, preview/staging và production có namespace/credentials/data riêng; có thể tách vật lý hoặc logic theo mức rủi ro. Dữ liệu giả mặc định; ngoại lệ dùng dữ liệu đã khử định danh cần đánh giá tái nhận dạng, quyền và phê duyệt. Không sao chép dữ liệu production thô vào máy contributor hoặc môi trường test.