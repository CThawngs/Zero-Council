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