# Zero Council — Prototype UI integration spec

Cập nhật: 2026-09-24. Governance: v7.1.
Trạng thái: IMPLEMENTED / PR_PENDING. Tiêu chí runtime thật vẫn ngoài scope.
Nguồn prototype: `CThawngs/Prototype-UI-Zero-Council` tại commit `fb0742e375ae82af9d494f757b82211b270ed857`.
Worktree task: `.worktrees/feature-prototype-ui-integration`; branch `feature/prototype-ui-integration`; base `52764ea8f3d52e82662374af133158b58196fa72`.

## Mục tiêu và bối cảnh

CONFIRMED theo S1: website hội đồng AI hỗ trợ ra quyết định qua nhiều persona, phân tích và tổng hợp; hiển thị đúng provider/model. Không thay chuyên gia y tế, pháp lý hoặc tài chính; không cam kết kết quả quyết định tốt hơn khi chưa đo.
Đồ án Chuyên ngành, lớp 25C2-LTM1, ngành Lập trình máy tính, học kỳ 1 năm 2026–2027; 1 tín chỉ, 15 tuần. S1 báo đề tài đã đăng ký; chưa kiểm phiếu gốc.
Nhóm: Nguyễn Chí Thắng (Zero), Lê Tấn Minh Tâm, Đào Nguyên Anh. Phân công dưới đây là dự kiến, không suy thành quyền merge/deploy.
S3 CONFIRMED: mở đăng ký công khai, chỉ đăng nhập Google. User đầu tiên, độ tuổi/quốc gia và bằng chứng nghiên cứu nhu cầu còn OPEN; chủ dự án giao đề xuất tình huống demo.
Disk Cleaner MCP là phương án dự phòng đã hoàn thiện từ trước theo S1; nếu dùng cần công khai nền tảng có sẵn, không tạo tiến độ giả.

## Phạm vi yêu cầu

CONFIRMED nghĩa là S1 nêu rõ mong muốn, không phải đã xây hoặc đã kiểm chứng.

| ID | Ưu tiên | Hành vi | Nguồn / trạng thái |
| --- | --- | --- | --- |
| REQ-01 | P0 | Fan-out cố vấn song song, sau đó orchestrator tổng hợp điểm chung, khác biệt và kết luận | S1 / CONFIRMED |
| REQ-02 | Lõi hỗ trợ | Đánh giá thiếu thông tin, hỏi 1–2 câu làm rõ trước fan-out | S1 / CONFIRMED; giới hạn số lượt hỏi OPEN |
| REQ-03 | P0 | GUI tạo/sửa persona: tên, vai trò, system prompt, model, bật/tắt công cụ | S1 / CONFIRMED |
| REQ-04 | Lõi hỗ trợ | AI tạo bộ persona mặc định theo yêu cầu | S1 / CONFIRMED; thứ tự triển khai OPEN |
| REQ-05 | P0 | BYOK mã hóa phía server; mỗi user/provider một key; 2–3 provider | S1 / CONFIRMED; provider đầu tiên OPEN |
| REQ-06 | Lõi hỗ trợ | Kiểm key trước lưu bằng request nhỏ, hướng dẫn lấy key, demo dùng key nhóm giới hạn | S1 / CONFIRMED; budget và consent request tính phí OPEN |
| REQ-07 | P0 | Web search khi cần qua tool calling | S1 / CONFIRMED; dịch vụ tìm kiếm và người trả phí OPEN |
| REQ-08 | P0 | Đính kèm PDF, DOCX, ảnh, text làm ngữ cảnh | S1 / CONFIRMED; kích thước, OCR, lưu giữ OPEN |
| REQ-09 | P1 | AI chọn hoặc user chọn thủ công: Tốt/Bình thường/Xấu, Six Thinking Hats, ma trận có trọng số | S1 / CONFIRMED |
| REQ-10 | P1 | Hiển thị trực quan kết quả khung quyết định | S1 / CONFIRMED; ranh giới với SVG P2 OPEN |
| REQ-11 | P2 | Panel code/Markdown/SVG theo format contract; SVG sanitize và iframe sandbox | S1 / CONFIRMED, chỉ làm nếu còn thời gian |
| REQ-12 | P2 | Round-robin tranh luận hữu hạn, tối đa 2–3 vòng | S1 / CONFIRMED, chỉ làm sau fan-out ổn định |
| REQ-13 | Xuyên suốt | Minh bạch provider/model, cảnh báo giới hạn tư vấn, không chạy plugin/code tùy ý | S1 / CONFIRMED |

