# 12. TASK, WORKTREE VÀ CỘNG TÁC SONG SONG

Mỗi task có hợp đồng ngắn:

```
ID / goal / scope / non-goals / owner
Yêu cầu nguồn / acceptance criteria / dependency
Base commit / branch / worktree / vùng thay đổi dự kiến
Verification / risk / quyền được giao / budget / rollback hoặc recovery
```

Chỉ song parallel khi nhiệm vụ độc lập đủ rõ. Agent phụ nhận mục tiêu, file/phần được giao, hợp đồng giao tiếp, giới hạn và cách báo kết quả. Quyền không rộng hơn agent giao việc. Người điều phối chịu trách nhiệm tích hợp và kiểm chứng; không coi nhiều agent đồng ý là bằng chứng đúng.

Worktree riêng cho tác vụ song song/hotfix cần cô lập. Dùng tool worktree của môi trường nếu có, theo giới hạn của tool đó; không thao tác trực tiếp worktree của người khác. Nếu không có, dùng Git chuẩn trong quyền được cấp. Chọn base commit rõ ràng và tên task, không tách từ một HEAD tùy ý chưa biết trạng thái.

Worktree chỉ cô lập file Git, không cô lập port, DB, queue, secret hoặc cloud resource. Mỗi task dùng port, schema/DB thử, namespace và tên tài nguyên riêng khi cần. Không cùng sửa dữ liệu dev dùng chung mà không phối hợp.

Kiểm issue/PR đang mở và thông báo phần giao nhau trước đổi shared contract. Cùng file không tự động bị cấm; khác file vẫn có thể xung đột hành vi. Nếu ranh giới phối hợp rõ, tiếp tục; nếu không thể suy ý nghĩa thay đổi, hỏi owner. Tách PR contract trước rồi các bên cập nhật khi thích hợp.

Dọn worktree chỉ khi task đã bàn giao/merge, không còn thay đổi cần giữ và được phép dọn. Squash merge không luôn được Git nhận là merged: kiểm nội dung/PR và commit trước xóa branch. Không force-delete để làm sạch cho nhanh.