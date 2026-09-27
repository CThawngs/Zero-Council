# Bàn giao cho đồng nghiệp — auth + Supabase

PayOS và coupon đã xong phía code. Còn đúng **4 việc** nằm ở phía bạn. Làm xong là chạy được hết.

Không cần hiểu phần payOS, không cần hiểu phần coupon. Bạn chỉ cần: dựng bảng, dựng `currentUser`, và bật webhook.

---

## A. Supabase — 5 phút

### A1. Apply 2 file migration

Vào Supabase Dashboard → SQL Editor, chạy lần lượt, theo đúng thứ tự:

```
web/supabase/migrations/0001_zc_orders.sql
web/supabase/migrations/0002_zc_coupons.sql
```

Phải đủ cả hai. `0002` không chạy thì **thanh toán hỏng luôn**, chứ không chỉ mất coupon — xem mục D.

`0002` có `alter table zc_orders` thêm 3 cột, nên chạy sau `0001` là đúng.

### A2. Tạo admin đầu tiên

Chạy đúng một câu này, một lần, bằng tay. Sửa email thành email của bạn:

```sql
insert into zc_users (email, role) values ('email-cua-ban@example.com', 'admin')
on conflict (email) do nothing;
```

Đây là **gốc tin cậy** của toàn bộ hệ thống admin — không có đường nào tự phong admin được. Từ đó bạn vào `/admin` phong người khác.

> Chỉ cần chạy câu này **một lần duy nhất**. Sau này thêm/bớt admin thì làm trong giao diện, không cần SQL nữa.

### A3. Lấy 2 biến môi trường

Supabase → Project Settings → **API**:

| Tên | Chỗ lấy | Ghi chú |
|---|---|---|
| `SUPABASE_URL` | Project URL | `https://xxxx.supabase.co` |
| `SUPABASE_SERVICE_ROLE_KEY` | Service Role → `service_role` | **Không phải** `anon` key |

`service_role` bỏ qua RLS nên mới ghi được. Token anon sẽ bị chặn ở tất cả bảng — đó là chủ ý: trình duyệt không bao giờ nói chuyện thẳng với Supabase, mọi việc đi qua API của app.

### A4. Đặt 2 biến đó lên host

Có 2 cách, chọn 1:

**Cách 1 — nếu bạn vào được Vercel**: Project → Settings → Environment Variables → thêm 2 biến trên.

**Cách 2 — nếu không vào được Vercel** (bạn không có quyền): dùng workflow có sẵn trong repo.

1. Vào GitHub repo → **Settings → Secrets and variables → Actions** → tab **Secrets** (không phải Variables)
2. Tạo: `VERCEL_TOKEN`, `VERCEL_PROJECT_ID_OR_NAME`, `VERCEL_TEAM_ID`, rồi 2 biến Supabase ở trên
3. Actions → **Sync Vercel env** → **Run workflow**

Chi tiết: `README.md` → mục "2c".

### A5. Redeploy

Vercel chốt biến env **theo từng lần deploy**. Thêm biến xong mà không redeploy thì code vẫn dùng biến cũ.

---

## B. Auth — đúng MỘT hàm

Mở `web/src/lib/currentUser.ts`, thay thân hàm `authenticateFromSession`:

```ts
const authenticateFromSession = async (): Promise<SessionUser | null> => {
  return null;   // ← thay dòng này
};
```

Cần làm: đọc session/cookie của hệ thống auth bạn dựng, rồi trả về:

```ts
{ id: <định danh user của bạn>, email: 'email@...' }
// hoặc
null            // khách chưa đăng nhập
```

Hai ràng buộc, sai là hỏng:

1. **`email` phải là email thật, lowercase.** Mọi thứ trong hệ thống (coupon, quyền admin, gói) khoá theo `email`. Trả về email sai thì tài khoản đó thấy quyền của người khác. Nên `return { id, email: email.trim().toLowerCase() }`.
2. **Không bao giờ tin email do trình duyệt gửi lên.** Đọc từ session phía server.

