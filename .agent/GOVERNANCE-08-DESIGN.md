# 08. DESIGN, UX VÀ KHẢ NĂNG TIẾP CẬN

Không coi Design là trang trí sau backend:

- Lập bản đồ nhiệm vụ chính và phác luồng trước xây lớn; thử bản mẫu đơn giản với người phù hợp, ghi nơi họ không hiểu.
- Bộ thiết kế tối thiểu: màu, chữ, khoảng cách, component có sẵn, hành vi tương tác. Dùng nền tảng/dependency hiện có trước xây design system riêng.
- Mô tả trạng thái loading, empty, error, success, mất quyền, mạng chậm; không chỉ màn hình đẹp khi có dữ liệu hoàn hảo.
- Kiểm tra responsive, bàn phím, focus, label, tương phản, thông báo lỗi, trình đọc màn hình phù hợp; chọn mục tiêu WCAG theo phạm vi/nghĩa vụ, không tự nhận đạt chuẩn chỉ dựa vào một scanner.
- Quốc tế hóa khi có nhu cầu: dịch nội dung, ngày/giờ/múi giờ, tiền tệ, số, hướng chữ; không suy định dạng từ quốc tịch.
- Không dùng thủ thuật gây nhầm để ép đăng ký, consent hoặc khó hủy dịch vụ.

### 08.1. Design-first với nhiều dịch vụ (mặc định cho sản phẩm có giao diện)

Mục đích: **prototype để hình dung project trước khi thành code** — sửa prototype rẻ hơn sửa code:

1. **Trước khi code UI**, prototype bằng dịch vụ design: AI đề xuất 2–3 dịch vụ phù hợp (Google Stitch, Figma Make, v0, Lovable, Canva, … theo nhu cầu) + **so sánh** (ưu nhược, chi phí, độ khớp stack, khả năng xuất code/asset) + lý do → **người dùng chọn**. Người dùng có dịch vụ quen (vd Google Stitch) thì ưu tiên đó, AI không ép đổi.
2. **Prototype gồm:** màn hình chính, luồng chính, trạng thái (loading/empty/error). Người dùng thử trước — kẹt chỗ nào sửa prototype chỗ đó; ghi nơi họ không hiểu (như đầu mục 08).
3. **Từ prototype → code:** xuất design/code frontend đưa vào project **qua PR bình thường** (không paste code từ chat vào repo không kiểm soát); code sinh theo design system tối thiểu ở đầu mục 08 và qua review như mọi thay đổi.
4. **Artifact design** (link, export, screenshot đã khử dữ liệu nhạy cảm) lưu ở `DESIGN.md` hoặc `docs/design/` — không rải chỉ trong chat cá nhân.
5. **Prototype là công cụ học, không phải cam kết:** hiểu mới → cập nhật spec TRƯỚC (mục 05), rồi code. Đổi prototype không phải “vi phạm spec”.
6. **Không dùng prototype thay kiểm thử:** bản mẫu xác nhận hình dung; hành vi thật vẫn phải qua test (mục 14). Prototype chưa bằng chứng sản phẩm được chấp nhận.

DESIGN.md ghi quy ước, liên kết bản mẫu, test sử dụng và điều còn thiếu. Thay đổi UX có ảnh/video/bằng chứng đã loại dữ liệu nhạy cảm và kiểm tra thao tác, không chỉ ảnh tĩnh.