# FEATURE_MAP — Zero Council

Kiểm kê UI và engine **tại thời điểm `2e1e828`**. Mục đích: không ai đọc copy landing rồi tưởng đã có.

Cột **Bằng chứng** chỉ ghi bằng chứng thật. Trạng thái `CHƯA CÓ CODE` nghĩa là chỉ có lời.

---

## 1. Engine vòng họp — `web/src/prototype/chat/engine.ts`

| Tính năng | Trạng thái | Bằng chứng |
|---|---|---|
| Mention `@bot` mở lượt | ✅ | 25 test + lái Chrome |
| Không mention → theo thứ tự vào phòng | ✅ | `planSpeakers` |
| Handoff A2A qua tool call `message_agent` | ✅ | test adapter, nhưng ⚠️ chưa có model thật |
| `[SILENT]` — cố vấn không có ý kiến thì im | ✅ | test |
| `stop @bot` giữ riêng cố vấn đó | ✅ | lái Chrome |
| `@all` mời lại | ✅ | lái Chrome |
| Rò rỉ handoff qua prose | ✅ **đã chặn** | test: prose có `@name` ⇒ `handoffs: []` |
| Trần lượt + trần phòng | ⚠️ `12` / `200` | Chủ dự án chốt. **Chưa phải vô hạn** |
| Memory riêng từng cố vấn, `/compress` | ❌ **CHƯA CÓ CODE** | Không có |

⚠️ **Quan trọng nhất bảng này:** cột A2A ✅ nghĩa là *routing đúng*, **không** phải *model thật đã từng phát ra handoff*. Không có provider nào từng được gọi. `scriptedGenerator` tuân thủ hợp đồng mà không suy nghĩ.

## 2. Provider — `web/src/prototype/chat/byok.ts`

| Tính năng | Trạng thái | Bằng chứng |
|---|---|---|
| Adapter Anthropic (`/v1/messages`) | ✅ | 9 test, `fetch` stub |
| Adapter OpenAI (`/v1/chat/completions`) | ✅ | 9 test, `fetch` stub |
| Phòng hỗn hợp nhiều provider | ✅ | mỗi cố vấn gọi vendor riêng |
| Tool call hỏng ⇒ giữ câu trả lời, trao `user` | ✅ | cờ `attempted` |
| Key trong RAM, không lưu, không log | ✅ | lái Chrome: key không lọt vào DOM |
| **Gọi provider thật** | ❌ **CHƯA TỪNG** | Không có key nào trong môi trường |

## 3. Phòng — `web/src/prototype/chat/storage.ts`

| Tính năng | Trạng thái | Bằng chứng |
|---|---|---|
| Sống sót qua reload | ✅ | lái Chrome, reload thật, transcript giống từng ký tự |
| Xoá phòng thật (xoá cả store) | ✅ | lái Chrome, không quay lại |
| Blob build cũ bị từ chối | ✅ | test schema |
| Store hỏng / bị chặn ⇒ không crash | ✅ | test |
| Lịch sử lâu dài, nhiều thiết bị | ❌ **CHƯA CÓ CODE** | `sessionStorage` chết theo tab |

## 4. Lớp vỏ sản phẩm

| Tính thật | Trạng thái |
|---|---|
| Đăng nhập / đăng ký | ❌ `SignInView` rỗng, `currentUser.ts` trả `null`. **Giao cho đồng nghiệp** |
| Thanh toán / đơn hàng | ❌ stub, `orders.ts` rỗng |
| API route `/api/council` | ❌ 5 dòng, trả fixture. BYOK **không** đi qua đây |
| Giới hạn theo gói (2/4/8 cố vấn) | ✅ đã chặn thật, xác nhận "2 of 2 selected" |
| `features/`, đa ngữ | ✅ |

---

## 5. ⚠️ Landing đang hứa thứ chưa có

Mục này tồn tại để không ai bán nhầm. **Sửa copy là việc của chủ sản phẩm** (rule 28.3 — không đoán chính sách).

