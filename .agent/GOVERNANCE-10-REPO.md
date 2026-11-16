# 10. LƯU QUY TRÌNH TRONG REPO VÀ BÀN GIAO GIỮA AGENT

Một prompt đầy đủ ở `.agent/GOVERNANCE.md` là nguồn quy trình. `AGENTS.md` ngắn, mục tiêu khoảng 5.000 ký tự, là hướng dẫn vào cửa chứ không thay thế bản đầy đủ. Index chỉ phần cần đọc theo task. Khi công cụ có giới hạn context, nạp lõi an toàn và phần liên quan; không nói rằng nội dung đã được paste không tốn context.

Tạo hoặc dùng lại tài liệu tương đương, tránh nhân đôi:

```
AGENTS.md                      Luật lõi và đường dẫn nguồn đầy đủ
README.md                      Sản phẩm, trạng thái, cách bắt đầu
CONTRIBUTING.md                Nhận việc, chạy thử, mở PR, hỏi ở đâu
SECURITY.md                    Kênh báo lỗ hổng kín
LICENSE                        Chỉ thêm license đúng lựa chọn đã duyệt
.agent/GOVERNANCE.md           Bản đầy đủ này
.agent/00_INDEX.md             Bản đồ tài liệu, phiên bản, lệnh và owner
.agent/SPEC.md                 Yêu cầu đã chốt và điều mở
.agent/FEATURE_MAP.md          Màn hình/tính năng, đường đi tới, selector, cách test
.agent/SOURCES.md              Nguồn chân lý: giá, thương hiệu, chính sách, quy tắc đặt tên
.agent/skills/                 SOP agent đọc trước khi làm (mục 28.5)
.agent/evals/                  Rubric + bộ test cho skills (mục 28.5)
.agent/ARCHITECTURE.md         Thiết kế hiện tại, ranh giới, invariant
.agent/DECISIONS.md            Quyết định và lý do
.agent/TODO.md                 Kế hoạch, trạng thái, evidence
.agent/DEFINITION_OF_DONE.md   Kiểm tra cần cho từng loại task/rủi ro
.agent/DESIGN.md               UX và quy ước giao diện
.agent/MARKETING.md            Nghiên cứu, định vị, kênh, thử nghiệm
.agent/METRICS.md              Định nghĩa chỉ số, SLO, dashboard, chi phí
.agent/LEGAL.md                Bản đồ nghĩa vụ, nguồn, người duyệt
.agent/RUNBOOK.md              Cảnh báo, sự cố, khôi phục, liên hệ
.agent/HANDOFF.md              Trạng thái phiên, việc tiếp, giới hạn
.agent/issues/OPEN|FIXED/      Khi không dùng issue tracker tương équ
 docs/SETUP.md                 Hướng dẫn setup người mới
 .env.example                 Tên biến và mẫu an toàn, không secret
```

Các khoảng trắng trước `docs/` và `.env.example` trong sơ đồ chỉ để trình bày, không thuộc tên đường dẫn.

Không tạo mọi thư mục/script rỗng ngay lập tức. Bootstrap tạo phần tối thiểu đã cần; các cổng sau buộc hoàn thiện phần liên quan trước khi đi tiếp. Mục chưa biết ghi `OPEN` có owner thay vì bịa nội dung.

### Decisions

ID dùng `YYYY-MM-DD-NN`; kiểm tra trùng trước merge. Khi nhiều người tạo cùng ngày, thêm hậu tố task/contributor ổn định hoặc dùng ID issue để tránh trùng; ngày không tự giải quyết xung đột.

```
ID / tiêu đề / ngày / người chốt
Context / Evidence (nguồn, thời gian, version)
Decision / Alternatives rejected / Consequences
Rollback hoặc recovery / điều kiện xem xét lại
```

Không ghi mọi thay đổi nhỏ thành decision. Evidence không chứa secret hoặc bản sao dữ liệu cá nhân.

### TODO bốn cấp cho dự án lớn

```
# TODO
Last updated: ...
L4 total: N | Done: N | Partial: N | Open: N
Completion: verified L4 / total L4 * 100%
## [ ] CẤP 1: Mục tiêu sản phẩm
### [ ] CẤP 2: Khả năng cần có
- [ ] CẤP 3: Kết quả bàn giao
  - [ ] CẤP 4: Task-ID | owner | phụ thuộc | tiêu chí | evidence
```

- [ ]  `[ ]` chưa hoàn thành; `[~]` đang làm/partial; `[X]` đã kiểm chứng. Cấp cha xong khi mọi con trong phạm vi còn hiệu lực xong. Task hủy ghi lý do, không tính là đã hoàn thành. Tổng bằng 0 thì báo N/A. Phần trăm đếm task không phải ước lượng công sức, mức sẵn sàng production hoặc giấy phép xóa local. Dự án nhỏ dùng checklist phẳng; không bẻ một dòng sửa lỗi thành bốn cấp.

### Handoff và chống mất context

Trước dừng/đổi agent: ghi mục tiêu, phiên bản governance/spec, branch/worktree, commit/base, thay đổi chưa commit, task đang chạy, kết quả test, quyền/giới hạn, điều mở và bước tiếp. Không lưu chuỗi suy nghĩ nội bộ; chỉ quyết định, bằng chứng và trạng thái hành động. Agent tiếp theo kiểm lại trạng thái thật, không tin vô điều kiện báo cáo cũ. Bàn giao không yêu cầu paste lại prompt nếu công cụ đã được cấu hình nạp đúng.