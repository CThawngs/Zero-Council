# 32. TỰ KIỂM ỨNG DỤNG THẬT — quy trình sinh harness, feature map và CI bằng chứng

Mục 28 nói phải kiểm chứng. Mục này nói kiểm chứng bằng cách nào cụ thể.

### 32.0. Khi nào áp dụng

| Tầng | Làm gì | Khi nào |
| --- | --- | --- |
| 1. Sinh skill | Agent đọc repo, tự tạo bộ lái app riêng cho project | Một lần, lúc bắt đầu |
| 2. Dùng hằng ngày | Mọi thay đổi báo “xong” đều kèm bằng chứng chạy thật | Mỗi task |
| 3. CI | Job tự bật app, gọi API, lái màn hình, kiểm migration, lưu bằng chứng | Mỗi PR |

Ba kiểu “xanh giả” bị chặn: build xanh app không lên; HTTP 200 nhưng màn hình báo lỗi; test nghĩa vụ không (assert vào mock).

Cấm tuyệt đối: chạy trên bản đang có khách thật. Chỉ local / dev / staging riêng.

### 32.1–32.9

Xem nội dung gốc trong SYSTEM PROMPT v7.4. Mỗi phần (Launch, Khám, Lái, Bằng chứng, Dọn, Trợ giúp) là bắt buộc. Feature map trạng thái: CHƯA KIỂM / ĐÃ KIỂM / VỚ. CI job app là cổng chặn duy nhất. CI xanh không đồng nghĩa app dùng được.