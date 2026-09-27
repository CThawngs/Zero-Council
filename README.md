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
node --test tests/payos.test.mjs      # chữ ký HMAC + bảng mã giảm giá
node --test tests/order-store.test.mjs # order store Postgres (stub PostgREST) + fallback file
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
SUPABASE_URL=...                  # https://<project-ref>.supabase.co
SUPABASE_SERVICE_ROLE_KEY=...     # server only, bypasses RLS
```

Tùy chọn:

```
PAYLOS_DISCOUNT_CODES=WELCOME=10000,PARTNER=25000   # CODE=số tiền giảm (VNĐ)
ZC_ORDER_STORE=/đường/dẫn/orders.json                  # chỉ khi CHƯA có Supabase
```

Để trống `PAYLOS_DISCOUNT_CODES` nghĩa là mọi mã đều bị từ chối — đây là mặc định an toàn.

**Khi deploy**, các biến này đặt trong env của host (Vercel → Project Settings → Environment Variables), **không** phải trong file. Như vậy xoá sạch folder ở máy không mất gì.

> **Vì sao không đặt secret thẳng trong GitHub?**
> GitHub có *Actions secrets* và *Environment secrets*, nhưng cả hai chỉ được bơm vào **workflow run** — app đang chạy không đọc được. Nếu commit `.env.local` vào repo thì nó nằm trong git history **vĩnh viễn** (xoá file sau không gỡ được, mọi người từng clone đều còn), và lộ vào log của mọi CI job. Đó là thứ rule 8 của repo này cấm.
>
> Vercel cũng **không** đọc env từ GitHub khi build: Git integration lấy biến từ dashboard của Vercel. Đặt ở GitHub mà không có bước đẩy sang thì build vẫn ra app không có secret — Next inline `process.env.X` thành `undefined`, build vẫn xanh, webhook trả 503 vĩnh viễn. Đã gặp đúng lỗi đó ở lượt trước.
>
> Nếu bạn không có quyền vào Vercel project, xem mục **2c** bên dưới.

### 2b. Bảng order, coupon, subscription (chỉ cần cho deploy)

Order lưu ở Postgres qua PostgREST. Apply **hai** migration, theo thứ tự:

```sh
web/supabase/migrations/0001_zc_orders.sql
web/supabase/migrations/0002_zc_coupons.sql
```

Bằng một trong ba cách — Supabase CLI (`supabase db push`), SQL Editor trong dashboard, hoặc Management API `POST https://api.supabase.com/v1/projects/{ref}/database/query` với token `sbp_`. **DDL không chạy được qua PostgREST**, nên đừng thử POST file SQL vào `/rest/v1/`.

Tên bảng là `public.zc_orders`; các call REST dùng tên `zc_orders` (không có `public.`).

Chưa apply thì app vẫn chạy local — rơi về file JSON. Nhưng trên Vercel (đĩa tạm) mà thiếu DB thì server **từ chối ghi order** thay vì âm thầm mất đơn.

**Cần seed admin đầu tiên** sau khi apply `0002`. Chạy đúng một câu, một lần, bằng tay — đây là gốc tin cậy, nên không có đường nào tự phong admin được:

```sql
insert into zc_users (email, role) values ('email-cua-ban@example.com', 'admin')
on conflict (email) do nothing;
```

Từ đó chính admin đó phong user khác lên `admin` trong trang `/admin`. Không có admin thì trang đó trả 403 cho mọi người.

### 2b-bis. Chạy trang admin ở local

Chưa có auth thì cần một đường đăng nhập giả, **chỉ ở máy bạn**. Thêm vào `web/.env.local`:

```
ZC_DEV_LOGIN_EMAIL=email-cua-ban@example.com
```

Rồi phong nó làm admin (tương đương câu SQL trên, nhưng áp cho file store local):

```sh
cd web
node --experimental-strip-types scripts/promote.mjs email-cua-ban@example.com
pnpm dev            # hoặc pnpm build && pnpm start
```

Mở `/admin`. Trang đồng bộ giữa các admin bằng cách poll mỗi 5 giây.

