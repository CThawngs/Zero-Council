# Feature map — Zero Council prototype

Thư mục này **trống có chủ đích**. Nguồn chân lý cho "sửa UI xong chưa?" nằm ở
[`features/FEATURE_MAP.md`](../../../../features/FEATURE_MAP.md) ở gốc repo.

## Vì sao xoá

Bốn file ở đây (`tao-chat-nhom`, `nhan-trong-chat`, `dinh-kem`, `doi-ngon-ngu`) mô tả
một UI **không còn tồn tại**: tick account → **Open chat**, nút **Attach**, **Add link**.
Sau khi gộp PR #18 (2026-10-09) luồng thật là:

- `EmptyChamberView` → nhập câu hỏi + chọn framework, hoặc bấm mở phòng
- `JoinRoomModal` → chọn cố vấn + cách trao lượt, có cap theo gói
- `ChatRoomView` → composer, không có ô đính kèm

Giữ lại thì đây là tài liệu sai so với app — tệ hơn không có. Rule: tài liệu không
thay hành vi thực đã kiểm.

Selector và trạng thái kiểm của từng màn nằm ở `features/FEATURE_MAP.md`. Cách lái
app thật lấy bằng chứng nằm ở `../SKILL.md` với ba driver Node + CDP
(`tests/drive-council.mjs`, `drive-keys.mjs`, `drive-persist.mjs`). Repo **không**
có Playwright; tài liệu cũ từng nói có là sai.