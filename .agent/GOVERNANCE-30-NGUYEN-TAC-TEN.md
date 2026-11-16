# 30. NGUYÊN TẮC CÓ TÊN — dùng tên để lái agent giữa chừng

Câu hỏi dài bị bỏ qua giữa task. Tên ngắn gọn thì không. Agent đọc phần 30 này khi bắt đầu task nhiều bước, áp dụng nguyên tắc liên quan, và nêu tên nguyên tắc đã dùng + quyết định cụ thể nó đã đổi.

Nhóm cốt lõi:
1. Trừ trước khi cộng — xoá dead weight trước khi xây trên đó.
2. Lười có hệ thống — thay đổi nhỏ nhất giải quyết đúng vấn đề; ưu tiên xoá hơn thêm.
3. Tư duy nền tảng — chọn cấu trúc dữ liệu cốt lõi trước khi viết logic.
4. Thiết kế lại từ nguyên lý đầu — tích hợp yêu cầu mới như thể nó luôn có từ ngày đầu, không vá chồng.
5. Công kích tiền đề — khi nhiều lần sửa cùng dấu hiệu, nghi ngờ tiền đề chung, không phải lỗi cục bộ.
6. Giảm tải cho người đọc — bỏ lớp trung gian và trạng thái ẩn mà người đọc phải nhớ trong đầu.
7. Hướng tới kết quả — refactor nhắm thiết kế đích, không giữ lại trạng thái tương thích tạm.
8. Trải nghiệm trước — chọn kết quả người dùng thay vì tiện lợi kỹ thuật.
9. Khám phá hết không gian thiết kế — không có tiền lệ thì dựng 2–3 bản cạnh tranh trước khi chốt.
10. Xây đòn bẩy — viết script vừa làm vừa chứng minh việc đó, để người review chạy lại được.

Nhóm kiến trúc:
1. Mô hình hoá miền — luật lặp lại nằm trong một cấu trúc, không rải vãi điều kiện.
2. Kỷ luật biên — kiểm tra ở trust boundary, tin kiểu bên trong.
3. Kỷ luật kiểu — làm cho trạng thái sai không biểu diễn được.
4. Thao tác idempotent — lặp lại hội tụ về cùng kết quả (bắt buộc với thanh toán, webhook, retry, migration).
5. Chuyển caller rồi xoá API cũ — làm chung một đợt, đừng để API ma mãc vĩnh viễn.
6. Tách trước khi tuần tự hoá — gỡ chia sẻ trước khi thêm khoá/đồng bộ.

Nhóm kiểm chứng:
1. Chứng minh nó chạy — kiểm chứng trên hiện vật thật, không phải bản thay thế.
2. Sửa gốc rễ — tái hiện và truy nguyên tới nguyên nhân trước khi đổi code.
3. Cắt thành đơn vị kiểm chứng được — mỗi đơn vị nhỏ kết thúc ở trạng thái đã kiểm.
4. Test hành vi, không test cài đặt — xem mục 14.

Nhóm phối hợp agent:
1. Giữ kín cửa sổ ngữ cảnh — phần đọc hàng loạt giao cho sub-agent, chỉ giữ kết luận ở chat chính.
2. Không chặn vì chờ người — làm tiếp phần việc đảo ngược rồi trình kết quả; chỉ dừng khi cần quyền thật sự.

Nguyên tắc siêu hình: Nhúng bài học vào cấu trúc — lời khuyên nhắc lần thứ hai thì chuyển thành lint, check, script hay luật (mục 28.6).