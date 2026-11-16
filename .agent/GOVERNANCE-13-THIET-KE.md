# 13. THIẾT KẾ KỸ THUẬT VÀ XÂY DỰNG

- Chọn cấu trúc đơn giản đáp ứng nhu cầu, không mặc định stack cụ thể, microservices hay một DB theo số user tùy ý.
- Ranh giới UI/API/domain/data/provider rõ; hợp đồng input/output/error và quyền được định nghĩa. Không tự ép mọi hành vi giống nhau vào một abstraction nếu nghiệp vụ khác.
- Validate tại trust boundary; xử lý lỗi có phân loại và tín hiệu chẩn đoán. Không catch rỗng hoặc trả thành công giả; không lộ stack/secret cho người dùng.
- Dùng thư viện chuẩn cho auth, crypto và giao dịch; chọn xử lý race/idempotency/transaction phù hợp cho thanh toán, webhook và thao tác lặp.
- API có chính sách tương thích, version/deprecation và đường nâng cấp khi có client phụ thuộc. Không xóa API đang dùng mà chưa thông báo/kế hoạch chuyển đổi.
- Thay đổi lớn có phương án bị loại, rủi ro, ngân sách và quyết định được duyệt. Feature flag chỉ khi cần, có owner, mặc định an toàn, ngày xem lại và task xóa; flag không thay authorization.
- Mỗi luồng nhỏ được tích hợp và test ngay. Code sinh ra phải được đọc/review, không giao quyền tin cậy chỉ vì AI viết nhanh.

Vòng làm việc: quan sát; giả thuyết/kế hoạch; thay đổi tối thiểu; kiểm tra; ghi bằng chứng; chọn bước tiếp. Không lặp vô hạn: sau vài thử nghiệm không thêm hiểu biết (mặc định xem lại sau 3), dừng sửa mò, đổi cách thu thập dữ liệu hoặc xin trợ giúp. Luôn tôn trọng giới hạn thời gian/token/tiền.

**Trước khi sửa, ba câu hỏi bắt buộc** (rút từ nguyên tắc 30):

- **Có xoá được gì không?** Bỏ dead code, adapter cũ, config thừa *trước khi* thêm. Thêm vào nền cũ giống xây trên nhà nứa.
- **Có phải đang vá sai tầng không?** Nếu ≥2 lần sửa cùng một triệu chứng, dừng vá: kiểm kê ai giữ mất cân bằng đó, rồi công khai đánh giá lại tiền đề (thường là giả định sai, không phải lỗi code).
- **Cấu trúc dữ liệu đã đúng chưa?** Phần lớn lỗi logic là chọn sai hình dạng dữ liệu, rồi viết logic đè lên. Sửa hình dạng rẻ hơn sửa nhánh.
- Khi **không có tiền lệ** (chưa từng làm, hoặc sợ chọn sai): **dựng 2–3 bản mẫu cạnh tranh** rồi so sánh — đừng chốt ngay phương án đầu tiên. Với kiến trúc lớn, tra phần **thực tại có quyền phủ quyết**: nếu thiết kế mới cần thêm state, `any`, escape hatch, cờ đặc biệt → kiến trúc đó sai, làm lại từ đầu.