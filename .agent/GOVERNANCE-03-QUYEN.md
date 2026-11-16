# 03. BẢNG QUYỀN VÀ ĐIỀU KIỆN DỪNG

Khi chưa có quyền được ghi nhận, mặc định chỉ điều tra và đề xuất đối với hành động bên ngoài hoặc có rủi ro. Thiết lập bảng quyền của dự án khi bootstrap:

| Hành động | Quyền mặc định và điều kiện |
| --- | --- |
| Đọc file trong phạm vi, sửa code được giao, chạy test bằng dữ liệu giả | Được làm nếu môi trường cho phép; kiểm tra script trước khi chạy trong repo chưa tin cậy |
| Tạo worktree/branch, commit phần của mình | Được làm theo chính sách Git đã chốt |
| Push branch hoặc mở PR | Cần đúng remote, đúng tài khoản và quyền contributor; không tự công khai repo |
| Merge | Cần required checks và người/quy tắc duyệt được chỉ định |
| Deploy preview | Được trong tài khoản, ngân sách và dữ liệu thử đã duyệt |
| Deploy production | Qua chính sách phát hành được duyệt, quyền tách khỏi PR không tin cậy |
| Cài MCP, extension, package hệ thống; sửa cấu hình agent trên máy người khác | Giải thích nguồn, quyền, phạm vi; cần đồng ý rõ trước khi cài/sửa |
| Tạo dịch vụ trả phí, tăng gói, quảng cáo, email hàng loạt | Cần ngân sách, đối tượng, nội dung, thời hạn và phê duyệt |
| Xóa dữ liệu, folder local, cloud resource; rewrite Git history | Cần xác nhận riêng cho phạm vi cụ thể và kiểm tra khả năng khôi phục |
| Đổi auth, quyền, thu thập dữ liệu, vùng lưu trữ hoặc điều khoản | Cần người có trách nhiệm duyệt; chuyên gia pháp lý khi cần |

Chính sách cleanup đã duyệt có thể ủy quyền tự động trong phạm vi tên tài nguyên, tuổi, số lượng và bản cần giữ. Ngoài phạm vi phải hỏi lại. Không coi phê duyệt chung một prompt là đồng ý xóa mọi thứ sau này.

Không đi đường vòng khi bị từ chối quyền hoặc kiểm soát bảo mật. Fallback chỉ là dùng công cụ khác được phép để đạt cùng mục tiêu hợp lệ, không vượt rào quyền.

Khi cần input, ghi `WAITING_FOR_INPUT` và câu hỏi cụ thể; khi thiếu quyền/môi trường thực sự, ghi `BLOCKED`, bằng chứng, đã thử gì an toàn, hành động cần tiếp theo. Tiếp tục phần độc lập an toàn nếu còn, không giả hoàn thành phần bị chặn.