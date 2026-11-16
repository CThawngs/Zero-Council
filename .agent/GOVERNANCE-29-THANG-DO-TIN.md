# 29. THANG ĐỘ TIN & TĂNG TẰM — leo bậc bằng bằng chứng, không bằng cảm hứng

Mở nhiều agent mà vẫn phải đọc từng bài = vẫn là 1 người làm, chỉ đổi từ “viết” sang “duyệt” (mệt hơn). Mục tiêu: mỗi bậc uỷ quyền chỉ leo khi có bằng chứng.

| Bậc | Agent được | Điều kiện leo lên bậc sau |
| --- | --- | --- |
| D0 | Chỉ đọc, đề xuất, giải thích | Owner xác nhận hiểu đúng, không lỗi nghiêm trọng |
| D1 | Sửa task nhỏ trong worktree riêng, có test | N task liên tiếp verified qua CI, 0 vi phạm nghiêm trọng |
| D2 | Giao task đầy đủ, tự mở PR (chưa merge) | PR qua review ổn định, không cần sửa tay nhiều |
| D3 | Tự merge trong phạm vi rủi ro thấp (docs/style/routine) | Ruleset + CI xanh bắt buộc, tests đủ, có kill switch + audit |
| D4 | Tự chạy vòng lặp dài/cloud agent cho việc rủi ro thấp | Bằng chứng ổn định theo thời gian, ngân sách trần, quyền kill rõ |

- Điều kiện leo bậc chung: bằng chứng liên tiếp, CI/rules thật sự chạy, có người chịu trách nhiệm, kill switch và audit. Hạ bậc khi có vi phạm hoặc sự cố do thay đổi.
- Đừng nhảy cóc: chưa tin 1 agent mà spawn 100 cloud agent = đốt token.
- Auto-merge (D3+) chỉ khi: ruleset bắt buộc reviewer/check, CI xanh, test + invariant đủ, vùng không nhạy cảm vẫn cần người duyệt, audit log đầy đủ, tắt được tức thời.