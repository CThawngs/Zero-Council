# HANDOFF — Zero Council UI/UX local mock

Cập nhật: 2026-09-25. Governance: v7.1.

## Git và phạm vi

- Worktree: `C:\Users\nguye\OneDrive\Documents\Projects\Zero-Council\.worktrees\ui-ux-local-mock`
- Branch: `ui-ux-local-mock`
- Base: `d4b254c` (`origin/main` tại task start)
- Remote: `https://github.com/CThawngs/Zero-Council.git`
- Main checkout và worktree `feature-prototype-ui-integration` không sửa.
- Không merge PR #4; PR mới sẽ được tạo sau final QA.

## Đã triển khai

- `/` render polished local mock tại `web/src/prototype/App.tsx`.
- `/fixture` là bilingual fixed illustrative route; `/api/council` là fixed English fixture và không được UI gọi.
- Central EN/VI copy catalog; language toggle cập nhật visible copy, document language, title và description.
- Deterministic initial state tránh hydration mismatch; event-only IDs/timestamps dùng browser APIs.
- Native `<dialog>` cho framework, sample draft và confirmation flows; Escape, backdrop, explicit close và focus return.
- New sample dùng fixed generic flow cho mọi câu hỏi; không phân tích input, không tạo personalized recommendation.
- New persona có validation, local generated name và semantic toast; provider/model labels chỉ là fixture labels.
- Paid/auth surfaces không provision; không có checkout, billing, sign-in, account, credential, invoice hoặc dữ liệu định danh giả.
- Không thêm dependency ngoài `lucide-react`.

## Ranh giới runtime

- Client UI không có `fetch`, XHR, WebSocket, storage API, provider/model call, auth, payment, analytics, server persistence hoặc transcript retention.
- State mẫu nằm trong React/browser memory và reset khi refresh.
- `/api/council` tồn tại như fixed fixture route; không phải integration.
- Không claim ISO/compliance, encryption, accuracy, latency, confidence, ranking, conversion, ROI hoặc hiệu quả chuyên môn.
- Không dùng email, account number, vault ID, invoice code, renewal date, API key hay identity giả trong UI.

## Evidence

Evidence final source, gắn với source commit `00e18feecdd33630161432a2d979035126415a76`.
Các commit chỉ cập nhật handoff/evidence không đổi runtime source:

- `pnpm lint` — exit `0` (`web`, job `pwsh-76`).
- `pnpm exec tsc --noEmit` — exit `0` (`web`, job `pwsh-77`).
- `pnpm build` — exit `0` (`web`, job `pwsh-78`); Next.js `16.3.5`, TypeScript hoàn tất.
- `node --test tests/budget.test.mjs` — `2 pass, 0 fail`, exit `0` (root, job `pwsh-74`).
- `git diff --check` — exit `0`; chỉ có cảnh báo line-ending LF/CRLF, không có whitespace error.
- Production browser server `http://localhost:3110` (job `pwsh-79`): `/` fresh load 9 document/static requests, tất cả `200`/`304`; không có application fetch/XHR/WebSocket/API. Console không có error/warning.
- `/`: English mặc định; toggle Vietnamese cập nhật `lang`, title và localized description. Arbitrary question tạo fixed generic sample flow, không personalized recommendation.
- Persona: empty submit hiện required validation; valid submit tạo `Sample Reviewer`; toggle VI đổi `Mẫu Reviewer`, giữ user-entered archetype/stance/instructions trong browser memory.
- Native draft dialog: mở bằng trigger; Escape đóng và trả focus về `Open sample draft`; backdrop click đóng và trả focus; click trong surface không đóng.
- Clipboard: success toast `Sample text copied to clipboard.` chỉ sau `writeText()` resolve; code path có failure toast khi promise reject.
- Responsive audit: `375x812` scrollWidth `365`; `768x900` `758`; `1024x900` `1014`; `1440x1000` `1430`; không overflow và không có target <44px.
- Reduced-motion: CSS có `@media (prefers-reduced-motion: reduce)`; audit xác nhận transition/animation `0s`, transform `none`.
- `/fixture`: English/Vietnamese visible copy, title, description đều đổi; không có application API call. Hai `_rsc` request là Next navigation prefetch, không phải app integration.
- Lighthouse navigation desktop final build: Accessibility `100`, Best Practices `100`, SEO `100`, Agentic Browsing `100`; `52` passed, `0` failed.
- Không có secret hoặc realistic identity/billing/credential data trong source hoặc browser storage.

## Git / PR

- Source commit: `00e18feecdd33630161432a2d979035126415a76`.
- Evidence-only handoff updates follow this source commit; runtime source is unchanged by them.
- Push branch, PR mới và required checks: `PENDING`.
- Không merge PR #4.
- Self-merge chỉ sau khi mọi required check của PR mới pass và ruleset cho phép.

## Bàn giao

1. Stage source + governance docs; loại toàn bộ `web/*.log` khỏi staging.
2. Commit final source/docs.
3. Push `ui-ux-local-mock`, tạo PR mới vào `main` (không dùng PR #4).
4. Chờ required checks pass, merge PR mới nếu được phép, rồi dừng QA server.

## ZeroVault

- Đã refresh/search/load skill liên quan trong session.
- Đã persist lesson `commit-pinned-local-mock-qa-and-pr-flow` (ZeroVault commit `a7ee1578f0006250e9e88ec92785f6e9880ba37e`).
