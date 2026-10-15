# Takolio V1 audit

Date: 2026-10-16 JST

## Authority and baseline

- Canonical repository: `lol-vn/Tako-san`, repository ID `1385308553`.
- Live `main` baseline: `03428467cdd5e93d27a3a27e5edaf7d512eef71d` (verified with GitHub API and `git ls-remote`).
- Working branch: `feat/takolio-brand-migration-v1`.
- ZIP: `Takolio_Brand_OS_Kit_v1.0.zip (operator-supplied download)`.
- ZIP SHA256: `d2f77b552c07570d846a20d2602dd3a6c41ebb4fd9c66328234bf86da8ca1142`.
- ZIP inventory: 276 entries, 273 manifest/checksum entries, 64 SVG, 161 PNG and a 14-page PDF. Bundled validator and SHA256 manifest passed. The four application mockup SVGs containing embedded images were excluded from runtime.
- Kit is a design candidate supplied for this migration. It has no standalone artwork license grant or trademark clearance. `PREMIUM_MASCOT_FINISHING_PENDING` remains true; supplied mascot vectors are 2D gradient artwork.

## Scope decisions

- `REPLACE`: product-facing Takosan brand strings, logos, mascot references, metadata, manifest, social image, PWA icons, planner copy, onboarding/auth fallback display names and semantic Takolio mappings.
- `ALIAS`: `src/web/lib/takosan-brand.ts` and `src/web/lib/takosan-kitchen.ts` remain compatibility facades backed by the single `TAKOLIO_BRAND` contract.
- `KEEP`: `/takosan/v3` assets, technical paths, local storage keys, package names, Worker/API identifiers, `frigo.tungjpstore.net`, cache lifecycle, persisted IDs, auth/payment protocol and protected root token semantics.
- `DEFER`: protected payment/Plus copy and Worker/auth/email/notification copy. The complete post-migration product-copy list is recorded in `evidence/occurrences.json`: 25 source locations (10 payment, 15 Worker/auth/email/notification). These require a separately approved protected-surface migration.

## Consumer graph

The contract has 21 import entries across 19 unique consumer files. UI imports use `takolio-brand`, `takosan-brand` or `takosan-kitchen`; no screen constructs a Takolio runtime asset URL independently. The inventory script records every consumer and is reproducible with `TAKOLIO_BASELINE_SHA=03428467cdd5e93d27a3a27e5edaf7d512eef71d pnpm exec node scripts/takolio-inventory.mjs`.

The source inventory compares against the pinned baseline SHA, even after this branch is committed. Its output records `baselineSha`, before/after occurrences, decisions and consumers.

## Protected-scope evidence

`evidence/protected-audit.json` records the file-level audit: 294 protected paths were byte-identical to baseline. Separate exact-diff checks allowed only the two explicitly authorized auth fallback display literals (`Bạn mới của Takosan` -> `Bạn mới của Takolio` and `Người dùng Takosan` -> `Người dùng Takolio`). No PayOS, payment, checkout, payment webhook, Worker logic, D1/KV/R2/DO, migration, domain, OAuth redirect, flag or persisted-ID changes were found. The audit also confirms old V3 assets remain unchanged and no ZIP, reference board, PDF, native mock project or private-key pattern entered the public diff.

## Stack observed

Resolved packages at execution: React 18.3.1, Vite 6.4.3, TypeScript 5.9.3, Hono 4.13.7, Tailwind 4.3.3, Vitest 4.1.11, Playwright 1.63.0, Sharp 0.35.5 and Wrangler 4.149.0. The repository is pnpm-based and uses a Vite client plus Cloudflare Worker/Hono server.

## Remaining visible product-copy locations

The inventory counts literal/template chunks, including multiple messages inside one email chunk; it does not claim 25 unique rendered strings. Baseline 112 locations became 25 protected deferred locations.