Ngoài phạm vi: plugin thực thi code, harness/file system ảo đầy đủ, HTML/JS tương tác, billing thương mại, memory dài hạn, khung quyết định ngoài ba loại trên. Không hứa sandbox “RCE-proof”.

## Luồng và tiêu chí chấp nhận đề xuất — chờ duyệt

- AC-01: Với input đủ và provider giả lập, các cố vấn khởi chạy không đợi nhau; tổng hợp chỉ dùng kết quả nhận được và có nguồn persona/model. Trace kiểm thứ tự, không chỉ đo thời gian.
- AC-02: Khi input thiếu, hiển thị câu hỏi làm rõ; chưa fan-out. Trần lượt hỏi và quyền bỏ qua cần chốt.
- AC-03: Khi một cố vấn timeout/429/lỗi, hiển thị đúng trạng thái, không bịa ý kiến. OPEN: tổng hợp phần còn lại hay dừng; ngưỡng tối thiểu và retry budget.
- AC-04: User A không xem/sửa/xóa key, persona, chat hay file của user B; kiểm quyền server từng thao tác. Demo/BYOK là chế độ sử dụng, không phải cơ chế phân quyền.
- AC-05: Key không xuất hiện trong DB dưới dạng rõ, response, log hoặc bundle client. Đề xuất AES-256-GCM qua thư viện chuẩn, nonce riêng mỗi lần mã hóa, authentication tag, version khóa; không tự chế crypto. Unique constraint (user_id, provider); hỗ trợ thay/xóa key. Chưa cần multi-key nhưng vẫn cần đường thu hồi và recovery khi mất khóa mã hóa.
- AC-06: Validate key phân biệt sai key với hết quota, mất mạng, timeout và model không được cấp quyền; một lần hợp lệ không đảm bảo hợp lệ mãi. Request kiểm phải có trần chi phí được duyệt.
- AC-07: File sai loại/quá giới hạn bị từ chối trước xử lý; nội dung file và kết quả search là dữ liệu không tin cậy, không cấp quyền tool hoặc đọc secret. Chỉ gửi tới provider theo phạm vi dữ liệu đã duyệt.
- AC-08: Ma trận kiểm lựa chọn, trọng số và điểm hữu hạn; tính tổng bằng code xác định thay vì tin số AI viết. AI gợi ý trọng số không biến thành sở thích đã chốt của user.
- AC-09: Đề xuất P1 render từ JSON có schema bằng component cố định; SVG tùy ý do AI sinh giữ ở P2. Nếu làm SVG: sanitize theo allowlist, iframe không cấp script/same-origin, chặn tải tài nguyên ngoài; kiểm cấu hình thực, không coi iframe tự chặn mạng.
- AC-10: Có trạng thái tải/rỗng/lỗi/thành công, thao tác bàn phím, focus/label và responsive. Dừng/hủy phiên, reconnect, lưu phiên dở và streaming: OPEN.
- AC-11: Demo có giới hạn mỗi user và trần toàn hệ thống; BYOK vẫn có giới hạn agent, token, thời gian, concurrency và tool calls. Không mô tả “không giới hạn”.

## Hiệu chỉnh kỹ thuật cần giữ khi viết báo cáo

