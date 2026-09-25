# Zero Council web

Next.js App Router local mock với dữ liệu mẫu cố định; không có AI/provider call, auth, persistence, payment, analytics hoặc deploy.

```sh
pnpm install --frozen-lockfile
pnpm dev
pnpm lint
pnpm exec tsc --noEmit
pnpm build
```

Node 24 LTS, pnpm 11.5.2. URL mặc định `http://localhost:3000`; local mock không cần `.env`, API key hoặc cloud project.
Dùng font hệ thống, build không tải Google Fonts.

Hướng dẫn đầy đủ: [README repo](../README.md), [local setup](../docs/SETUP.md), [spec](../.agent/SPEC.md).
