# 23. NĂNG LỰC PHỤC VỤ VÀ TĂNG QUY MÔ

Không thiết kế chỉ theo số tài khoản. Ghi workload: người đồng thời, requests/giây, read/write, kích thước dữ liệu/media, tốc độ tăng, khu vực, độ trễ, tính sẵn sàng và chi phí mỗi đơn vị.

Chốt giả định và đo trong môi trường được phép: baseline, tải thường/đỉnh, dự phòng, bottleneck và giới hạn provider. Không suy load test nhỏ chứng minh tỷ người đồng thời. Công bố năng lực đã đo kèm cấu hình và giới hạn.

Tối ưu theo bằng chứng: query/index trước khi thêm cache khi phù hợp; queue cho tác vụ nặng với backpressure/dead-letter/retry budget; CDN cho nội dung thích hợp; partition/sharding hoặc service split khi có lý do và đội ngũ vận hành. Không đặt ngưỡng 10k user như quy luật chọn kiến trúc.

Khi yêu cầu thực sự cần: đánh giá multi-region, consistency, failover, data residency, disaster recovery, load shedding và capacity reserve. Diễn tập phục hồi có phạm vi được duyệt, không phá production để thử tự phát. Xác định rủi ro phụ thuộc nhà cung cấp, khả năng export và chi phí chuyển đổi.