- 3 cố vấn + 1 tổng hợp = ít nhất 4 lần gọi model, dù cố vấn chạy song song; bước phân loại/hỏi lại/search có thể thêm lượt. Fan-out là một vòng cố vấn, không phải một request API tổng cộng.
- Round-robin 3 cố vấn × 2–3 vòng + 1 tổng hợp = 7–10 lần gọi cơ bản. So với 4 lần fan-out là 1,75–2,5 lần số gọi; không suy thành tỷ lệ tiền. Chi phí phụ thuộc token tích lũy, model và tools; “gấp 6–9 lần” chưa có bằng chứng.
- BYOK chuyển chi phí model sang user, không loại chi phí hosting, DB, file, băng thông, search hoặc demo. Không phải bằng chứng hệ thống chịu tải lớn.
- Function calling của provider không giống hệt nhau; phải kiểm capability theo model và chuẩn hóa phần thật sự dùng. Chưa chọn dependency/adapter hoặc cam kết hỗ trợ tương đương.
- Six Thinking Hats nêu 5 góc nhìn + 1 điều phối, mâu thuẫn trần 2–3 cố vấn. OPEN: nhiều góc nhìn trong 3 cố vấn hay chế độ riêng 5+1 với ngân sách khác.
- Sanitize/iframe là kiểm soát cần kiểm thử, không bằng chứng cách triển khai nội bộ chính thức của nền tảng thương mại nào.

## Công nghệ và nhóm — dự kiến, chưa chốt triển khai

S1 đề xuất Next.js / React / TypeScript / Tailwind, API Routes, PostgreSQL trên Neon + Drizzle; OpenAI, Anthropic, Gemini. OPEN: phiên bản, router, auth, hosting, search, lưu file, region và ngân sách. Không tạo dịch vụ hoặc cài dependency trong vòng này.
Công cụ S1 nêu: Git/GitHub, Google Antigravity, VS Code, Claude Code, Figma/Google Stitch. Phiên hiện tại dùng DSH; không suy cấu hình client của từng thành viên.

| Thành viên | Phân công dự kiến từ S1 |
| --- | --- |
| Nguyễn Chí Thắng | Phân tích/quản lý, backend/DB, orchestration |
| Lê Tấn Minh Tâm | Frontend/UX, test/tài liệu, sơ đồ DB |
| Đào Nguyên Anh | BYOK/bảo mật key, sơ đồ DB, khung kịch bản |

## Lịch đã báo — không phải tiến độ đã xác minh

| Tuần | Ngày 2026 | Đầu ra theo S1 |
| --- | --- | --- |
| 1–2 | 17/08–30/08 | Khảo sát, phạm vi |
| 3 | 31/08–06/09 | Yêu cầu, use case |
| 4 | 07/09–13/09 | Kiến trúc, công nghệ |
| 5 | 14/09–20/09 | Schema, script DB |
| 6 | 21/09–27/09 | Prototype UI |
| 7–9 | 28/09–18/10 | Lập trình, mục tiêu 70–80% |
| 10 | 19/10–25/10 | Tích hợp, báo cáo lần 1 |
| 11 | 26/10–01/11 | Kiểm thử, bug report |
| 12 | 02/11–08/11 | Hoàn thiện |
| 13 | 09/11–15/11 | Báo cáo theo mẫu khoa |
| 14–15 | 16/11–29/11 | Demo, bảo vệ |

Theo ngày máy 2026-09-18 đang tuần 5. Chưa có bằng chứng đầu ra tuần 1–4; cần xin tài liệu hiện có, không làm lại hoặc điền tiến độ giả. Kế hoạch môn học vẫn được lưu; kiểm thử trong xây dựng không phải đợi tuần 11.
Tiêu chí S1: phân tích/thiết kế 20%, lập trình/chất lượng 40%, tài liệu 20%, bảo vệ 20%.

## Điều mở trước phần triển khai tiếp theo

