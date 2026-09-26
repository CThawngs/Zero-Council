# TODO — Zero Council product voice (giai đoạn 1)

Cập nhật: 2026-09-26. Governance: v7.4. Worktree: `.worktrees/product-voice-ui`; branch: `product-voice-ui`; base `83ee993` (`origin/main` sau PR #9 merge).

## Cấp 1 — Mục tiêu

- [x] Chốt với chủ dự án: bỏ framing demo, giữ nhãn minh họa, không thêm claim, engine để giai đoạn 2.
- [x] Viết lại toàn bộ copy EN/VI trong `web/src/prototype/i18n.ts` sang giọng sản phẩm.
- [x] `layout.tsx` + `/fixture` + `council-fixture.ts` + 2 comment component: bỏ chữ demo.
- [x] Fix lint `Reveal.tsx` (`react-hooks/set-state-in-effect`) đang đỏ từ PR #9.

## Cấp 2 — Ràng buộc giữ nguyên

- [x] Không đổi tên key i18n (nội bộ) — 544 key EN, 544 key VI, không mất/thêm key.
- [x] Không thêm dependency, không đổi layout, không đổi hành vi flow.
- [x] Không claim accuracy / confidence / ranking / ROI / ISO.
- [x] Mọi điểm kết quả vẫn gắn nhãn minh họa.

## Cấp 3 — Kiểm chứng (commit trên branch này)

- [x] `pnpm --dir web exec tsc --noEmit` → exit 0.
- [x] `pnpm --dir web lint` → exit 0 (trước đó exit 1).
- [x] `pnpm --dir web build` → exit 0.
- [x] `node --test tests/budget.test.mjs` → 2 pass, 0 fail.
- [x] Prod server `next start -p 3200`: lái tới bước synthesis bằng câu hỏi tự do, không console error/warning.
- [x] Đổi EN→VI: title, copy và `lang` đổi đúng; không mojibake.
- [x] Scroll reveal của PR #9 vẫn chạy: 11 `.reveal`, 7 chuyển sang `.reveal--visible` sau khi cuộn.

## Cấp 4 — Git

- [x] Commit trên `product-voice-ui` (chưa push, chưa tạo PR — chờ duyệt).
- [ ] Push branch + tạo PR vào `main`.
- [ ] Dừng dev/prod server trước bàn giao.

## Ngoài scope

- [ ] Giai đoạn 2: engine thật, provider, persistence, auth, payment, deploy.
- [ ] Tên thương hiệu/giá thật — cần nguồn chân lý, chưa được bịa.
- [ ] `.agent/skills/verify-app/` + `features/` + `FEATURE_MAP.md` (28.2, 32.2–32.4) — chưa sinh, mở task riêng.
