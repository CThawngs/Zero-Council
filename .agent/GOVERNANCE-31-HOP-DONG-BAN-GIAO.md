# 31. HỢP ĐỒNG BÀN GIAO, VÒNG LẶP TỰ TRỊ VÀ NHẬT KÝ QUYẾT ĐỊNH

### 31.1. Hợp đồng bàn giao

Bàn giao tốt gồm đủ bốn thứ:

```
Mục tiêu
Điều kiện hoàn thành (predicate — đo được, pass/fail được)
Quyền được cấp
Lối thoát (khi kẹt thật thì dừng và viết lý do)
```

- “Điều kiện hoàn thành” phải là kiểm được, không phải thời gian. “Làm cho tôi 4 tiếng” là thời gian, không phải kết quả.
- Lối thoát quan trọng hơn nghe vẻ: agent kẹt thật thì dừng và viết lý do.
- Worktree sạch + base commit cụ thể để lần chạy không đụng việc đang mở.

### 31.2. Vòng lặp một thay đổi – một kiểm – một dòng log

```
Kiểm điều kiện hoàn thành → Thay đổi nhỏ nhất có cơ sở → Kiểm chứng trên hiện vật thật → Có tiến không? có: commit | không: BỎ THAY ĐỔI ĐÓ → Ghi một dòng quyết định → Lặp
```

Thay đổi không có tiến bộ thì bị bỏ. Bế tắc = đổi hướng, không phải dừng.

### 31.3. Nhật ký quyết định

- Mỗi dòng: thời gian, pha, quyết định, lý do, con trỏ bằng chứng, kết quả.
- Bằng chứng là con trỏ tới file/ảnh/log cụ thể, không phải mô tả bằng lời.
- Tóm tắt kết thúc bằng mục “Cần bạn nhìn kỹ” liệt kê những chỗ đáng nghi.
- Đánh giá lại bằng model khác: bắt một reviewer khác đọc nhật ký + transcript.

### 31.4. Ba chế độ scale

| Chế độ | Dùng khi | Agent có quyền merge? |
| --- | --- | --- |
| Hợp đồng một task (mặc định) | Một agent một phiên làm xong | Không; bạn merge |
| Hàng đợi tự động | Nhiều PR độc lập | Có, nhưng phán quyết merge từ verifier độc lập |
| Xếp chồng, không ship | Thay đổi có liên kết | Không; agent chỉ xếp + kèm phán quyết |
| Điều phối nhiều ngày | Chương trình dài hơn một phiên agent | Không; coordinator không tự viết code |

Người viết không tự duyệt mình. Xanh CI không có nghĩa là an toàn.