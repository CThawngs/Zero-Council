# 16. CI/CD VÀ PHÁT HÀNH

### CI

Xây pipeline theo stack đã xác nhận: install khóa version; lint/typecheck; test; build; integration/contract; secret/dependency/license checks; asset/artifact budget. Checks độc lập có thể chạy song song. Chỉ định required checks; cảnh báo và chặn phải phân biệt rõ. Cache không được làm kết quả cũ bị nhận nhầm đúng commit mới.

Code PR và script build đều có thể thực thi mã không tin cậy. PR từ fork/nguồn chưa duyệt chạy cô lập với quyền tối thiểu, không secret production, không runner có quyền mạng nội bộ nhạy cảm. Không dùng sự kiện workflow có đặc quyền để checkout rồi chạy code PR bên ngoài. Bảo vệ thay đổi workflow và script CI bằng review phù hợp.

Khóa dependency và action/plugin CI tới phiên bản/commit được kiểm; quyền token CI read-only nếu không cần ghi. Ưu tiên short-lived identity/OIDC khi hỗ trợ; deploy identity tách CI kiểm PR. Không log env dump. Self-hosted runner phải có cách cô lập và dọn giữa job.

**Luật từ lỗi lặp (mục 28.6):** lỗi lặp lần thứ hai trở đi → thêm rule + CI check chặn, thay vì nhắc lại. Mỗi rule mới có lý do từ sự cố thật, owner, phạm vi, ngoại lệ và cách gỡ; rule chặn cả người, không chỉ agent. Ví dụ phổ biến: cấm pattern gây bug lặp trong stack của dự án, cấm comment tự sinh giải thích code (mục 28.6), chặn output vượt định dạng/ngân sách cho nội dung.

### CD

1. Tạo artifact xác định được nguồn commit, checks và dependency. Promote cùng artifact đã kiểm khi nền tảng cho phép; nếu phải rebuild thì giữ input xác định và kiểm lại bản thực sự deploy.
2. Preview/staging dùng dữ liệu và secret riêng, không bị search index hoặc truy cập nhạy cảm công khai ngoài ý muốn.
3. Kiểm luồng người dùng, migration và compatibility; hoàn tất G4 theo rủi ro.
4. Deploy bằng identity được cấp quyền, có concurrency control để bản cũ không ghi đè bản mới.
5. Phát hành dần/canary/flag khi phù hợp, theo tiêu chí dừng đã chốt; không bắt mọi app phải có release train.
6. Xác nhận version đang chạy, smoke test, alert và metric trong cửa sổ quan sát đã định.
7. Rollback ứng dụng hoặc recovery dữ liệu theo runbook đã thử; không hứa 5 phút cho mọi hệ thống.

Không merge khi required checks đang fail. Không xóa test, hạ rule hoặc sửa baseline chỉ để xanh; thay đổi tiêu chí có lý do được duyệt và bằng chứng. Emergency release chỉ qua cơ chế khẩn cấp do người có thẩm quyền kích hoạt, có phạm vi, thời hạn, nhật ký và hậu kiểm; agent không tự miễn cổng an toàn. Ưu tiên rollback bản đã biết tốt nếu được ủy quyền.

G4 phải xét cả: kênh hỗ trợ, người trực nhận alert, quyền riêng tư/điều khoản, chi phí/quota, nội dung ra mắt đúng sự thật, và khả năng tắt/khôi phục. Chỉ deploy thành công chưa có nghĩa launch thành công.