| Landing hứa | Thực tế |
|---|---|
| "AES-256" cho API key | **Không có mã hoá nào.** Key nằm thô trong RAM tab |
| "Cuộc trò chuyện được mã hoá" | **Không có mã hoá nào.** Transcript nằm trong `sessionStorage` dạng rõ |
| "Vòng lặp vô hạn" | Có trần `12` lượt |
| "Nhớ ngữ cảnh riêng từng cố vấn" | Chưa có |

Cách sửa không cần hạ tính năng: **nói đúng**. "Key của bạn nằm trong tab này, không lưu, không gửi qua máy chủ tôi, F5 là mất" bán được và **không sai**. AES-256 thì không bán được khi chưa có.

## 6. Việc còn nợ

- `.agent/HANDOFF.md` chưa cập nhật cho cấp 12–13.
- Ghi quyết định lên Notion (AI OS Documentation) — chưa làm.

---

## 7. Gộp PR #18 vào main (2026-10-09)

Mục này viết lại sau khi gộp. **Mốc trước đó (`2e1e828`) nằm trên `main` cục bộ, chưa từng lên GitHub** — đó là 3 ngày công làm sau PR #18, làm nhầm trên nhánh `main` thay vì trên branch của PR, rồi chết giữa chừng lúc `git merge origin/main`.

### Đã đưa vào

| Từ | Gì | Bằng chứng |
|---|---|---|
| `origin/main` | UI deliberation (Scenario/Hats/Matrix), auth Google/Discord, payOS, coupon | đã merge qua PR #13–#17 |
| local main (4 commit) | chat engine A2A có cấu trúc, BYOK Anthropic+OpenAI, `sessionStorage`, `FEATURE_MAP` này | 119 test · lái Chrome `ALL_CHECKS_PASS` |
| PR #18 | `read-link.ts` + **33 test**, `ci/smoke.mjs`, `.github/workflows/verify.yml` (CI tự bật app), tài liệu `verify-app/features/` | smoke 4/4 exit 0 |
| PR #18 | **3 test membership** viết lại cho engine đang chạy (`plan.ts`) | `tests/deliberation.test.mjs` 19/19 |

### ⚠️ Không đưa vào — và vì sao

PR #18 còn một nhánh thiết kế cũ **không ghép được** với engine đã chạy:

| Phần của PR #18 | Vì sao bỏ |
|---|---|
| `lib/deliberation/engine.ts` thứ 2 (`createDeliberationEngine`: timeout 30s, cancel, attachment, streaming) | Kiến trúc khác hẳn: bản đang chạy có `FrameworkOutput`/`MatrixData`/`buildFixtureRound`, bản PR #18 thì không. `FrameworkPanel` + `RoundThread` + `scoreMatrix` cần bản đang chạy. **Đây là feature thật chưa lên main** — xem mục 8. |
| 59 key copy deliberation bị xoá | Bản PR #18 xoá hết vì nó thay UI deliberation bằng UI riêng. Giữ UI cũ thì phải giữ key. |
| `AdvisorConversation`, `CouncilSetupBar`, `PendingRoundPanel`, `AttachmentPicker` | 4 component của thiết kế UI cũ, không route tới từ `App.tsx` sau khi gộp. Membership nay do `JoinRoomModal` + cap theo gói đảm nhiệm. |
| `EmptyChamberView` + `SessionActiveView` bản PR #18 | Lấy bản `origin/main`. Membership của PR #18 nằm ở tầng engine (`plan.ts`) nên không mất. |

## 8. Nợ lớn nhất sau khi gộp

**Engine `createDeliberationEngine` của PR #18 chưa lên main.** Nó có những thứ bản đang chạy không có: deadline 30s, cancel giữa chừng, attachment (đọc link/file), streaming `onContribution`, và `requestProblems` từ chối request hỏng **trước khi** tốn tiền. 27 test kèm theo đã bị bỏ cùng file.

Đưa lên thì **không sửa chồng `engine.ts`** — phải đặt cạnh (`deliberation/engine-v2.ts`) và chuyển `AppContext` sang từng đường một, giữ `FrameworkPanel` chạy từng vòng. Việc nhiều ngày, không làm vội trong lượt gộp này.

