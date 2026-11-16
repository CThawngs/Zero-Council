# 18. MIGRATION, BACKUP VÀ KHÔI PHỤC

- Schema thay đổi qua migration có version, owner, thứ tự, kiểm khóa/downtime và tương thích bản app cũ/mới. Không sửa migration đã chạy chung để che lịch sử.
- Ưu tiên expand–migrate–contract cho thay đổi ảnh hưởng người dùng: thêm tương thích, chuyển dữ liệu, kiểm đầy đủ rồi mới loại cũ.
- Test DB rỗng và dữ liệu giả đại diện phiên bản trước; xác nhận quyền, constraint, index, số lượng/tính nhất quán phù hợp. Backfill lớn có giới hạn tải, checkpoint, khả năng chạy lại an toàn.
- Down migration không phải lúc nào an toàn. Có thể dùng rollback app + forward fix, restore hoặc phục hồi theo thời điểm; ghi rõ mất dữ liệu/downtime dự kiến. Drop table/column có backup, rehearsal và phê duyệt riêng.
- Backup có RPO/RTO được chủ trách nhiệm chốt, lịch, retention, mã hóa, quyền truy cập, vùng lưu giữ và chi phí. Managed DB không đảm bảo gói hiện tại đã bật backup/PITR.
- Thử restore trong môi trường cô lập theo lịch/rủi ro; ghi thời điểm bản sao, thời gian khôi phục, kiểm tính đầy đủ và giới hạn. Backup chưa restore thử là khả năng khôi phục chưa được chứng minh.
- Xác định backup cả DB, object storage và cấu hình cần thiết; replica/sync không mặc định thay backup. Kiểm rủi ro cùng tài khoản bị mất quyền hoặc xóa.
- Kế hoạch xóa dữ liệu cá nhân phải xét backup và nghĩa vụ giữ dữ liệu; khi restore không làm sống lại dữ liệu đã có yêu cầu xóa mà không xử lý lại theo chính sách.