| ID | Cần chốt | Người chốt | Chặn |
| --- | --- | --- | --- |
| OPEN-01 | Đầu ra tuần 1–4 đã có, việc ưu tiên ngay; scope demo kín hay public, user đầu tiên | Chủ dự án | Kế hoạch và G0/G1 |
| OPEN-02 | Git local/remote, quyền commit/push, reviewer, visibility/license | Chủ repo | Đồng bộ và chính sách Git |
| OPEN-03 | Đăng nhập, vai trò, lịch sử chat, thời hạn lưu/xóa file và dữ liệu | Chủ dự án | Schema và auth |
| OPEN-04 | Ngân sách hosting/DB/search/demo, tài khoản đã có, provider/model đầu tiên | Chủ dự án | Chọn dịch vụ và API thật |
| OPEN-05 | Cố vấn lỗi: tiếp tục hay dừng; số cố vấn; Six Hats; P1 JSON cố định so với SVG P2 | Chủ dự án + reviewer kỹ thuật | Orchestration/contract |

G0/G2: HOLD phần xây dựng phụ thuộc quyết định còn mở; được tiếp tục tài liệu và Git đã ủy quyền. G3–G6: chưa đánh giá. Chưa chạy app/test/restore, chưa gọi model tính phí.

## Cập nhật S3 — vòng 2 (ưu tiên hơn trạng thái cũ)

| ID | Quyết định / yêu cầu | Trạng thái |
| --- | --- | --- |
| REQ-14 | Đăng ký công khai, duy nhất Google OAuth; lưu lịch sử hội thoại theo session | CONFIRMED |
| REQ-15 | User xóa session qua UI thì hard-delete session và nội dung phụ thuộc khỏi DB hoạt động, không chỉ ẩn hoặc soft-delete | CONFIRMED |
| REQ-16 | Ngân sách vận hành của nhóm 0 USD; không bật billing, nạp tiền, dùng trial có tự thu phí hoặc fallback trả phí | CONFIRMED |
| DEC-01 | Dùng Supabase Free thay định hướng Neon; Vercel free là hosting dự kiến | Supabase Free do user báo; dự án/schema tồn tại và Vercel eligibility chưa kiểm |
| DEC-02 | Agent được init Git, nối remote, commit, push nhánh task, tự review và merge vào main khi ổn | DELEGATED; required checks và review bắt buộc thực tế vẫn phải đạt |

Không có tài khoản/API key provider AI nào theo S3. Danh sách provider user biết không phải danh sách tích hợp được chốt hoặc bằng chứng miễn phí. Tên “Grod”, “Cloudfare”, “Gork” cần xác nhận có phải Groq, Cloudflare, Grok (xAI); không đoán endpoint từ tên. Không cần tích hợp tất cả; 2–3 provider vẫn là trần phạm vi ban đầu. Chưa quyết định 0 USD áp dụng cả chi phí key của người dùng ngoài nhóm hay chỉ chi phí nhóm.

### Hợp đồng xóa session cần kiểm khi xây