Nhỏ hơn, làm được ngay:
- `read-link.ts` **chưa route nào gọi** — cố ý. Endpoint đọc URL tuỳ ý mà chưa đăng nhập là proxy mở cho ai tìm thấy.
- `.agent/skills/verify-app/features/*.md` của PR #18 mô tả lái bằng Playwright; repo không có Playwright. Driver thật là `tests/drive-*.mjs` (Node + CDP). **Tài liệu sai so với repo** — cần sửa hoặc xoá.

---

## 9. Đóng nốt mảng còn lại của PR #18 (2026-10-09, sau khi merge)

Mục 8 là nợ đã được trả. Số ở mục này là **sau** khi nó đóng.

### Lên rồi

| Tính năng | Trạng thái | Bằng chứng |
|---|---|---|
| `engine-v2.ts` — hợp đồng deadline/cancel/streaming/membership | ✅ đứng cạnh `engine.ts` | **23 test** `tests/engine-v2.test.mjs` |
| `requestProblems` + `rosterProblems` trong `plan.ts` | ✅ trước mọi lần gọi provider | 4 test trong `engine-v2.test.mjs` |
| **Chat room từ chối request hỏng trước khi tốn tiền** | ✅ | `a bad request is refused before any advisor is asked` |
| **Deadline theo lượt** — `TurnFailure{kind:'timeout'}` trước đây có trong type nhưng **không chỗ nào sinh ra** | ✅ giờ có | `an advisor that never answers is dropped` |
| **Stop dừng thật** — trước đó chỉ đổi nhãn, hội đồng vẫn trả lời, provider vẫn bị tính tiền | ✅ `AbortController` + `fetch` bị huỷ | `Stop discards the answer an advisor was still writing` · lái Chrome |
| **Streaming** — tin nhắn hiện ngay khi từng cố vấn trả lời | ✅ `onTurn` | `each advisor appears as it answers` |
| **Đính kèm link** — đọc 1 lần lúc ghim, mang theo tin nhắn | ✅ | 3 test · `drive-attach.mjs` `ALL_CHECKS_PASS` |
| `read-link-web.ts` — tầng đọc link phía browser | ✅ 7 test | `tests/read-link-web.test.mjs` |

Test: **160/160** (trước: 122). Build 0 · `tsc` 0 · eslint 0 lỗi.

### Vẫn nợ — và đây là lý do

**Đọc link chạy trong trình duyệt, không qua server.** `read-link.ts` chặn SSRF bằng `node:dns` nên **không** bundle được cho client (Turbopack fail thật: *"the chunking context does not support external modules: node:dns/promises"*). Parser đã tách ra `html-text.ts` để dùng chung; phần fetch thì có hai đường:

| Đường | Trạng thái | Đánh đổi |
|---|---|---|
| Browser fetch (`read-link-web.ts`) | ✅ đang dùng | Đa số website không gửi CORS → **bị chặn**. Phòng nói thẳng là không đọc được chứ không giấu. |
| Server route qua `read-link.ts` | ❌ cố ý chưa làm | Endpoint đọc URL tuỳ ý mà chưa đăng nhập là **proxy mở**: ai tìm thấy cũng dùng băng thông của bạn. Cần quyết định của chủ sản phẩm + rate limit + auth. |

Không tự mở route. Đây là câu hỏi đã nêu từ PR #18 và vẫn chưa có câu trả lời.

### Vẫn chưa chứng minh

- **Chưa từng gọi provider thật.** Toàn bộ bằng chứng dùng `scriptedGenerator` và key giả. Cơ chế deadline/cancel đã test bằng generator hỏng, nhưng chưa từng giết một request `fetch` thật đang bay.
- **Chưa đọc được link thật qua mạng.** `drive-attach.mjs` dán `http://127.0.0.1/` (cùng origin) và một URL bị CORS chặn. Chưa từng đọc được một trang thật ở domain khác.