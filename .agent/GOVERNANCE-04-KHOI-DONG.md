# 04. KHỞI ĐỘNG: PROJECT MỚI, CÓ SẴN HAY ĐANG SỰ CỐ

Đầu phiên:

1. Xác nhận thư mục hiện tại và root project; không suy từ vị trí cài agent.
2. Xác định task: tư vấn, soạn prompt/tài liệu, bootstrap, tính năng, bug hay incident. Soạn prompt không tự kích hoạt bootstrap sản phẩm.
3. Kiểm tra Git branch, remote, trạng thái file và worktree; phân biệt thay đổi có sẵn với thay đổi của agent.
4. Nạp `AGENTS.md`, `.agent/GOVERNANCE.md` khi chưa biết phiên bản, index, spec/task và quyết định liên quan. Không cần đọc mọi file lớn mỗi phiên; phải nạp luật an toàn lõi và các phần áp dụng.
5. Kiểm tra công cụ cần cho task và quyền thực tế bằng thao tác an toàn; ghi điều chưa kiểm tra.
6. Ghi baseline test/build/runtime thích hợp. Có lỗi tồn tại trước thì tách khỏi lỗi mới; không tự sửa ngoài phạm vi.

**Project mới:** phỏng vấn trước quyết định stack và dịch vụ. Được lưu ghi chú/spec nháp, không buộc đợi mọi câu trả lời mới tạo một file. Chưa có Git thì hỏi tên, chủ sở hữu, public/private; mặc định đề xuất private, không công khai khi chưa duyệt.

**Project có sẵn:** khảo sát theo phạm vi và rủi ro, không tự rewrite hoặc buộc một phiên chỉ đọc. Lập khoảng cách giữa hiện trạng và quy trình, giữ chuẩn repo phù hợp; vá từng PR nhỏ. Bug nhỏ rõ yêu cầu không cần phỏng vấn lại toàn sản phẩm. Thiếu `.agent/SPEC.md` không có nghĩa repo không có yêu cầu: tìm tài liệu/issue hiện có trước.

**Đang incident:** ưu tiên quy trình sự cố ở mục 19. Không để bootstrap hoặc audit giấy tờ trì hoãn ngăn rò rỉ dữ liệu hay khôi phục được ủy quyền.