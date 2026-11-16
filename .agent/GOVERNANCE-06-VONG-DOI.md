# 06. VÒNG ĐỜI VÀ CÁC CỔNG QUYẾT ĐỊNH

Mỗi cổng có người quyết định, bằng chứng, giới hạn, bước tiếp. Dùng `PASS`, `CONDITIONAL`, `HOLD`, `NOT_APPLICABLE` có lý do. Chấp nhận thử nghiệm giới hạn không đồng nghĩa sẵn sàng public. Không miễn trừ nghĩa vụ pháp lý hoặc kiểm soát an toàn bắt buộc bằng một dòng ghi chú.

| Cổng | Đầu vào, công việc | Đầu ra và điều kiện |
| --- | --- | --- |
| G0 — Khởi tạo | Ý tưởng, khảo sát repo, phỏng vấn | Phạm vi ban đầu, quyền, ngân sách, chủ trách nhiệm; chỉ setup phần đã được giao |
| G1 — Nhu cầu | Nghiên cứu và phản hồi thật | Bằng chứng/giả định tách biệt; tiêu chí thử nghiệm và quyết định làm, sửa hướng hoặc dừng |
| G2 — Spec & Design | Yêu cầu ưu tiên, bản mẫu | Luồng chính/lỗi được mô tả, tiêu chí kiểm tra, người chốt; rủi ro quan trọng không còn bỏ trống |
| G3 — Xây dựng | Task nhỏ, thiết kế kỹ thuật | Tích hợp được; test, review và kiểm tra môi trường phù hợp đạt |
| G4 — Sẵn sàng phát hành | Bản đã kiểm tra | Quyền phát hành, backup/khôi phục, bảo mật/pháp lý, hỗ trợ, monitoring, chi phí và thông điệp ra mắt sẵn sàng |
| G5 — Vận hành & học | Số liệu và feedback | Đánh giá độ tin cậy, giá trị, chi phí; chọn ưu tiên tiếp theo có lý do |
| G6 — Ngừng/chuyển giao | Quyết định đóng hoặc chuyển | Thông báo, quyền dữ liệu, nghĩa vụ lưu giữ, backup cần giữ, hủy phí/quyền và bàn giao được kiểm tra |

Quy mô nhỏ vẫn giữ kiểm soát an toàn, nhưng không dựng hạ tầng không cần. Khi thiếu nền tảng để enforce review/checks, có thể nghiên cứu/prototype cô lập; ghi rõ hạn chế, không phát hành production rủi ro như thể đã có đủ kiểm soát.