- Kiểm chủ sở hữu tại server và RLS (Row Level Security: quyền truy cập từng dòng), không tin user_id từ client. Xác nhận rõ trên UI trước hành động không thể hoàn tác.
- Xóa session, messages, runs, kết quả cố vấn/artifacts và metadata phụ thuộc bằng transaction/foreign key cascade phù hợp. Không cascade sang tài khoản, persona dùng lại hoặc API key.
- Generation đang chạy không được tạo lại session đã xóa: hủy best-effort, từ chối ghi kết quả muộn bằng ràng buộc DB, không upsert tái tạo parent.
- PostgreSQL DELETE không đảm bảo trả dung lượng đĩa ngay: MVCC giữ phiên bản dòng cũ; VACUUM thường cho phép tái sử dụng không gian, không luôn làm file nhỏ lại. Không chạy VACUUM FULL tự động mỗi lần xóa; có khóa và nhu cầu dung lượng riêng.
- Object Storage tách khỏi DB transaction: xóa row không tự xóa file. OPEN: xử lý file tạm hay lưu cùng session; nếu lưu cần cleanup đáng tin cậy, retry hữu hạn và không báo xóa hoàn tất khi object còn tồn tại.
- Không hứa xóa ngay backup/WAL/log hoặc bản sao tại provider AI. Thời hạn giữ và khả năng xóa của từng bên cần công bố trước public; không lưu nội dung chat vào log mặc định.
- Regression cần có: user khác không xóa được; xóa đúng toàn bộ con; gọi xóa lặp có kết quả xác định; kết quả generation đến muộn không hồi sinh dữ liệu; lỗi Storage không bị che; thông báo lỗi không lộ session người khác.

### Đề xuất demo (chưa coi đã duyệt)

Nhóm đầu tiên: sinh viên/người mới đi làm, quyết định học tập/công việc rủi ro thấp, không đưa dữ liệu nhạy cảm.
Kịch bản chính: “Có 8 tuần, 8 giờ/tuần, ngân sách 0 đồng; nên ưu tiên học backend, frontend hay làm portfolio để xin thực tập?” User xác nhận tiêu chí/trọng số trước ma trận, phân biệt dữ kiện với giả định.
Kịch bản phụ: lập kế hoạch hoàn thành đồ án theo Tốt/Bình thường/Xấu; phân tích cách phân công nhóm theo Six Thinking Hats.
Đề xuất 3 cố vấn + 1 điều phối; nếu 1 cố vấn lỗi và còn 2 kết quả thì tổng hợp có cảnh báo; dưới 2 thì dừng, không giả đồng thuận. Six Hats/P1 JSON vẫn cần chốt riêng.

### Ngân sách và nguồn chính thức đã đọc

Ngày kiểm 2026-09-18, chưa kiểm quota của tài khoản thật:
- Vercel Hobby: https://vercel.com/docs/plans/hobby — giới hạn personal/non-commercial, không tự kết luận mọi public app hoặc đồ án nhóm đủ điều kiện. Public registration không tự là thương mại; eligibility vẫn cần kiểm trước deploy.
- Supabase database size: https://supabase.com/docs/guides/platform/database-size — phân biệt dữ liệu và disk, có tình huống read-only khi vượt giới hạn. Không lấy thao tác DELETE làm bằng chứng quota giảm tức thì.
- Supabase backup: https://supabase.com/docs/guides/platform/backups — không suy Free có quyền restore như gói trả phí; cần chính sách sao lưu và thử khôi phục riêng.
- Gemini pricing: https://ai.google.dev/gemini-api/docs/pricing — free tier/model có giới hạn và bảng sử dụng dữ liệu để cải thiện sản phẩm; không chọn chỉ dựa giá token. Điều khoản cho public app, dữ liệu người dùng, tuổi/vùng và search phải kiểm trước kích hoạt.

Đề xuất giới hạn global và mỗi user cho chat/token/concurrency/storage; hết quota dừng rõ ràng. Demo có thể dùng fixture gắn nhãn “dữ liệu mẫu, không gọi AI” khi chưa có key; không giả đó là kết quả live. Web search P0 còn OPEN về dịch vụ miễn phí hợp lệ; không thay search bằng kết quả bịa hoặc scraping trái quyền.

### OPEN còn lại sau S3