`ZC_DEV_LOGIN_EMAIL` **tuyệt đối không được** đặt trên Vercel — biến đó khiến mọi khách truy cập đều đăng nhập thành tài khoản đó, và nếu tài khoản đó là admin thì cả trang quản lý coupon mở công khai. Code đã tự từ chối biến này khi phát hiện mình đang chạy trên Vercel.

### 2c. Không có quyền vào Vercel? Đẩy giá trị từ GitHub

Deploy đã tự động: push vào GitHub là Vercel build. Nhưng **giá trị** env thì không tự đi theo. Nếu chỉ có người khác vào được Vercel, workflow `sync-vercel-env.yml` là đường để bạn tự set biến:

1. Tạo 7 secret ở **Settings → Secrets and variables → Actions**:

   | Tên | Lấy ở đâu |
   |---|---|
   | `VERCEL_TOKEN` | Vercel → Account Settings → Tokens (cần đồng nghiệp cấp) |
   | `VERCEL_PROJECT_ID_OR_NAME` | Vercel → project → Settings → General |
   | `VERCEL_TEAM_ID` | Bắt buộc nếu project thuộc team; bỏ trống nếu tài khoản cá nhân |
   | `PAYLOS_CLIENT_ID` / `PAYLOS_API_KEY` / `PAYLOS_CHECKSUM_KEY` | Cổng payOS |
   | `SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY` | Supabase → Project Settings → API |

2. Actions → **Sync Vercel env** → Run workflow.

Vài điều cần biết trước khi dùng:

- **Chỉ chạy khi bấm tay.** Không có trigger tự động — push hay mở PR đều không tự mang secret đi đâu.
- **Sau khi chạy phải redeploy một lần.** Vercel chụp biến theo từng deployment; đổi xong vẫn cần deploy mới thì mới có hiệu lực.
- Đặt **required reviewer** cho environment `production` (Settings → Environments) nếu muốn chặn người khác chạy.
- `actions/checkout` đang ghim theo tag `@v4` — **đổi sang SHA trước lần chạy thật đầu tiên**, xem rule 20.
- Script kiểm tra bằng tham chiếu trực tiếp, không dùng `${!var}`. Lý do ghi trong file: trên Git Bash/Windows cả `${!var}` lẫn `printenv` từng báo sai — biến đã export vẫn bị coi là unset, và kết quả đổi giữa các lần chạy. Runner GitHub chạy Linux nên không dính, nhưng job cầm secret thì không được để cách kiểm tra mơ hồ.

Test: `node --test tests/sync-vercel-env.test.mjs` (5/5, chạy với HTTP server stub). **Chưa** gọi Vercel thật — cần chạy một lần sau khi có token.

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

- Order lưu ở **Postgres** (`public.zc_orders`, xem mục 2b). Chưa cấu hình Supabase thì local rơi về file JSON (`ponytail:`: một tiến trình, ổ đĩa bền, có race khi ghi đồng thời). Trên host đĩa tạm mà thiếu DB, app **fail** chứ không rơi về file.
- Nhánh Postgres **chưa từng chạy với Supabase thật** — mới chỉ có stub trong test. Chạy lại một đơn thật sau khi apply migration, trước khi nhận tiền.
- Trạng thái `PAID` **không cấp quyền gì cho tài khoản** vì chưa có auth. Trang quay lại chỉ báo trạng thái đơn.
- Chỉ thanh toán **một lần**, chưa có gia hạn định kỳ. Hạn mức 2/4/8 advisor là con số hiển thị, chưa có engine nào ép áp.
- Cần kiểm tra lại tên trường `x-partner-code` nếu tài khoản payOS của bạn bật partner code (hiện route không gửi header này).

## Tài liệu

- [Spec](.agent/SPEC.md) — phạm vi và ranh giới local mock hiện tại.
- [Bàn giao](.agent/HANDOFF.md) — evidence và trạng thái kiểm chứng.
- [Quy trình](AGENTS.md).

Thay đổi qua nhánh task/PR. Không commit secret hoặc `.env.local`; không bật dịch vụ trả phí. Repo public không đồng nghĩa được cấp license mã nguồn mở.
