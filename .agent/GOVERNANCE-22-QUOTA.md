# 22. QUOTA, CHI PHÍ, ASSET VÀ DEPLOYMENT RETENTION

Lập inventory tài nguyên với owner, provider/gói/vùng, unit tính phí, free quota, kỳ reset, hard limit hay overage, giới hạn chi, retention, ngày xem lại và cách xuất/xóa. Kiểm giá/điều khoản bằng tài liệu chính thức tại thời điểm quyết định, không dùng con số ví dụ như cam kết.

Tính theo workload: storage tích lũy, request, egress/CDN, function CPU/memory/time, DB, CI minutes/cache/artifact, preview, log, backup, cloud dev và token AI. Đặt cảnh báo nhiều mức với người nhận và hành động; 70/85/95% là ví dụ cần chốt. Có budget cho task/agent, giới hạn concurrency và retry; tách chi phí thực đo khỏi ước tính.

### Asset và build

- Đo file lớn, static assets, function bundles, image/container và artifact sau build. `.gitignore`, `.dockerignore`, `.vercelignore` có vai trò khác; không giả một file ignore giải quyết tất cả.
- Media/dataset nặng thường nên ngoài bundle/repo, có storage/CDN, quyền, version/checksum và lifecycle. Giữ fixture nhỏ có license cho test. WAV hoặc file >5MB không bị cấm tuyệt đối nếu yêu cầu nghiệp vụ cần và được duyệt budget.
- Chọn nén/định dạng theo chất lượng, hỗ trợ client và chi phí. Chuyển storage ngoài phải tính request/egress/privacy/region, không hứa miễn phí.
- Size guard có baseline/budget cho repo, file, static và function; ngoại lệ có owner/lý do/hạn. Git LFS có quota riêng và có thể vẫn đưa file nặng vào build.
- Không tự kết luận Next.js luôn đóng gói toàn bộ `public/` vào mọi function. Kiểm build output/tracing và số liệu provider. Tình huống Vercel 43,37 GB functions/29,38 GB deployments do người dùng báo là ví dụ cần xác minh nguyên nhân, không sự thật đã audit cho mọi project.

### CI/deploy không tăng tài nguyên vô hạn

Dùng path filters có kiểm tra phụ thuộc, cancel superseded jobs, preview theo nhu cầu/nhãn/quyền và TTL khi phù hợp. Không bỏ test liên quan để giảm phí. Thay tài nguyên môi trường phải cập nhật setup và inventory cùng PR.

### Cleanup an toàn

1. Liệt kê đúng account/project/environment; dry-run danh sách và dung lượng ước tính.
2. Bảo vệ deployment đang phục vụ traffic/domain, bản rollback được ghim, bản điều tra incident, legal hold và dữ liệu phải giữ.
3. Xóa theo retention đã được duyệt, giới hạn số lượng/batch, audit và dừng khi lỗi; nếu chưa có ủy quyền thì xin xác nhận danh sách/phạm vi.
4. Không xóa tất cả preview chỉ vì PR đóng nếu còn được dùng; không xóa backup để chữa quota vội.
5. Kiểm ảnh hưởng routing/khôi phục và đo usage sau khi provider cập nhật. Dung lượng đã lưu và usage tính theo kỳ có thể giảm khác nhau; không bảo đảm xóa sẽ hoàn lại quota đã tính.

Khi sắp đầy: xác định metric/unit và nguồn tăng; hạn chế deploy dư; giảm artifact tương lai; cleanup được phép; đánh giá tối ưu/gói trả phí/migrate với chi phí tổng. Không tự nâng gói hoặc rewrite Git history; đó là hành động cần phê duyệt riêng.