- OPEN-01: Supabase project/schema đã có chưa? Cần URL dashboard hoặc export schema chỉ cấu trúc, không mật khẩu/key/dữ liệu người dùng; các tài liệu tuần trước vẫn chưa có.
- OPEN-02: Remote public, default branch main, GitHub MCP xác thực CThawngs với quyền push/admin đã quan sát. Chưa có commit; cần cách tạo base main đầu tiên ngoài quy trình push task-only, không âm thầm push main. License và required rules chưa chốt.
- OPEN-03: Người dùng mục tiêu, tuổi/quốc gia; file lưu cùng session hay chỉ tạm; nội dung được phép gửi free-tier AI và retention bên thứ ba.
- OPEN-04: 0 USD là ngân sách nhóm hay cấm cả key trả phí user tự mang? Provider đầu tiên, key, search và quotas cụ thể chưa chọn.
- OPEN-05: Chốt demo, fallback khi lỗi, Six Hats, P1 JSON; ngưỡng quota là đề xuất, chưa được coi duyệt.

## Cập nhật S4/S5 — ưu tiên hơn OPEN lịch sử

CONFIRMED từ câu trả lời chủ dự án: chọn Supabase Free, chưa có project/schema. Bỏ Neon khỏi lựa chọn DB hiện tại. Chỉ Google OAuth cho đăng nhập, không phải chỉ Google làm provider AI.
Ngân sách nhóm 0 USD; user thực tế được BYOK chọn model trả phí và tự chịu phí. Guard zero-cost chỉ áp dụng chi phí nhóm/demo khi tích hợp, không áp dụng toàn bộ BYOK.
File lưu theo session, xóa cùng session trong DB và private Storage; giới hạn dung lượng cụ thể còn OPEN.
Đã cho phép bootstrap main, đã thực hiện; PR #1 được merge trên GitHub, base main 94e53b2 quan sát bằng git fetch/log. Không suy việc merge là GitHub tự đồng bộ nhánh.
S5 ủy quyền scaffold/cài dependencies, docs, commit/push và merge khi checks đạt. Chủ dự án tự tạo Supabase theo docs/SETUP.md; chưa ủy quyền deploy/public runtime.
Scope lần này: Next.js scaffold + trang mẫu viết sẵn, setup Supabase. Chưa xây fan-out, callback auth, migration hoặc session persistence; mock không được gọi là phản hồi model thật.

## Task addendum — prototype UI integration (2026-09-24)

CONFIRMED scope:
- Tích hợp giao diện prototype tại `/`; giữ fixture tiếng Việt cũ tại `/fixture`.
- Giữ view, navigation, visual system, state tạm và mock interaction của prototype.
- English là mặc định; toggle Vietnamese giữ nguyên.
- Không thêm backend, AI inference, auth, payment, provider request, credential input/storage/transmission, BYOK runtime hoặc persistence.
- Provider/model labels là fixture; checkout và provider slots chỉ mô phỏng UI, không hành động tài chính hoặc kết nối dịch vụ.
- Không merge PR. Chỉ commit, push branch và mở PR vào `main`.

AC / verify:
- `pnpm lint`, `pnpm exec tsc --noEmit`, `pnpm build` từ `web/`: pass trên worktree trước commit cuối.
- `node --test tests/budget.test.mjs` từ repo root: 2 pass, 0 fail.
- Browser QA tại `http://127.0.0.1:3100/`: mobile 390×844 không overflow; reload không console error; không XHR/fetch/WebSocket; local/session storage rỗng; các flow overview, session, synthesis, counter-draft, settings, provider slots, pricing, language/theme và `/fixture` đã kiểm.
- Evidence phải ghi rõ commit/hash và trạng thái PR sau khi commit; không dùng bằng chứng cũ cho source đã đổi.

Risk / recovery:
- Rủi ro chính là copy làm giả production hoặc accessibility regression; đã thêm nhãn sample/mock, bỏ QR copy/payment detail và thêm tên/pressed state cho controls.
- Nếu cần rollback: revert commit trên branch/PR, không merge và không đụng main checkout.

OPEN / delegated:
- Chưa có CI/ruleset, deploy, Supabase, OAuth, provider, billing hoặc persistence trong task này.
- ZeroVault lesson sẽ ghi sau khi PR mở; không ghi secret.
