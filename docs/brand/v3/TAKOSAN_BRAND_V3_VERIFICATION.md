# Takosan V3 - Verification

Codex thực hiện IMPLEMENTATION, SELF-REVIEW và VERIFICATION riêng biệt.
Không có independent review/AI approval. Không merge/deploy hoặc remote mutation.

## Gates thực thi

Node v25.9.0, pnpm 10.33.2 local; Chromium 153.0.8010.12.
CI dùng cấu hình repository Node 22/pnpm 10, không sửa workflow.

| Lệnh / gate | Kết quả | Bằng chứng |
| --- | --- | --- |
| `pnpm lint` | PASS toàn repository | `evidence/logs/delivery-lint.log.gz` |
| `pnpm typecheck` | PASS Web + Worker | `evidence/logs/current-types.log.gz` |
| `TMPDIR=<canonical-local-dir> pnpm test --maxWorkers=2` | PASS 289 file / 6.749 tests, 458,94s | `evidence/logs/final-tests-canonical.log.gz` |
| 6 brand unit/component files | PASS 68 tests | `evidence/logs/focused-final.log.gz` |
| `pnpm check:migrations` | PASS local SQLite | `evidence/logs/migrations.log.gz` |
| `VITE_MEAL_PLANNER_ENABLED=true VITE_MEAL_COMPOSITION_V2_ENABLED=true pnpm build` | PASS Vite + Worker TS | `evidence/logs/final-true-build.log.gz` |
| Hai flags false, `pnpm build` | PASS | `evidence/logs/flag-off-build.log.gz` |
| Production E2E, 390/1440 | 82 PASS / 4 failure baseline hoặc unsupported production instrumentation | `evidence/logs/production-e2e-final.log.gz` |
| Auth OTP expiry/resend local E2E, 390/1440 | 8 PASS | `evidence/logs/auth-e2e.log.gz` |
| Browser matrix | 198 AFTER PASS; 198 BEFORE PASS | `evidence/after-observations.json`, `evidence/before-observations.json` |
| State/responsive bổ sung | 15 checks + 2 journeys PASS | `evidence/state-observations.json` |
| Week flag-off | 12 checks PASS | `evidence/week-off-observations.json` |
| SW/manifest/offline shell | 3 checks PASS | `evidence/pwa-observations.json` |
| Reproducible assets | 49 exports byte-identical; maskable safe circle/opaque, fonts hash/license | `tests/unit/brand-v3.test.mjs` |
| SVG/source manifest/diff/scope | PASS | `evidence/self-audit.json`, `evidence/asset-verification.json` |

Exact browser commands:

```sh
BRAND_URL=http://127.0.0.1:5238 BRAND_OUT=../matrix-current BRAND_STAGE=after node scripts/brand-v3-browser-check.mjs
BRAND_URL=http://127.0.0.1:5233 BRAND_OUT=../before-final BRAND_STAGE=before node scripts/brand-v3-browser-check.mjs
BRAND_URL=http://127.0.0.1:5235 BRAND_OUT=../states-current node scripts/brand-v3-state-check.mjs
BRAND_URL=http://127.0.0.1:5237 BRAND_OUT=../week-flag-off BRAND_FLAG_OFF=true node scripts/brand-v3-state-check.mjs
BRAND_URL=http://127.0.0.1:5235 BRAND_OUT=../pwa-verified node scripts/brand-v3-pwa-check.mjs
pnpm exec playwright test --config=playwright.brand-v3.config.ts
BRAND_PORT=5239 BRAND_BUILD_ROOT=../build-final pnpm exec playwright test --config=playwright.brand-v3.config.ts t18a-auth-expiry
```

Production preview bind loopback; SQLite synthetic; Worker external fetch blocked.
Browser provider network bị chặn. Local cooking/scan/plan mutations chỉ vào memory fixture.
Không chứng nhận Google real sign-in, OTP email delivery, payment/provider settlement.
Payment mocks kiểm selected plan/server amount/QR manual status/focus/entitlement đúng;
18 payment tests đạt, payment source/configuration giữ nguyên.

## Baseline / environment failures đã phân loại

