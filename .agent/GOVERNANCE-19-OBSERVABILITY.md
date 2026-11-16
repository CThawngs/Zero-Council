# 19. OBSERVABILITY VÀ XỬ LÝ SỰ CỐ

### Theo dõi

METRICS/RUNBOOK ghi: dịch vụ/owner, SLO/cửa sổ đo, dashboard, nơi nhận alert, người trực và người thay, cách truy cập an toàn.

- Logs có cấu trúc: timestamp có múi giờ, level, service, environment, version, request/trace ID, mã lỗi. Stack chi tiết chỉ ở nơi quyền hạn phù hợp; người dùng nhận thông báo an toàn và mã hỗ trợ.
- Không log password/token/cookie, toàn bộ request body hoặc dữ liệu cá nhân mặc định. Redact trước khi gửi hệ thống log; sampling, retention và truy cập có giới hạn. ID đã hash vẫn có thể là dữ liệu cá nhân.
- Metrics về tỷ lệ lỗi, độ trễ, tải, tài nguyên, queue/DB khi liên quan; traces cho đường phân tán cần chẩn đoán. Theo dõi chi phí và cardinality của telemetry.
- Synthetic/uptime bên ngoài kiểm luồng thiết yếu; thử gửi alert và xác nhận người nhận. Giảm alert trùng/noise, cảnh báo dựa tác động và tốc độ tiêu hao error budget khi phù hợp.
- Error budget là phần lỗi được phép trong SLO; khi vượt mức đã chốt, hạn chế phát hành rủi ro và ưu tiên ổn định.

Không có agent chạy thường trực thì không hứa giám sát real-time sau khi session kết thúc. Real-time có độ trễ phụ thuộc hệ thống, cần mục tiêu phát hiện/thông báo và kiểm chứng. Tự động khắc phục chỉ cho playbook giới hạn, đã thử, có audit và nút dừng; không mở vòng agent toàn quyền production.

### Incident

1. Phát hiện, ghi giờ, môi trường/version, triệu chứng, nguồn alert và tác động. Phân severity theo tác động dữ liệu/bảo mật/dịch vụ, không chỉ số request lỗi.
2. Chỉ định người điều phối, người thao tác, người cập nhật thông tin; có thể một người giữ nhiều vai, nhưng biết ai quyết định.
3. Cô lập rò rỉ và bảo vệ dữ liệu trước; giữ bằng chứng an toàn. Khôi phục bằng rollback/flag/routing/recovery đã được ủy quyền. Không autoscale mù khi gây thêm chi phí hoặc mở rộng rò rỉ.
4. Cập nhật nội bộ/status page theo quyền; nói điều biết/chưa biết, không bịa ETA hoặc công khai chi tiết nhạy cảm. Đánh giá nghĩa vụ thông báo với người phụ trách pháp lý.
5. Khi ổn định, điều tra root cause và thêm regression kiểm chứng. Có thể incident chưa có root cause chắc chắn; ghi điều đó.
6. Postmortem không đổ lỗi: timeline, tác động, yếu tố góp phần, điều hiệu quả/không, action có owner/hạn và cách verify. Đặt hạn theo severity, không coi 72h là luật pháp chung.
7. Đóng incident sau kiểm tra phục hồi và giao rõ việc còn lại; cập nhật runbook, alert và test.

Bug tái diễn ngoài incident: thu dữ liệu tại điểm lỗi trước khi thêm retry/timeout/fallback; so các điều kiện liên quan, không yêu cầu thử account/provider ngoài phạm vi được phép. Giả thuyết được viết và thử, không bị cấm chỉ vì chưa chắc. Thử nghiệm phải có tiêu chí xác nhận/phủ định, không sửa mò mãi.