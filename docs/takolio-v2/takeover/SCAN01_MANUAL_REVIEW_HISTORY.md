# SCAN01 - Durable manual scan review history

Status: LOCAL_SCAN01_VERIFIED, 2026-10-25 JST. Local implementation and bounded checks complete. No release, merge, deploy or production claim.

Parent: a4fa573a53580f187f86b35bad7127bba042000e. Official main observed read-only:90b94129113b41e34701d99f51175cfa81cb73de. Implementation checkpoint follows this frozen evidence; verified hash is recorded by the documentation checkpoint.

## Result

Accepted manual scan lines now remain durable review history after confirmation. Fresh GET and confirmed photo/receipt review preserve the exact reviewed name, fractional quantity, unit, mapping, category, storage and expiry basis. Manual history has no manufactured OCR, confidence, or price facts. Existing unknown OCR remains unknown OCR.

The change uses the existing scan table, DTO, guarded transaction and replay behavior. Stock semantics, command evidence/source membership, existing prediction rejection/omission, household isolation, native/legacy authority, and receipt purchase behavior remain in scope for regression checks. No frontend rebuild, migration, dependency, or receipt manual-add affordance was introduced.

## Checks executed

| Check | Result |
| --- | --- |
| Focused regression suite: manual history, scans, response loss, receipt truth, evidence completeness, T13B roundtrip, inventory writer fence, cancellation | 8 files / 178 tests PASS |
| `pnpm lint` | PASS |
| `pnpm typecheck` | PASS |
| `pnpm check:migrations` | PASS |
| `pnpm build` default | PASS |
| `pnpm build` with planner/composition V2 both ON | PASS |
| Full `pnpm test --maxWorkers=1 --testTimeout=15000` | 415/415 files, 9279/9279 tests PASS; exit0; reported 1072.07s / wall 1073.04s |
| `pnpm audit --audit-level=high` | Exit 1; inherited 3 moderate / 2 high findings; not resolved by SCAN01 |

All seven gate records bind1182 frozen source/test/config hashes; bytes remained unchanged. Exact argv, environment, elapsed time and log SHA256 are in evidence/scan-manual-history/checks.json. CLI testTimeout15000 is explicit; no assertion/config weakening. Baseline27FAIL/4PASS; first domain27PASS/4FAIL (seeded foreign fixture counts); refined35PASS/2FAIL (native stale batch inherited500, legacy409); final37PASS. Initial DOM typecheck failed, corrected matches(:disabled), then DOM6/6 and typecheck PASS. Original failures remain in evidence/logs and retained-attempts.json.

## Browser evidence

Four successful flows: photo and receipt at 320px and 1440px. Photo uses the actual manual-add sheet, removal of a second draft, `0.25 pack`, pantry, explicit expiry `2030-12-31`, and explicit UI confirmation. Receipt manual compatibility uses the existing confirmation API without adding UI. Each flow opens a new browser document from the review route.

SQL/GET facts agree; manual history ID uses the reserved namespace, OCR/price columns remain NULL, stock is 250 milli-pack. Confirmed controls are disabled, manual marker survives, unknown OCR remains OCR-derived. Identical replay returns `idempotentReplay: true`; full committed SQL and GET snapshots stay unchanged. Zero browser page errors, console errors, failed requests, or external requests.

Exported: `docs/takolio-v2/takeover/evidence/scan-manual-history/browser/`; 8 screenshots, compact lossless SQL/GET readback, script/log, browser/independent review reports, manifest, and failed-attempt logs/hash inventory. No session cookie, token, storageState, secret, or private-backup path exported. Raw failed attempts remain in ignored artifacts.

Browser attempts 1-2 failed on Vite `504 Outdated Optimize Dep` during preview session bootstrap; isolated cacheDir plus local preview restart resolved it. Attempt 3 reached successful real confirmation, then failed a helper-only assertion against nonexistent `lot.storage`; assertion corrected to authoritative `storage_location_id`. Attempt 4 passed all four flows.

## Limits and remaining action

The browser run uses an isolated Node Worker router with synthetic in-memory SQLite. It does not replace native D1, production/hosted routing, real OCR/provider, device/Safari, or assistive-technology acceptance. Historical missing manual rows are not backfilled. Local-only offline scans retain their existing persistence ceiling. Status-based confirmed replay continues to ignore changed retry payloads.

Recovery verification: PASS_WITH_AUTHORIZED_PLATFORM_DRIFT. Private snapshot22,763regular/772symlinks and116 Git baseline files match stored bytes/modes/links. Current source22,772regular/772symlinks differs only at ten authorized .DS_Store paths (one changed,nine added), separately privately copied/verified. Source index/stored manifest unchanged; HEAD/index/status match baseline. No private recovery paths exported and no zero-difference claim. Previous authorized snapshot-index restoration remains documented in CAT01.

Precommit scope PASS:8990parent paths and5798protected-main paths unchanged;54salvage paths exact;69Argon/12asset/38screen rows unchanged,115old file decisions preserved; all38owner reviews PENDING. Post-implementation/post-documentation proofs record their actual HEAD separately.

Next: activate WKD01 durable offline queue under its own ADR/gates, then WKD02 swap replay. Frontend UI01-UI15+C12/C13 stays locally bounded complete; owner/media/device/Safari/screenreader/live/hosted acceptance remains pending. No push,merge,deploy,remote migration or production operation. Production actions require separate user approval.
