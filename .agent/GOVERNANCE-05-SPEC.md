# 05. PHỎNG VẤN SÂU ĐỂ VIẾT SPEC

Đây là nhiệm vụ chính khi ý tưởng còn mơ hồ. Không yêu cầu chủ dự án tự viết spec kỹ thuật rồi mới hỗ trợ.

### 05.1. Cách hỏi

- Hỏi nhiều vòng thích ứng, thường 4–7 câu liên quan mỗi vòng; giảm số câu khi người dùng quá tải hoặc một câu quyết định các câu sau. Không đặt quota tổng số câu để giả vờ đủ sâu.
- Mỗi câu có bối cảnh, ví dụ và lựa chọn khi hữu ích; nói rõ đề xuất và đánh đổi. Tránh dẫn dắt để người dùng chỉ đồng ý.
- Cho phép `chưa biết`, `cho ví dụ`, `đề xuất giúp`, `để sau`. Khi chưa biết, đề xuất nghiên cứu, thử nghiệm hoặc bản mẫu; không tự coi là đã chốt.
- Tóm tắt điều đã xác nhận và câu còn mở sau mỗi vòng. Không hỏi lại điều đã có nguồn đáng tin, trừ khi cần làm rõ mâu thuẫn.
- AI tự điều tra kỹ thuật rồi giải thích; không bắt người không biết code chọn DB/sharding/framework chỉ để đẩy trách nhiệm.
- **Phân loại câu hỏi trước khi hỏi.** Câu trả lời là *sự thật quan sát được* (hành vi, layout, output, hiệu năng, cách này hay cách kia) thì **không phải để người dùng quyết** — dựng bản mẫu/bài thử nghiệm nhỏ rồi để kết quả quyết, rồi mới báo. Chỉ hỏi khi là quyết định **sản phẩm, thị trường, rủi ro hoặc sở thích** mà thử nghiệm không trả lời được. Việc này giảm số câu hỏi và giữ vai trò kỹ sư thật.
- **Bắt người dùng nói lại vấn đề bằng lời của họ** trước khi vào thiết kế. Việc này nén nhiễu, bắt được hiểu lầm ngay, và tránh agent neo vào cách hiểu đầu tiên.

### 05.2. Chủ đề cần khai thác theo mức liên quan

1. Cá nhân, nội bộ hay sẽ publish? Nhóm người dùng đầu tiên, vấn đề, công việc hiện tại, lý do cần đổi.
2. Mục tiêu ngắn hạn và dài hạn. Phân biệt tổng tài khoản, người hoạt động và người dùng đồng thời; hàng tỷ đồng thời là yêu cầu phải khảo sát, không tự coi đã đáp ứng.
3. Tình huống sử dụng: bắt đầu, thao tác chính, hoàn thành, lần quay lại; mạng chậm, thiết bị yếu, ngôn ngữ, hỗ trợ tiếp cận.
4. Vai trò, quyền xem/sửa/chia sẻ/xóa; trạng thái trống, tải, lỗi, trùng, hủy, mất mạng, khôi phục.
5. Dữ liệu, nội dung người dùng, trẻ em, thanh toán, quốc gia phục vụ; dữ liệu nào thực sự cần.
6. Thành công nghĩa là gì, ưu tiên bản đầu, ngoài phạm vi, hạn chót, ngân sách phát triển/vận hành/marketing.
7. Team, người duyệt, công cụ agent, OS, kiến thức kỹ thuật; cloud dev hay local; có muốn bỏ folder local về sau không.
8. Kênh tìm người dùng, định vị, lợi ích, giá, hỗ trợ và xử lý lạm dụng.
9. Độ tin cậy, mất dữ liệu có thể chấp nhận, thời gian khôi phục, giới hạn nhà cung cấp, quyền quyết định.

### 05.3. Ghi nhận nguồn và độ chắc chắn

Mỗi yêu cầu quan trọng có ID, nguồn và trạng thái:

- `CONFIRMED`: người có trách nhiệm đã chốt; không đồng nghĩa nhu cầu thị trường đã được chứng minh.
- `OBSERVED`: có quan sát/dữ liệu, ghi thời gian và giới hạn.
- `ASSUMPTION`: giả thuyết cần kiểm tra; không giả làm lời người dùng thật.
- `OPEN`: chưa quyết định; ghi ai chốt và chặn công việc nào.
- `DELEGATED`: chủ dự án đã giao quyền chọn trong giới hạn cụ thể.

Không trả lời không có nghĩa là đồng ý. Việc nhỏ dễ đảo ngược chỉ tự chọn trong quyền `DELEGATED`, ghi mặc định đã chọn. Không tự suy quyền xử lý dữ liệu, chi tiền, publish hay xóa.

### 05.4. Kiểm tra spec

AI đọc nháp dưới ba góc: người sử dụng, người xây dựng, người kiểm tra. Tìm đường đi thiếu, mâu thuẫn, rủi ro và phạm vi thừa. Đóng vai người dùng chỉ sinh giả thuyết; không thay phỏng vấn hoặc thử nghiệm thực tế.

Spec đủ cho **phần sắp làm** khi: mục tiêu và phạm vi rõ; luồng chính và lỗi quan trọng có kết quả mong đợi; tiêu chí kiểm tra cụ thể; quyết định rủi ro được duyệt; mục mở được đánh dấu không chặn phần đó. Không cần biết mọi chi tiết của sản phẩm nhiều năm trước khi làm bản thử.

### 05.5. Sau khi SPEC chốt — bước bắt buộc trước build

Có spec chưa có nghĩa là bắt đầu code ngay. **Bước bắt buộc tiếp theo** là agent trình bày kế hoạch đầy đủ, tường minh trong câu trả lời — không giấu trong file rồi im lặng:

1. **Kế hoạch end-to-end** (các pha): spec → design/prototype → build từng luồng → tích hợp → kiểm thử → release → đo lường & học. Mỗi pha có đầu ra và điều kiện đi tiếp (khớp cổng quyết định mục 06).
2. **TODO 4 cấp** trong `.agent/TODO.md`: L1 mục tiêu → L2 khả năng → L3 bàn giao → L4 task (owner, phụ thuộc, tiêu chí, evidence). Dự án nhỏ (ít hơn ~10 task L4, một luồng) được dùng checklist phẳng — nhưng phải **nói rõ** “dự án nhỏ nên dùng phẳng” và vẫn đủ mục tiêu/tiêu chí.
3. Tính **% hoàn thành ban đầu** (verified L4 / tổng L4) và ghi ngày cập nhật.
4. Người dùng duyệt kế hoạch (hoặc chỉnh) trước khi bắt đầu build pha đầu tiên. Không trình bày kế hoạch = chưa đi qua cổng G3, không tự động code.