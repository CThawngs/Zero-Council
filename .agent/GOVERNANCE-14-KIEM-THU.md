# 14. KIỂM THỬ VÀ ĐỊNH NGHĨA HOÀN THÀNH

Chọn kiểm tra theo rủi ro và phạm vi; không dùng một % coverage hoặc một lượt build làm bằng chứng cho mọi thứ.

- Logic nghiệp vụ: unit test với đường đúng/sai/biên.
- Tích hợp: DB/service thật trong môi trường thử phù hợp, hợp đồng API và lỗi.
- Luồng quan trọng: end-to-end trên đúng bản preview/staging, quyền, đăng nhập, thao tác chính.
- UI: khả năng tiếp cận, responsive, tải/rỗng/lỗi, browser hỗ trợ.
- Thay đổi dữ liệu: migration trên dữ liệu giả đại diện phiên bản cũ và kiểm tra recovery.
- Hiệu năng: baseline, workload, budget và môi trường ghi rõ; load test chỉ trên tài nguyên đã được phép, có giới hạn để tránh ảnh hưởng người dùng.
- Bug: một regression test hoặc bước kiểm chứng tái lập phù hợp.
- **Test hành vi, không test phần cài đặt:** gọi code đúng như người dùng gọi và khẳng định một giá trị cụ thể. Đọ lại test sau khi viết: **test nào vẫn xanh nếu mọi hàm được import đều `return undefined` thì test đó vô dụng — xoá hoặc viết lại.**
- **Xoá test yếu:** test chỉ khẳng định điều hiển nhiên, test luôn xanh, test chỉ đọc lại chính nó, test phụ thuộc thứ tự chạy.
- Mỗi đơn vị nhỏ kết thúc ở trạng thái **kiểm chứng được** trước khi mở đơn vị sau; không để nhiều đơn vị dở dang rồi mới kiểm chứng.

Ưu tiên framework đã có. Không cài framework lớn cho một self-check đơn giản. Với flaky test, điều tra, ghi owner và thời hạn nếu cách ly; không retry đến xanh rồi giấu thất bại. Test luôn pass, mock toàn bộ đường rủi ro hoặc snapshot được cập nhật mù không có giá trị chứng minh tương ứng.

Mức bằng chứng:

- L0: đọc/diff/static review. Có thể đủ cho chỉnh câu chữ đã đối chiếu, không đủ xác nhận runtime.
- L1: automated checks đã chạy; ghi lệnh, kết quả và version.
- L2: runtime/tích hợp trên môi trường kiểm soát.
- L3: luồng người dùng trên đúng bản chuẩn bị phát hành.
- L4: xác nhận production đúng version và tín hiệu theo dõi phù hợp.

DoD của task nêu mức cần đạt trước khi làm. Mỗi loại việc phải có **tiêu chí chấm (rubric) + bước tự kiểm** trước khi nộp (mục 28.1, 28.4). `VERIFIED` luôn kèm phạm vi; không suy từ test một endpoint sang toàn hệ thống. Tool lỗi/không chạy được thì ghi `UNVERIFIED` phần đó. Quy trình soạn xong không tự trở thành quy trình đã kiểm chứng thực địa.