| Kiểm thử | Loại | Nguyên nhân, tác động, xác minh thay thế |
| --- | --- | --- |
| Full suite đầu tiên | Environment blocker | macOS `/var` so với `/private/var` trong 11 path assertions; Git partial clone thiếu blob lịch sử; staging Wrangler 5s timeout. Không đổi test/backend. Dùng canonical TMPDIR, hydrate historical blobs và giảm workers; full suite sau đạt toàn bộ |
| Default T13 dev preview | Environment blocker | bootstrap source-module không hoàn tất ở `/__preview/ready`; dừng run sau 3 failures cùng nguyên nhân. Production harness dùng cookie thực và plain fixture bootstrap; 82 existing journeys đạt |
| `t13b-ownership` E | Unsupported test trong production harness, 2 widths | test `import('/src/web/stores/useScanStore.ts')` không tồn tại trong production build. UI logout trước điểm đó đạt; unit session fences/full suite đạt; baseline production tái hiện cùng lỗi |
| `t13b-ownership` H | Baseline failure, 2 widths | `getByRole('status')` khớp cả lifecycle và terminal status; selector không duy nhất. Baseline production tái hiện cùng lỗi. Không sửa scan semantics hoặc giảm assertion để ép pass; các scan confirm/reopen/ownership tests khác đạt |
| UX heuristic script | Advisory FAIL | 166 files, 32 issues/1.021 warnings, nhiều false positives từ tests/CSS và quy tắc marketing chung. Đã rà soát changed UI theo guidelines + axe + keyboard; không dùng số liệu heuristic làm WCAG chứng nhận |
| `pnpm audit --audit-level=high --json` | Existing dependency risk | 41 advisories: 4 low, 19 moderate, 16 high, 2 critical. Không đổi package/lockfile; nhiều chuỗi dev tooling. Cần dependency remediation riêng trước quyết định release |

Không biến failure, unsupported hoặc gate chưa chạy thành PASS.
Browser H/E failure logs và baseline confirmation giữ trong evidence.

## Accessibility

Tính WCAG bằng luminance và axe, không đánh giá bằng mắt:

| Cặp | Ratio |
| --- | --- |
| White / Leaf Green | 5,00:1 |
| Derived text `#26694C` / Soft Mint | 5,68:1 |
| Derived text / tinted planner aside | 5,61:1 |
| Deep Ink / Cream | 13,75:1 |
| Muted / Cream | 5,04:1 |
| Deep Ink / Coral | 5,71:1 |
| Coral / White | 2,53:1, không dùng cho normal text |

Visible focus, home link Enter, dialog Escape/focus return, payment focus trap,
planner picker keyboard, labels/heading/landmarks/reduced motion và text200% đã kiểm.
Touch targets/layout giữ fix hiện có. Không claim toàn sản phẩm WCAG certified từ axe.

## Performance

Ba cold/warm pairs mỗi Home/Discovery/Detail, 390x844, CPU4x, latency60ms,
200KBps local throttling, cùng synthetic data/static catalog và flags.
Không browser request routing khi đo; bootstrap cookie/preferences loại khỏi phép đo.

| Route | BEFORE cold median ready | AFTER | Cold JS bytes BEFORE / AFTER |
| --- | --- | --- | --- |
| Home | 3.665 ms | 3.375 ms | 199.548 / 199.524 |
| Discovery | 3.072 ms | 2.801 ms | 185.170 / 185.146 |
| Detail | 3.829 ms | 3.610 ms | 193.311 / 193.280 |

Warm JS transfer 0. Font transfer 144.632→88.712 bytes Home, 130.720→88.712
Discovery/Detail. Home cumulative shift 0,017652→0,017647; detail <0,000052;
discovery 0. Đây là lab observations, không field CWV/INP hoặc tốc độ hosted.
Không kết luận causal speedup chỉ từ ba sample local.

Toàn bộ JS build: 1.221.480→1.221.569 raw bytes, gzip381.261→381.199.
CSS134.832→136.384 bytes. Runtime V3 269.090 bytes bao gồm fonts và OG;
không phải mọi export được tải trên mỗi trang. Source/native/docs nằm ngoài public.
Không thêm dependency, không double-download Google fonts. Measured domain writes
zero, inventory JSON trước/sau bằng nhau. Warm cache local không đại diện CDN.

## Self-audit và release

Full diff bao gồm untracked; không deleted files, không protected backend/auth/payment/
package/workflow changes. SVG parse/safety, master hashes, imports/assets/metadata,
PNG dimensions/transparency, duplicates và refs kiểm tra. Primary/reverse symbol
trùng có chủ đích; old assets giữ compatibility. Documentation/source không vào runtime.

Rollback dùng revert feature commits và deployment quy trình hiện có; không có migration,
secret/flag thay đổi một chiều. SW release ID tiếp tục do build SHA cấp; cần operator
kiểm exact deployed SHA/cache trên staging khi được phép. Chưa có staging/native/device
certification trong nhiệm vụ này. Không dùng RELEASE_READY khi các release concerns còn mở.

CI links và SHA cụ thể ghi trong `TAKOSAN_BRAND_V3_FINAL_REPORT.md` và `CI_STATUS.md`.
