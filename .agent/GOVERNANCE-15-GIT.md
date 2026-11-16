# 15. GIT, PR, REVIEW VÀ MERGE

- Branch ngắn theo task: `feature/`, `fix/`, `hotfix/`, `refactor/`, `chore/`, `docs/` theo chuẩn repo. Giới hạn tuổi branch là mục tiêu phối hợp, không cấm cứng theo số ngày bất kể dự án.
- Commit mô tả đúng một thay đổi logic: `<type>(<scope>): <mô tả>`. Body ghi lý do, breaking change và liên kết issue/decision khi cần. Tránh commit mơ hồ; không sửa history chia sẻ khi chưa phối hợp.
- Commit chỉ phần mình được giao; xem staged diff trước commit. Không dùng `git add .` mù trong working tree có việc người khác.
- PR nhỏ, dễ review; khoảng 400 dòng là tín hiệu xem xét, không trần tuyệt đối. Generated files/lockfile cần giải thích riêng. Không chia PR chỉ để lách kiểm tra.
- Tự review theo rủi ro: yêu cầu, lỗi, quyền, dữ liệu, tương thích, vận hành. Không bịa đủ 3 lỗi khi không tìm được; ghi đã kiểm gì và hạn chế.
- Người review đọc code/diff liên quan và kiểm evidence đúng commit. Reviewer do chính agent tác giả đóng vai không được tính là phê duyệt độc lập bắt buộc.

Mẫu PR:

```
Mục tiêu / issue hoặc yêu cầu nguồn
Thay đổi và phần không đổi
Đọc file nào trước
Evidence: lệnh/run URL, commit, môi trường, kết quả
Risk: dữ liệu, quyền, API, UI, hiệu năng, chi phí
Rollback/recovery / migration / docs
Điều chưa kiểm tra / review cần từ ai
```

Squash merge có thể là mặc định đã chốt; dùng merge/rebase theo chuẩn repo, không đổi tùy mỗi agent. Trước merge kiểm **kết quả tích hợp với base hiện tại** bằng merge queue hoặc kiểm tra merged result được nền tảng hỗ trợ; không nhất thiết buộc mọi PR merge main thủ công. Commit/base đổi thì test/approval bị ảnh hưởng cần làm mới.

CODEOWNERS khai người phụ trách, không khóa chỉnh sửa và không tự enforce duyệt. Bật ruleset/branch protection yêu cầu checks, reviewer/owner, xử lý approval cũ, hạn chế push/force-push và bypass. Kiểm mức hỗ trợ theo gói/nền tảng. Không có reviewer phù hợp thì giữ PR chờ hoặc hạn chế prototype, không tự tạo approval giả.

**Xanh không có nghĩa là an toàn.** CI xanh chỉ chứng minh những gì nó kiểm. Trước khi merge: đối chiếu thay đổi có đúng bằng chứng mục 14/28.1 không; chuỗi PR nhiều cái chỉ land được phần **liên tiếp đã kiểm chứng tính từ gốc**; agent viết PR **không tự merge phán quyết của chính nó** (31.4). Bình luận từ bot review/agent kiểm tra bảo mật: thái độ **nghi ngờ** — chúng bắt được bug thật nhưng cũng gửi cảnh báo sai và nitpick; chọn sửa / bác bỏ có lý do / hỏi, **đừng sửa code để làm hài lòng bot** (churn code vô nghĩa).