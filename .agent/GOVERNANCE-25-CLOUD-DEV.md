# 25. CHUYỂN CLOUD DEV VÀ XÓA LOCAL CÓ KIỂM SOÁT

Mốc 70–80% chỉ kích hoạt cuộc xem xét khi chủ dự án muốn, không tự cấp quyền xóa hoặc chứng minh sẵn sàng. Có thể làm cloud dev ngay từ đầu nếu được chọn và có ngân sách.

Trước xóa:

1. Inventory tất cả repo, worktree, branch/stash, file untracked/ignored, dữ liệu dev, media gốc, tài liệu ngoài Git và công việc agent chưa bàn giao. Không chỉ kiểm `git status` rồi kết luận đủ.
2. Push code/tài liệu được phép lên đúng remote, lưu việc chưa merge đúng nhánh; xác nhận remote commit. Dữ liệu/asset không thuộc Git có nơi lưu phù hợp, backup và quyền được kiểm. Không commit secret để tránh mất.
3. Từ cloud workspace hoặc môi trường sạch, dùng quyền của người vận hành thật: clone, setup, test, sửa thử, thực hiện luồng PR/preview được phép. Xác nhận có browser/tool cần thiết và nơi coding sau khi bỏ local.
4. Kiểm khả năng truy cập logs, rollback/restore, quản lý config và chi phí từ cloud. Deploy thành công chưa chứng minh toàn quy trình phát triển đã di dời.
5. Ghi handoff/recovery vào remote trước xóa, gồm commit, nơi dữ liệu/secret (không giá trị), quyền, hướng dẫn dựng lại và hạn chế.
6. Xin xác nhận riêng bằng lời rõ: các đường dẫn tuyệt đối/tài nguyên nào sẽ bị xóa, cái gì được giữ, bằng chứng đã sao lưu và rủi ro còn lại. Thư mục đồng bộ OneDrive hoặc tương tự có thể đồng bộ thao tác xóa; phải kiểm ảnh hưởng trước.
7. Xóa đúng phạm vi đã duyệt, không wildcard rộng, không xóa volume/container/cache dùng chung của project khác. Ưu tiên dọn build/cache tái tạo được trước khi xóa dữ liệu duy nhất.
8. Kiểm dung lượng và trạng thái remote/cloud, ghi kết quả ở nơi còn tồn tại. Xóa folder không bảo đảm mọi bản secret trong sync/backup đã biến mất; thu hồi/rotate khi cần.

Không đủ bằng chứng hoặc chưa xác nhận: giữ local, báo mục thiếu. Không cần hỏi lại toàn bộ ý tưởng sản phẩm để xử lý bước bàn giao này.