# 02. NGÔN NGỮ CHUNG CHO TEAM

Viết tài liệu người dùng và câu hỏi bằng ngôn ngữ chủ dự án sử dụng. Giải thích thuật ngữ lần đầu:

- Spec: sản phẩm phải làm gì, trong hoàn cảnh nào, kết quả nào được coi là đúng.
- Branch: nhánh chứa thay đổi riêng; worktree: thư mục làm việc riêng gắn với một nhánh.
- PR: đề nghị đưa thay đổi vào nhánh chung để kiểm tra và duyệt.
- CI: kiểm tra tự động khi có thay đổi; CD: quá trình đưa bản đã kiểm tra lên môi trường chạy.
- Preview: bản dùng thử riêng; production: bản người dùng thật đang sử dụng.
- Rollback: quay về bản phù hợp trước đó; restore: khôi phục dữ liệu từ bản sao.
- SLO: mục tiêu độ tin cậy; RPO: mức mất dữ liệu tối đa chấp nhận; RTO: thời gian khôi phục mục tiêu.

Mỗi hướng dẫn cho người mới có: mục tiêu, nơi thực hiện, bước đánh số, kết quả mong đợi, cách xử lý khi khác. Không yêu cầu gửi token, mật khẩu hoặc ảnh chứa secret vào chat. Khi giao diện nền tảng có thể đã đổi, kiểm tra tài liệu chính thức thay vì bịa vị trí nút.

Mỗi hạng mục có một người chịu trách nhiệm cuối cùng và người duyệt phù hợp. Một người có thể giữ nhiều vai:

- Sản phẩm: nhu cầu, ưu tiên, phạm vi.
- Kỹ thuật: thiết kế hệ thống, code review, dữ liệu và tích hợp.
- Design: trải nghiệm, khả năng tiếp cận, nhận diện.
- Thị trường: nghiên cứu, nội dung, kênh tìm người dùng.
- Vận hành: phát hành, cảnh báo, khôi phục, chi phí.
- Bảo mật/pháp lý: chuyên môn nội bộ hoặc chuyên gia được thuê khi cần.

Ai cũng có thể đề xuất, dùng thử, trả lời phỏng vấn và điều khiển agent trong phạm vi được cấp. Quyền merge dựa trên trách nhiệm, năng lực đã được xác nhận và cấu hình nền tảng, không chỉ dựa vào bằng cấp. Người không đọc hiểu code không phải xác nhận an toàn kỹ thuật thay reviewer. AI review bổ trợ, không thay phê duyệt độc lập bắt buộc. Reviewer vẫn đọc diff và code liên quan, không chỉ tin mô tả PR hoặc ảnh test xanh.