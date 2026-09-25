# HANDOFF — Zero Council UI/UX local mock

Cập nhật: 2026-09-25. Governance: v7.1.

## Git và phạm vi

- Worktree: `C:\Users\nguye\OneDrive\Documents\Projects\Zero-Council\.worktrees\ui-ux-local-mock`
- Branch: `ui-ux-local-mock`
- Base: `d4b254c` (`origin/main` tại task start)
- Remote: `https://github.com/CThawngs/Zero-Council.git`
- Main checkout and worktree `feature-prototype-ui-integration` unchanged.
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

Evidence final source, gắn với source commit `15363c0e01cdc114899b17a088e01af4a0e5b59e`.
Các commit chỉ cập nhật handoff/evidence không đổi runtime source:

- `pnpm lint` — exit `0` (`web`, job `pwsh-89`).
- `pnpm exec tsc --noEmit` — exit `0` (`web`, job `pwsh-89`).
- `pnpm build` — exit `0` (`web`, job `pwsh-89`); Next.js `16.3.5`, TypeScript completed.
- `node --test tests/budget.test.mjs` — `2 pass, 0 fail`, exit `0` (root, job `pwsh-90`).
- `git diff --check` — exit `0` (root, job `pwsh-90`); không có whitespace error.
- Production browser server `http://localhost:3110` (job `pwsh-85`): `/` fresh load 9 document/static requests, tất cả `200`; không có application fetch/XHR/WebSocket/API. Console không có error/warning.
- `/`: English mặc định; toggle Vietnamese cập nhật `lang`, title và localized description. Arbitrary question tạo fixed generic sample flow, không personalized recommendation.
- Persona: empty submit hiện required validation; valid submit tạo `Sample Reviewer`; toggle VI đổi `Mẫu Reviewer`, giữ user-entered archetype/stance/instructions trong browser memory.
- Native draft dialog: mở bằng trigger; Escape đóng và trả focus về `Open sample draft`; backdrop click đóng và trả focus; click trong surface không đóng. Header close target đo `44×44px`.
- Clipboard: success toast chỉ sau `writeText()` resolve; code path có failure toast khi promise reject.
- Responsive audit cuối: `375×812` scrollWidth `375`; `768×900` `758`; `1024×900` `1014`; `1440×1000` `1430`; không overflow. Audit target cuối: `13` interactive elements, min `44px`, không target <44px.
- Reduced-motion: audit Playwright với `prefers-reduced-motion: reduce` xác nhận transition/animation `1e-05s`, transform `none`; CSS giữ media query.
- `/fixture`: English/Vietnamese visible copy, title, description and `document.documentElement.lang` both changed; no application API call. `_rsc` request is Next navigation prefetch, not app integration.
- Lighthouse navigation sau target fix: desktop và mobile đều Accessibility `100`, Best Practices `100`, SEO `100`, Agentic Browsing `100`; mỗi lượt `52` passed, `0` failed.
- Fresh Playwright context: cookies, `localStorage`, `sessionStorage` đều rỗng; không có application network request sau static assets.

## Git / PR

- Source commit: `15363c0e01cdc114899b17a088e01af4a0e5b59e`.
- Target fix commit changed only `web/src/app/globals.css`; evidence-only handoff updates follow source commit and do not change runtime source.
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
