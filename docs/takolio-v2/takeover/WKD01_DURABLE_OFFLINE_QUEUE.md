# WKD01 - Durable offline queue and truthful pending stock

Status: LOCAL_WKD01_VERIFIED, 2026-10-25 JST. Parent `4d330940c328d70ca49384fa54792e95637a3dd5`; official main observed read-only `90b94129113b41e34701d99f51175cfa81cb73de`. Implementation checkpoint `cc426b04baa84cb4bb3a861b0d606764675b4d20`; independently verified by implementation-scope.json. Local bounded verification only.

## Result

A native outbox write must succeed before an operation is accepted as pending. Unreadable, corrupt, unowned or invalid stored operations remain byte-preserved and block mutations instead of being replaced by an empty queue. `queueWrite()` returns the accepted operation. Diagnostic failures cannot revoke successful persistence; unknown pending count is visible in the banner and logout warning.

All enqueue callers persist before cache changes. A later cache failure retains the accepted command and generated identity. Failed queue removal after successful server acceptance retains the exact operation and still refreshes authoritative inventory/shopping/Week under existing session fences. Auth/409 retention and existing request bytes, keys and scopes remain. Independent review found a concurrent-shopping pending-marker race; the minimal fix and RED/GREEN regression are included.

Week shopping no longer invents stock while offline. Repeated completion and document reload retain one request and the last confirmed quantity. Pending `importedItemsCount` remains the queued-line compatibility count, explicitly labelled pending; actual server readback owns imported stock. Existing inflated caches are not guessed backward.

No Worker, schema, migration, dependency, asset, icon, payment or auth implementation change. ESLint ignores generated `.artifacts/**`; app/test rules and assertions remain enforced.

## Executed checks

| Check | Result |
| --- | --- |
| Focused final | 8 files / 280 tests PASS; 13.16s |
| Earlier caller/security compatibility | 10 files / 234 tests PASS; 8.12s |
| Worker shopping/Week compatibility | 2 files / 149 tests PASS; 10.16s |
| Lint / typecheck / migration smoke | PASS |
| Default / actual planner+composition ON builds | PASS |
| Full `pnpm test --maxWorkers=1 --testTimeout=15000` | 416/416 files, 9319/9319 tests PASS; reported 974.99s / wall 976.03s |
| `pnpm audit --audit-level=high` | FAIL exit1; inherited 0 low / 3 moderate / 2 high, Hono/Zod/Undici unresolved |

Node24.16.0; canonical TMPDIR. Seven gate records bind 1184 frozen source/test/config hashes; all remain unchanged. Exact full-gate argv/environment/timing/log hashes: `evidence/week-offline-durability/checks.json`. The focused8/280 and backend2/149 logs retain counts/results but not their exact historical argv; they are supplementary, not the canonical full-gate command record. CLI testTimeout15000 is explicit; no assertion/test-config weakening.

Failures retained: baseline 18FAIL/54PASS; concurrent-shopping regression RED before GREEN; first lint failed on generated artifact dependencies; the first full attempt was intentionally interrupted exit130 after176.59s when reviewed source changed, so it is not final evidence. Intermediate typecheck failed before nullable banner/logout types were updated; final Node24 types pass. The domain intermediate suite32PASS/4FAIL before caller activation is retained separately. Historical Prettier warnings are documented in the test audit. Browser attempts include session timing, total-outage auth-gate expectations, incorrect native-new-lot expectation and ambiguous egg locator; final successful evidence is separate.

## Running-app evidence

Two outage flows at320/1440: 32 exact PNG. Full API outage retains queue/cache across a fresh document at the existing session-verification gate. Partial domain outage keeps `/api/v1/me` online, renders Week after fresh navigation, and completes a third time without changing its exact request/key. Both retain stock2, then reconnect to stock8 once. Existing egg lot2000-to8000 milli-unit, version+1, same5lots; one import command/run/item and one inventory command/event. Replay returns `idempotentReplay:true`; SQL and authoritative inventory GET remain unchanged. Zero uncaught page errors, external requests or horizontal overflow. Mobile filtered final-stock and desktop pending screenshots visually inspected.

`evidence/week-offline-durability/browser/manifest.json` binds raw/public hashes and sanitization. Synthetic SQL lock_token values are removed. No session cookies, tokens, storageState or private backup location exported. Raw attempts/harness artifacts remain ignored and hash-bound.

This is actual frontend/Worker-router interaction with synthetic Node SQLite, Chromium and transport aborts. It does not certify native D1/workerd, full-network offline authenticated rendering, production, hosted, physical devices, Safari or screenreaders. Partial outage intentionally keeps identity verification online.

## Recovery and scope

Recovery PASS_WITH_AUTHORIZED_PLATFORM_DRIFT: snapshot22763regular/772symlinks and116Git baseline files exact. Source22772regular/772symlinks has only ten authorized .DS_Store differences, separately privately copied/verified; every other byte/mode/link matches. HEAD/index/status and source index/stored manifest unchanged. Prior authorized snapshot-index restoration remains disclosed in CAT01. No zero-difference or private-location claim.

Precommit scope PASS:9023parent and5783protected-main paths unchanged;115prior file-decision rows preserved. First verifier exited1 on a nonexistent prior proof path; corrected to the retained precommit proof and reran, with direct parent/main comparisons. See scope-verifier-correction.md. Post-checkpoint proofs follow final documentation. Preserve all54salvage paths,69Argon/12asset/38screen ledger rows and every historical report. All38owner reviews remain PENDING. No cross-tab localStorage transaction, atomic multi-item local scan, all-endpoint replay guarantee or WKD02 swap receipt claim.

Next: WKD02 dedicated Week swap receipts and narrow response-loss recovery under its own ADR. Finite UI01-UI15+C12/C13 remains locally bounded complete; owner/media/device/Safari/screenreader/live/hosted acceptance pending. No push, merge, deploy, remote migration or production action.

## Checkpoint review

Implementation scope PASS after commit; public-evidence review found no blocker. Ten trailing blank-line warnings belong only to verbatim logs and remain retained; source/docs whitespace check passed. See implementation-scope.json and public-evidence-review.md. Documentation checkpoint records this verified implementation, not its own hash.
