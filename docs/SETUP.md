# Thiết lập local và Supabase Free

## 1. Chạy bản mẫu

Yêu cầu: Node 24 LTS (đã thử v24.18.0), pnpm 11.5.2.
Tại repo root:

```sh
pnpm --dir web install --frozen-lockfile
pnpm --dir web dev
```

Mở URL terminal báo (mặc định http://localhost:3000). Đây là Zero Council, không phải GUI DSH tại cổng 8787.
Bản mẫu không cần biến môi trường/API key, không đăng nhập hoặc lưu dữ liệu. Nút “Xem phân tích mẫu” chỉ hiển thị nội dung viết sẵn, không mô phỏng API thật.

Kiểm tra trước PR:

```sh
node --test tests/budget.test.mjs
pnpm --dir web lint
pnpm --dir web build
```

## 2. Chủ dự án tự tạo Supabase

1. Vào https://supabase.com/dashboard, đăng nhập và tạo organization/project **Free**. Nếu dashboard yêu cầu nâng gói, thanh toán hoặc thử gói trả phí, dừng; ngân sách nhóm là 0 USD.
2. Đặt tên `zero-council`, chọn region gần người dùng. Đặt mật khẩu DB mạnh, lưu trong password manager, không gửi vào chat/Git.
3. Đợi database sẵn sàng. Ghi lại project URL/reference và region. Chưa tạo bảng thủ công: migration có version và RLS sẽ được bổ sung trong task auth/session.
4. Trong project settings/API keys, xác định Project URL và publishable key (legacy: anon key). Chưa cần đưa vào app scaffold; task tích hợp sẽ thêm mẫu env với đúng tên biến.
5. Không chia sẻ database password, service_role/secret key, access token hoặc connection string. Chỉ báo “project đã sẵn sàng” và region để tiếp tục. Project URL có thể chia sẻ khi cần, không kèm secret.

## 3. Chuẩn bị Google OAuth

Đây là cấu hình chuẩn bị, **scaffold hiện chưa có callback route hoặc SDK Supabase**. Cấu hình dashboard không làm nút đăng nhập xuất hiện tự động.

1. Vào Google Cloud Console, tạo/chọn project; không bật billing hoặc API AI trả phí.
2. Google Auth Platform: cấu hình Branding, Audience External; ban đầu Testing và thêm email nhóm vào test users. Chỉ xin `openid`, email và profile. Không xin Gmail/Drive.
3. Tạo OAuth client kiểu Web application. Authorized JavaScript origins local: `http://localhost:3000`.
4. Authorized redirect URI của **Google**: sao chép đúng callback trên trang Google provider của Supabase, dạng `https://<project-ref>.supabase.co/auth/v1/callback`. Không nhầm callback này với callback ứng dụng Next.js.
5. Supabase Authentication → Providers → Google: bật Google và nhập Client ID/Client Secret tại dashboard; secret không thuộc frontend hoặc Git. Tắt Email/password, anonymous và các provider khác để đáp ứng Google-only.
6. Supabase URL Configuration: local Site URL `http://localhost:3000`. Khi task auth thêm route `/auth/callback`, allowlist chính xác `http://localhost:3000/auth/callback`. Không dùng wildcard rộng cho production.
7. Khi có domain triển khai, cập nhật origins/Site URL/redirect allowlist chính xác. Muốn công khai cho người ngoài test users: hoàn tất yêu cầu Google về Audience/Publishing và verification nếu được yêu cầu; chuẩn bị privacy policy và liên hệ hỗ trợ. Không tự coi Testing là public-ready.

Nguồn chính thức: https://supabase.com/docs/guides/auth/social-login/auth-google và https://supabase.com/docs/guides/auth/redirect-urls . Giao diện dashboard có thể đổi; ưu tiên callback thực trên project.

## 4. Storage và giới hạn 0 USD

File sẽ lưu theo session trong **private bucket**, không public. Chưa upload dữ liệu thật hoặc tự tạo policy allow-all. Task session cần chốt trần mỗi file, mỗi session và tổng mỗi user; xóa DB metadata không tự xóa Storage object.
Ngân sách 0 USD áp dụng nhóm/demo/hạ tầng. User BYOK được chọn model trả phí và tự chịu phí; `src/lib/budget.mjs` chỉ dành cho luồng chi phí nhóm khi được tích hợp, không dùng chặn mọi BYOK.
Không bật paid fallback hoặc nâng gói tự động. Theo dõi quota DB/Storage/egress/auth/search; hết quota dừng có thông báo. Xóa dòng DB không bảo đảm dung lượng đĩa giảm tức thì.

## 5. Vercel — chưa deploy trong task scaffold

Nếu đủ điều kiện Hobby personal/non-commercial (https://vercel.com/docs/plans/hobby), cấu hình Root Directory `web`, package manager pnpm, build `pnpm build`. Dùng domain miễn phí mặc định, không mua domain.
Phải kiểm eligibility đồ án nhóm, quyền dữ liệu và quota trước public; scaffold này chưa sẵn sàng nhận tài khoản/người dùng thật. Không import repo để auto-deploy trước khi chốt các điều kiện đó.

## Lỗi thường gặp

- `redirect_uri_mismatch`: đối chiếu callback Supabase ở Google Console, không sửa bằng wildcard.
- Google chỉ cho nhóm đăng nhập: kiểm test users và publishing status.
- Chưa có màn hình Google/login: đúng trạng thái scaffold; chưa tích hợp auth.
- Free project bị pause/quota đầy: kiểm dashboard, không nâng gói để lách ngân sách.