> `id` hiện **chưa có chỗ nào dùng** — trả id thật của hệ thống bạn cũng được, để dành. Trả chuỗi bất kỳ cũng chạy. Chỉ `email` là thứ có ý nghĩa lúc này.

Sau khi điền xong, xoá `ZC_DEV_LOGIN_EMAIL` khỏi mọi nơi. Nếu biến này còn trên Vercel thì **mọi khách truy cập đều là tài khoản đó**, và nếu tài khoản đó là admin thì cả trang quản lý coupon mở công khai. (Code đã tự chặn biến này trên Vercel, nhưng cỡi ra luôn cho sạch.)

### Vì sao chỉ một hàm

Tất cả phần role, quyền, coupon, gói đã dựng sẵn quanh hợp đồng này. Không có chỗ nào khác cần sửa. Nếu sau này thấy thiếu, báo tôi — đừng tự mở rộng.

---

## C. payOS — bật webhook

Đây là mảnh **chưa từng chạy thật** của cả hệ thống: chưa quan sát được đơn nào chuyển từ PENDING sang PAID. Không có nó thì khách trả tiền xong hệ thống không biết.

Trên tài khoản payOS của bạn, đăng ký webhook URL:

```
https://<domain-cua-ban>/api/payos/webhook
```

Sau khi có domain Vercel thật, cần thử một lượt thanh toán thật để xác nhận đơn chuyển sang PAID và gói được cấp. Tôi không làm được vì webhook không gọi được vào `localhost`.

---

## D. Thứ tự làm — sai thứ tự là hỏng

```
1. Apply 0001 + 0002 vào Supabase        ← trước tiên, tuyệt đối
2. Seed admin đầu tiên (A2)
3. Đặt SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY lên host
4. Deploy lại (A5)
5. Điền authenticateFromSession (B)
6. Bật webhook payOS (C)
7. Thử 1 lượt thanh toán thật
```

Lý do bước 1 phải trước: code ghi đơn gửi kèm `user_email`, `coupon_code`, `coupon_percent`. Supabase **từ chối thẳng** nếu bảng thiếu cột đó, và lúc đó **mọi lượt thanh toán đều fail**, kể cả không dùng coupon. Lỗi hiện dạng `SUPABASE_400:...` trong log server.

Deploy trước rồi apply migration cũng dính lỗi tương tự.

---

## Kiểm tra nhanh sau khi xong

| Kiểm tra | Kết quả đúng |
|---|---|
| Mở `/admin` khi chưa đăng nhập | Báo cần đăng nhập, không phải trang trắng |
| Mở `/admin` bằng tài khoản admin | Thấy danh sách coupon + tài khoản |
| Mở `/admin` bằng tài khoản thường | Bị chặn (403) |
| Tạo coupon 20% | Sửa được, thấy trong danh sách |
| Mua gói `pro` với coupon 20% | Tổng = 111.200đ (139.000 − 20%) |
| Mua gói `pro` với coupon 100% | **Không** tới payOS, vào thẳng có gói 1 tháng |
| Dùng lại cùng mã | Bị chặn "đã dùng" |
| Chờ hết 1 tháng rồi vào lại | Tự về gói miễn phí, không cần ai làm gì |

Dòng cuối là điểm cốt lõi: hạn dùng được **tính lúc đọc**, không có cron, nên không có job nào có thể chết và để lại gói treo.

---

## Bảng trong Supabase sau khi có dữ liệu

| Bảng | Chứa gì |
|---|---|
| `zc_orders` | Đơn hàng, kèm ai mua và mã coupon đã dùng |
| `zc_users` | Tài khoản + thẻ vai trò `admin` |
| `zc_coupons` | Danh sách mã |
| `zc_coupon_redemptions` | Lượt dùng. Khoá chính `(coupon_code, user_email)` — đây chính là luật "1 mã, 1 lần mỗi tài khoản" |
| `zc_grants` | Gói đang có và hạn dùng |

Tất cả bảng đều bật RLS và **không có policy nào** — tức là anon và authenticated đều bị chặn, chỉ `service_role` mới truy cập được. Đó là chủ ý.
