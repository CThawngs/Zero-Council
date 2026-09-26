# Zero Council

Giao diện song ngữ cấu trúc quyết định khó: định khung câu hỏi, đối chiếu nhiều góc nhìn, kết thúc bằng tiêu chí xem lại và bước tiếp theo. Nội dung hội đồng là văn bản minh họa cố định đi kèm ứng dụng, không phải khuyến nghị được tính ra.

## Trạng thái

Next.js 16.3.5 / React 19.2.8 / TypeScript / Tailwind 4 tại `web/`.
Luồng `/` dùng React/browser memory; refresh đặt lại state. Chưa có model/provider, lưu transcript, auth, credential, analytics hoặc deploy — UI ghi rõ những phần này "chưa có trong bản này".
`/fixture` hiển thị nội dung minh họa song ngữ cố định. `/api/council` là route nội dung cố định riêng và giao diện `/` không gọi route này.
Thanh toán một lần qua payOS có thật (xem "Thanh toán"). Chưa có subscription, auth hay cấp quyền theo gói.

## Chạy

Node 24 LTS, pnpm 11.5.2. Tại repo root:

```sh
pnpm --dir web install --frozen-lockfile
pnpm --dir web dev
```

URL mặc định http://localhost:3000; xem terminal nếu port bận. Không cần API key để xem mẫu.

```sh
node --test tests/budget.test.mjs
pnpm --dir web lint
pnpm --dir web exec tsc --noEmit
pnpm --dir web build
```

Guard giá ở `src/lib/budget.mjs` là kiểm tra scaffold cũ, không được nối vào app/provider trong local mock này.

```sh
node --test tests/payos.test.mjs   # chữ ký HMAC + bảng mã giảm giá
```

## Thanh toán (payOS)

Số tiền nằm ở một chỗ duy nhất: `web/src/prototype/data/plans.ts`. Server đọc từ đó; trình duyệt chỉ gửi `planId`, không bao giờ gửi số tiền.

### 1. Tạo tài khoản và cổng thanh toán

1. Đăng ký tại <https://my.payos.vn> và xác minh pháp nhân (cá nhân hoặc doanh nghiệp).
2. Tạo **payment channel** (cổng thanh toán) — cần tài khoản ngân hàng nhận tiền.
3. Trong trang cấu hình API của cổng, copy đúng 3 giá trị: **Client ID**, **API Key**, **Checksum Key**. Checksum Key dùng để ký và xác thực — mất nó thì không kết nối lại được.

### 2. Điền biến môi trường

```sh
cp web/.env.example web/.env.local
```

`web/.env.local` đã được git-ignore. Điền:

```
PAYLOS_CLIENT_ID=...
PAYLOS_API_KEY=...
PAYLOS_CHECKSUM_KEY=...
```

Tùy chọn:

```
PAYLOS_DISCOUNT_CODES=WELCOME=10000,PARTNER=25000   # CODE=số tiền giảm (VNĐ)
ZC_ORDER_STORE=/đường/dẫn/orders.json                  # mặc định web/.zc-orders.json
```

Để trống `PAYLOS_DISCOUNT_CODES` nghĩa là mọi mã đều bị từ chối — đây là mặc định an toàn.

### 3. Chạy

```sh
pnpm --dir web build
pnpm --dir web start
```

Bấm **Chọn Pro** ở trang Pricing → **Thanh toán qua PayOS** → trình duyệt chuyển tới trang payOS hiển thị QR. Sau khi chuyển khoản, payOS gọi webhook rồi người mua quay lại `/checkout/return?orderCode=...`.

Nếu thiếu biến môi trường, nút báo lỗi và không chuyển trang — server trả `503 PAYLOS_NOT_CONFIGURED`.

### 4. Đăng ký webhook

Trong cấu hình cổng payOS, đặt URL webhook là:

```
https://<tên-miền-của-bạn>/api/payos/webhook
```

Phải là HTTPS public. `localhost` không nhận được webhook — khi thử local phải mở tunnel (`cloudflared tunnel --url http://localhost:3000` hoặc `ngrok http 3000`) rồi dán URL tunnel vào.

Webhook chỉ chuyển trạng thái đơn sang `PAID` khi chữ ký HMAC hợp lệ **và** số tiền khớp đúng số tiền đã lưu. Không có đường nào báo "đã thanh toán" mà không qua payOS.

### 5. Giới hạn đã biết

- Order lưu trong **một file JSON** (`ponytail:`). Chạy được trên một tiến trình Node với ổ đĩa bền; **hỏng trên serverless**, trên nhiều instance, và có race khi ghi đồng thời. Khi cần chạy thật nhiều máy, chuyển sang Postgres/Supabase.
- Trạng thái `PAID` **không cấp quyền gì cho tài khoản** vì chưa có auth. Trang quay lại chỉ báo trạng thái đơn.
- Chỉ thanh toán **một lần**, chưa có gia hạn định kỳ. Hạn mức 2/4/8 advisor là con số hiển thị, chưa có engine nào ép áp.
- Cần kiểm tra lại tên trường `x-partner-code` nếu tài khoản payOS của bạn bật partner code (hiện route không gửi header này).

## Tài liệu

- [Spec](.agent/SPEC.md) — phạm vi và ranh giới local mock hiện tại.
- [Bàn giao](.agent/HANDOFF.md) — evidence và trạng thái kiểm chứng.
- [Quy trình](AGENTS.md).

Thay đổi qua nhánh task/PR. Không commit secret hoặc `.env.local`; không bật dịch vụ trả phí. Repo public không đồng nghĩa được cấp license mã nguồn mở.
