# Zero Council

Giao diện local song ngữ để trình diễn cấu trúc hội đồng đa góc nhìn bằng nội dung mẫu cố định. Đây là UI concept, không phải sản phẩm AI hay dịch vụ tư vấn.

## Trạng thái

Next.js 16.3.5 / React 19.2.8 / TypeScript / Tailwind 4 tại `web/`.
Luồng `/` dùng React/browser memory; refresh đặt lại state. Không gọi model/provider, không lưu transcript, không có auth, payment, credential, analytics hoặc deploy.
`/fixture` hiển thị fixture song ngữ cố định. `/api/council` là route fixture riêng và giao diện `/` không gọi route này.

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

## Tài liệu

- [Spec](.agent/SPEC.md) — phạm vi và ranh giới local mock hiện tại.
- [Bàn giao](.agent/HANDOFF.md) — evidence và trạng thái kiểm chứng.
- [Quy trình](AGENTS.md).

Thay đổi qua nhánh task/PR. Không commit secret hoặc `.env.local`; không bật dịch vụ trả phí. Repo public không đồng nghĩa được cấp license mã nguồn mở.
