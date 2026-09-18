# Zero Council web

Next.js App Router scaffold với dữ liệu viết sẵn; chưa có auth, persistence hoặc API AI.

```sh
pnpm install --frozen-lockfile
pnpm dev
pnpm lint
pnpm build
```

Node 24 LTS, pnpm 11.5.2. URL mặc định http://localhost:3000; không cần `.env` trong bản mẫu.
Dùng font hệ thống, build không tải Google Fonts.

Hướng dẫn đầy đủ: [README repo](../README.md), [Supabase/Google setup](../docs/SETUP.md).
Vercel Root Directory dự kiến: `web`; chưa deploy. `allowBuilds` giữ cấu hình create-next-app, không bật lifecycle scripts mới.
