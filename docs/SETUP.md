# Thiết lập Local & Production — Zero Council

Tài liệu hướng dẫn chạy local, cấu hình biến môi trường, áp dụng Supabase migrations và chạy bộ cổng kiểm tra trước khi mở PR hoặc deploy lên Vercel.

## 1. Yêu cầu hệ thống & Chạy local

- **Node.js**: Node 24 LTS (khuyến nghị `>= 24.18.0`)
- **Package manager**: `pnpm` (`10.x` / corepack theo `web/package.json`)

Tại thư mục gốc repository:

```sh
pnpm --dir web install --frozen-lockfile
cp web/.env.example web/.env.local
pnpm --dir web dev
```

Mặc định ứng dụng chạy tại `http://localhost:3000`. Nếu chưa điền Supabase / PayOS trong `web/.env.local`, ứng dụng tự động rơi về chế độ lưu trữ file cục bộ cho mục đích phát triển giao diện và kiểm thử nhanh (các đường dẫn mô phỏng thanh toán dev tự động khóa cứng `404` trên môi trường production / `VERCEL=1` hoặc khi đã gắn khóa PayOS thật).

## 2. Biến môi trường chuẩn (11 biến)

Sao chép từ [`web/.env.example`](../web/.env.example) sang `web/.env.local` khi chạy máy cá nhân, hoặc cấu hình trên **Vercel → Project Settings → Environment Variables** (hoặc đẩy tự động qua workflow `.github/workflows/sync-vercel-env.yml`).

| Biến | Phạm vi | Bắt buộc Production | Mô tả |
| :--- | :--- | :---: | :--- |
| `SUPABASE_URL` | Server-only | Có | URL project Supabase dùng cho kết nối server-side. |
| `SUPABASE_SERVICE_ROLE_KEY` | Server-only | Có | Service-role key đọc/ghi qua tầng API server (vượt RLS; **tuyệt đối không** gắn `NEXT_PUBLIC_`). |
| `NEXT_PUBLIC_SUPABASE_URL` | Public (Build + Runtime) | Có | URL project Supabase cho phiên đăng nhập trình duyệt / OAuth. |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Public (Build + Runtime) | Có | Publishable / anon key của Supabase Auth (RLS đã khóa truy cập bảng trực tiếp ở migration `0010`). |
| `ZC_PROVIDER_KEY_SECRET` | Server-only | Có | Khóa AES-256-GCM (chuỗi base64 của đúng 32 byte ngẫu nhiên) mã hóa BYOK API keys. Khi `VERCEL=1`, thiếu hoặc sai định dạng sẽ fail-closed ngay lập tức. |
| `PAYOS_CLIENT_ID` | Server-only | Có | Client ID kênh thanh toán payOS (`https://my.payos.vn`). |
| `PAYOS_API_KEY` | Server-only | Có | API Key kênh thanh toán payOS. |
| `PAYOS_CHECKSUM_KEY` | Server-only | Có | Checksum Key dùng ký yêu cầu tạo đơn và xác thực chữ ký HMAC-SHA256 từ webhook payOS. |
| `NEXT_PUBLIC_SITE_URL` | Public (Build + Runtime) | Có | Origin chuẩn của sản phẩm (ví dụ `https://zerocouncil.app`), dùng cho OAuth callback redirect, kiểm tra CSRF same-origin, metadata/SEO và PayOS `returnUrl`/`cancelUrl`. |
| `NEXT_PUBLIC_ANALYTICS_WEBSITE_ID` | Public (Tùy chọn) | Không | Website ID của Umami Analytics (chỉ tải script sau khi người dùng đồng ý consent; để trống sẽ tắt hoàn toàn). |
| `FOUNDER_EMAILS` | Server-only (Tùy chọn) | Không | Danh sách email tối cao (phân tách bằng dấu phẩy) có quyền hạ quyền `admin` và đặt lại mật khẩu qua trang quản trị. |

### Sinh khóa `ZC_PROVIDER_KEY_SECRET`

```sh
openssl rand -base64 32
# hoặc dùng Node.js:
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

### Quy tắc bảo mật biến môi trường

- **Tuyệt đối không** khai báo `NEXT_PUBLIC_PAYOS_*` hoặc `NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY` để tránh rò rỉ khóa bí mật vào bundle trình duyệt.
- Các tên biến cũ bị gõ nhầm (`PAYLOS_*`) chỉ còn giữ làm alias dự phòng phía server để tương thích ngược; mọi cấu hình mới dùng tên chuẩn `PAYOS_*`.

## 3. Cơ sở dữ liệu Supabase & Webhook PayOS

1. Áp dụng tuần tự toàn bộ các file SQL trong `web/supabase/migrations/` từ `0001_zero_council_schema.sql` đến `0010_lockdown_rls_and_indexes.sql`.
   - Lưu ý: Migration `0010` thu hồi quyền truy cập bảng trực tiếp của role `anon`/`authenticated` qua PostgREST (mọi thao tác dữ liệu đều đi qua API routes của Next.js với kiểm tra session, quyền sở hữu và giới hạn gói dịch vụ), đồng thời bổ sung composite indexes cho truy vấn hội thoại, phiên làm việc và đơn hàng.
   - Không chạy seed catalog mẫu lỗi thời trên cơ sở dữ liệu production.
2. Cấu hình Google OAuth / Email Auth trên Supabase Dashboard với Redirect URL trỏ tới `<NEXT_PUBLIC_SITE_URL>/auth/callback`.
3. Trên dashboard payOS, cấu hình Webhook URL trỏ tới `<NEXT_PUBLIC_SITE_URL>/api/payos/webhook`. Endpoint `/api/health` trả trạng thái sẵn sàng của `supabaseConfigured`, `payosConfigured` và `encryptionKeyConfigured` (không bao giờ trả giá trị khóa).

## 4. Năm cổng kiểm tra bắt buộc trước khi mở PR

Chạy tại thư mục gốc repository và đảm bảo tất cả đều xanh:

```sh
node --test --test-timeout=60000 tests/*.test.mjs
pnpm --dir web exec tsc --noEmit
pnpm --dir web exec eslint
pnpm --dir web exec next build
git diff --check
```
