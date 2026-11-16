# 28. HỆ THỐNG ĐỂ TIN AGENT (verification, tri thức viết ra, rào cứng)

Không phù phép để AI làm thay 100% — xây hệ thống **đủ tin cậy** để giao việc cho cả đội agent rồi người chủ duyệt kết quả. Ba trụ: **tự kiểm**, **tri thức viết ra**, **rào cứng**.

### 28.1. Verification harness — agent tự kiểm việc của chính nó

- Agent phải **chạy thật sản phẩm** để tự xác minh: mở dev build/app, thao tác như user (bấm, điền form), chụp màn hình, đọc trace/log, đo trước–sau, chạy test. Dùng công cụ sẵn có (browser/simulator automation, CDP) trong quyền được cấp; không có tool thì ghi hạn chế, không giả vờ.
- **Vòng lặp đóng:** sửa → chạy lại → xác nhận bug hết / perf cải thiện. Không có vòng đóng = **đoán mò**: AI tự tin “lỗi ở chỗ A” → sai → đoán chỗ B → vẫn sai, và người cũng đoán cùng, quy trình chết.
- **Bug: reproduce trước khi fix.** Không tái hiện được → nói “chưa tái hiện”, ghi giả thuyết + cách kiểm, đừng sửa mù.
- Với content/nội dung dung (bài, caption, marketing, tài liệu): cũng làm vòng đóng — tự chấm theo rubric (28.4), sửa, chấm lại trước khi nộp.
- Verification **không bảo đảm code đẹp**; nó bảo đảm **đúng hành vi** — đủ để tin hơn, không đủ để bỏ mọi kiểm tra.

### 28.2. Feature map — đường dẫn để agent không lạc

- `.agent/FEATURE_MAP.md`: sản phẩm có những màn hình/tính năng nào; **đường đi tới từng chỗ** (bấm gì, URL nào, route nào); selector/`data-testid`/DOM attribute quan trọng; cách test từng phần.
- Khách nói “sidebar trái lag” mà agent không biết sidebar ở đâu = **thiếu feature map**. Ảnh mờ + “???” vẫn phải xác định được màn hình nào nhờ feature map.
- **Cập nhật feature map là phần DoD của mọi thay đổi UI** — UI đổi mà map cũ = agent đi lệch, giống hỏng tài liệu.

### 28.3. Nguồn chân lý — thứ “nằm trong đầu bạn” phải viết ra

- Giá, tên thương hiệu, chính sách bảo hành/đổi trả, quy tắc đặt tên chiến dịch, thư mục ảnh gốc, nguồn data chính thức → file `SOURCES.md`/tài liệu riêng. **Agent phải đọc từ đó, không đoán, không nhớ từ trí nhớ chat, không bịa.** Không có nguồn → hỏi hoặc ghi `OPEN`.
- Áp dụng như nhau cho người không biết code: bài bán hàng, caption, kịch bản CSH — dữ liệu thật đến từ file nguồn, không từ “cảm giác của AI”.
- Chừng nào thứ này còn nằm trong đầu bạn → bạn vẫn phải nhắc lại mỗi lần giao việc. Viết ra là cách cắt việc đó.

### 28.4. Rubric tự chấm — đầu ra đạt là gì, tự kiểm trước khi nộp

- Mỗi loại việc có tiêu chí chấm cụ thể (code: DoD mục 14; bài viết: cấu trúc, độ dài, CTA, tone, từ khóa; caption: ví dụ bài đã work, hashtag, giọng; PR: scope, evidence, risk).
- Agent **tự chấm + báo điểm/nhận xét trước khi nộp**; điểm thấp → sửa rồi chấm lại, không nộp luôn. Đây là L0–L1 tự kiểm, không thay kiểm thử thật.

### 28.5. Skills/playbooks + evals — “unit test” cho cách làm việc của agent

- **Skill** = trang SOP agent đọc trước khi làm (đọc code đừng hallucinate; fix bug phải reproduce; sửa UI thì cập nhật feature map;…). Xây dần từ failure mode quan sát được, không viết trước hết loạt skill.
- **Eval** = kiểm thử skill: rubric + chạy task thật nhiều lần (có thể bằng sub-agent), môi trường eval **không lộ là eval** (agent biết đang bị test thì đổi hành vi), chạy cùng skill trên **nhiều model** để chọn model nào cho task nào, lặp cho tới khi đạt ngưỡng điểm.
- Chi phí: giai đoạn dựng harness/skill/eval **đắt nhất**; sau đó vận hành rẻ hơn nhiều. Đây là cách đổi “ngồi duyệt từng kết quả” thành “hệ thống tự chặn”.

### 28.6. Lỗi lần 1 nhắc, lỗi lần 2 thành luật — nguyên tắc rẻ nhất và mạnh nhất

- Rào mềm (nhắc trong prompt) agent có thể quên. Rào cứng (rule + lint + CI) **chặn được cả khi agent cố bỏ qua**.
- Nguyên tắc: lỗi lặp lần 1 → nhắc, sửa. Lần 2 → **đừng nhắc nữa, biến thành luật hệ thống** (rule + CI check + nguồn chân lý). Câu hỏi: làm sao biến lời nhắc thành quy định bắt buộc? làm sao hệ thống tự báo lỗi thay bạn nhắc? làm sao triệt tiêu lỗi đó?
- Ví dụ thật, tuỳ stack: cấm pattern footgun hay gây bug (vd `useEffect` trong React nếu kiến trúc chọn cách khác); **cấm AI tự sinh comment “giải thích” code** (99% là lặp lại hoặc suy diễn từ nhận xét PR thành “luật” rồi chèn note sai vào code, gây hiểu nhầm lâu dài); chặn output vượt định dạng/ngân sách cho nội dung.
- Rule mới phải có: lý do từ sự cố thật, owner, phạm vi, ngoại lệ, cách gỡ. Rule không bám sự cố thật = clutter.

### 28.7. Greenfield vs brownfield — cảnh báo vibe-code

- **Greenfield prototype tốc hành không guardrail** → agent chọn lối tắt, code spiral, sau này refactor tốn hàng trăm PR. Bài học đắt (một case được báo: ~600 PR refactor sau prototype) — **prototype cũng phải có constraints từ đầu**: rule, test, giới hạn phạm vi, CI tối thiểu.
- **Brownfield có guardrail sẵn** (convention, lint, CI, constraint) → agent làm việc an toàn hơn, vì đường ngắt nhất hợp lệ cũng là đường đúng.
- Nguyên tắc chung: **làm ẩu mà nhanh hơn thì agent sẽ làm ẩu; làm đúng mà là đường ngắn nhất thì agent tự đi đúng.** Đường người phải là đường agent chọn.