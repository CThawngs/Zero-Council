---
name: verify-app
description: Drive Zero Council in real Chrome over CDP to verify behaviour before reporting done. Use before any "done", "works", "fixed", or "verified" claim about UI or engine behaviour.
---

# verify-app

Lái app thật, lấy bằng chứng, rồi mới nói "xong". Rule 19/32: tài liệu không thay hành vi đã kiểm.

## Vì sao không dùng `agent-browser`

Cài CLI global là thay đổi máy, cần consent (rule 9). Node 24 có sẵn `WebSocket` + `fetch`, Chrome đã nằm trên đĩa. Ba driver hiện có, **zero dependency**:

| File | Dùng để |
|---|---|
| `tests/drive-council.mjs` | Vòng họp: mention, handoff, `stop @bot`, `@all` |
| `tests/drive-keys.mjs` | Màn Integrations + key sai phải báo lỗi, không giả vờ |
| `tests/drive-persist.mjs` | Reload thật giữa chừng + xoá phòng thật |

```powershell
pnpm build                                              # BẮT BUỘC, xem "stale bundle" bên dưới
pnpm start -p 3232                                      # cổng trống
node tests\drive-council.mjs  http://127.0.0.1:3232 council-room.png
node tests\drive-keys.mjs    http://127.0.0.1:3232 council-keys.png
node tests\drive-persist.mjs http://127.0.0.1:3232 council-persist.png
```

**Truyền đúng tên ngắn** (`council-room.png`). Driver tự ghi vào `.agent/evidence/<tên>`, nên đừng `Move-Item` — sẽ tạo file trùng rồi lệch tên. Truyền tên riêng như `drive-council.png` sẽ đẻ ra một ảnh trùng nội dung.

Dọn: kill `node`, xoá `.zc*-out.txt`. Ảnh và JSON trace **đã** nằm sẵn trong `.agent/evidence/`.

## Bẫy đã mắc — đọc trước khi viết driver mới

**1. `/` là landing marketing, không phải workspace.** Trước mọi thao tác phải bấm `Start free council`.

**2. Button trong `<dialog>` đã đóng vẫn được `querySelectorAll` trả về.** Driver sẽ bấm nhầm và báo `MISSING` trong khi thật ra tìm thấy. Luôn lọc `getBoundingClientRect().width > 0`.

**3. Cùng nhãn, hai màn khác nghĩa.** `Open room` = vào phòng sống. `Start council` ở trang Sessions = mở **bản ghi chỉ đọc**, không có composer. Screenshot "MISSING: ..." là cách nhanh nhất để thấy mình đang ở sai màn.

**4. Input React có kiểm soát phải đặt qua native setter.** Gán `.value` trực tiếp thì React không thấy:
```js
const proto = el.tagName === 'TEXTAREA' ? HTMLTextAreaElement : HTMLInputElement;
Object.getOwnPropertyDescriptor(proto.prototype, 'value').set.call(el, v);
el.dispatchEvent(new Event('input', { bubbles: true }));
```

**5. Cắt transcript bằng `lastIndexOf` là sai.** Cố vấn **lặp lại** câu hỏi của người nên `lastIndexOf` chém vào giữa câu. Chụp `length` **trước** khi submit, rồi `slice(start)`.

**6. `Page.navigate` và `reload` giết state trong RAM.** Key BYOK sống trong RAM — reload là mất. Xếp thứ tự driver theo thứ này: vào phòng → nối key → quay lại **bằng điều hướng trong app**. Driver đầu tiên của tôi reload giữa chừng, phòng rơi về scripted, và driver vẫn báo PASS.

**7. Server giữ bundle cũ.** `next build` + restart trước mỗi lần lái. Sửa code mà quên build thì bằng chứng nói dối.

**8. Đừng tin check dựa trên regex lỏng.** `reported = /error/i.test(text) || text.length > 0` luôn đúng. Check phải **có thể fail**: soi dấu hiệu "việc thật đã xảy ra" (ví dụ: không còn câu `From my lens` ⇒ key đã thật sự được gọi).

## Bằng chứng phải trả lời được

- Ảnh chụp + JSON trace trong `.agent/evidence/`.
- **Check quan trọng nhất là đường hỏng, không phải đường đúng.** Nối key sai, xoá phòng rồi reload, dừng cố vấn rồi hỏi lại. Đường lỗi sai thì người dùng mất tiền mà không biết.
- Screenshot chỉ bổ sung. Nếu phải chọn một, chọn phần text có thể đọc ngược.

## Tự check trước khi nộp

```powershell
pnpm exec tsc --noEmit ; pnpm exec eslint src ; pnpm build
node --test tests\chat-engine.test.mjs tests\byok.test.mjs tests\storage.test.mjs
```

Skill này chưa chạy thử thì **là bản nháp** (rule 19).