| Source | Line | Excerpt | Decision |
|---|---:|---|---|
| `src/web/components/payment/BillingAccountPanel.tsx` | 70 | Takosan Plus | DEFER |
| `src/web/components/payment/BillingAccountPanel.tsx` | 70 | Takosan miễn phí | DEFER |
| `src/web/components/payment/VietQRModal.tsx` | 222 | Gói 1 Năm Takosan Plus | DEFER |
| `src/web/components/payment/VietQRModal.tsx` | 222 | Gói 1 Tháng Takosan Plus | DEFER |
| `src/web/pages/PlusPaywallPage.tsx` | 233 | Takosan Plus | DEFER |
| `src/web/pages/PlusPaywallPage.tsx` | 273 | Quản lý Takosan Plus | DEFER |
| `src/web/pages/PlusPaywallPage.tsx` | 273 | Nâng cấp Takosan Plus | DEFER |
| `src/web/pages/PlusPaywallPage.tsx` | 278 | Takosan Plus | DEFER |
| `src/web/pages/PlusPaywallPage.tsx` | 298 | Gói Takosan Plus | DEFER |
| `src/web/pages/PlusPaywallPage.tsx` | 325 | Trọn bộ Takosan Planner lập thực đơn tuần tự động | DEFER |
| `src/worker/routes/auth.ts` | 119 | Người dùng Frigo | DEFER |
| `src/worker/routes/auth.ts` | 343 | Người dùng Frigo | DEFER |
| `src/worker/routes/auth.ts` | 479 | Tài khoản Google đã liên kết với một tài khoản Frigo khác | DEFER |
| `src/worker/routes/auth.ts` | 682 | Vui lòng đăng nhập để kích hoạt Frigo Plus. | DEFER |
| `src/worker/routes/auth.ts` | 696 | Chưa xác nhận thanh toán. Vui lòng kiểm tra lệnh thanh toán trong Takosan Plus. | DEFER |
| `src/worker/routes/notifications.ts` | 72 | Chào mừng bạn đến với Frigo! | DEFER |
| `src/worker/routes/notifications.ts` | 73 | Hãy chụp ảnh tủ lạnh hoặc hóa đơn đi chợ để Frigo tự động ghi nhận nguyên liệu cho bạn. | DEFER |
| `src/worker/services/auth-otp-http.ts` | 13 | Nếu email này có tài khoản Frigo, hướng dẫn đặt lại mật khẩu sẽ được gửi đến email của bạn. | DEFER |
| `src/worker/services/auth-otp-http.ts` | 164 | Người dùng Frigo | DEFER |
| `src/worker/services/email.ts` | 28 | Takosan | DEFER |
| `src/worker/services/email.ts` | 261 | Mã xác thực Takosan: | DEFER |
| `src/worker/services/email.ts` | 263 | Mã có hiệu lực trong 10 phút. Không chia sẻ mã này với bất kỳ ai. Nếu bạn không yêu cầu, hãy bỏ qua email này. | DEFER |
| `src/worker/services/email.ts` | 265 | <!DOCTYPE html> <html> <head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-s | DEFER |
| `src/worker/services/email.ts` | 276 | </h1> <p style="margin:0 0 24px;font-size:14px;color:#475569;line-height:1.5;">Nhập mã sau vào ứng dụng Frigo  | DEFER |
| `src/worker/services/email.ts` | 279 | </span> </div> <p style="margin:0 0 4px;font-size:13px;color:#475569;">Không chia sẻ mã này với bất kỳ ai — nh | DEFER |

## Direct contract consumers

| Consumer | Import |
|---|---|
| `src/web/components/common/EmptyState.tsx` | `../../lib/takosan-brand` |
| `src/web/components/common/Header.tsx` | `../../lib/takosan-brand` |
| `src/web/components/common/KitchenHeader.tsx` | `../../lib/takosan-kitchen` |
| `src/web/components/common/RouteFallback.tsx` | `../../lib/takosan-kitchen` |
| `src/web/components/common/SystemStatusPage.tsx` | `../../lib/takosan-kitchen` |
| `src/web/components/common/TakosanIcon.tsx` | `../../lib/takolio-brand` |
| `src/web/components/common/TopBar.tsx` | `../../lib/takosan-brand` |
| `src/web/components/cooking/CookingReview.tsx` | `../../lib/takosan-kitchen` |
| `src/web/components/layout/AppLayout.tsx` | `../../lib/takosan-kitchen` |
| `src/web/design-system/navigation.tsx` | `../lib/takosan-brand` |
| `src/web/design-system/navigation.tsx` | `../lib/takosan-kitchen` |
| `src/web/features/auth/AuthShell.tsx` | `../../lib/takosan-kitchen` |
| `src/web/lib/takosan-brand.ts` | `./takolio-brand` |
| `src/web/lib/takosan-brand.ts` | `./takolio-brand` |
| `src/web/lib/takosan-kitchen.ts` | `./takosan-brand` |
| `src/web/pages/CookingModePage.tsx` | `../lib/takosan-kitchen` |
| `src/web/pages/LandingPage.tsx` | `../lib/takosan-kitchen` |
| `src/web/pages/OnboardingPage.tsx` | `../lib/takosan-kitchen` |
| `src/web/pages/PlusPaywallPage.tsx` | `../lib/takosan-brand` |
| `src/web/pages/ReconciliationPage.tsx` | `../lib/takosan-kitchen` |
| `src/web/pages/WeekGeneratingPage.tsx` | `../lib/takosan-kitchen` |

## Input read status and authority

The start-here/source-of-truth files, six guideline chapters and PDF, token/typography guidance, vector source groups, orchestrator/execution/specialist prompts, acceptance/release/manifest/validator material and reference boards were read as input evidence. Prompt files inside the kit were treated as subordinate design data. No attached command authorized protected system changes. Boards were used for visual comparison only; no cropped/traced board content entered runtime.

Main is protected with required `validate`. Open PRs observed were #77, #63, #29 and #20; #77 affected the admin handoff, the others were historical documentation. No competing Takolio migration was identified. Hosted state can change and must be refreshed before publication/review. The baseline checkout was clean before this branch began.

## Shared-shell impact

The protected Plus/payment source files are unchanged, but the existing shared brand contract, header/mascot, typography and scoped colors can appear on those screens. This inherited presentation impact was evaluated by visual spot-checks and the passing isolated payment-authority E2E suite. Price, entitlement, checkout admission, QR authority, settlement and payment lifecycle remain untouched.
