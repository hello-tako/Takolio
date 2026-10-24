# CAT01 - Authoritative display category and immutable CREATE replay

Status: LOCAL_CAT01_GATES_VERIFIED; recovery/protected-scope checkpoint pending.
Implementation: PENDING_IMPLEMENTATION_COMMIT. Parent `e90bcfda35b3deeee8efc9647ab2c8f72f6520ee`.
Official main observed read-only: `90b94129113b41e34701d99f51175cfa81cb73de`.

## Result

Unmapped inventory retains its validated display category across create, reload,
PATCH, USE and MOVE. Canonical ingredient category remains authoritative; a
submitted label cannot override EGG/RICE catalog identity. SQL NULL omits the
optional domain field and retains catalog/other behavior.

Manual CREATE checks its owned immutable receipt before mutable projection.
Matching original intent replays the frozen original response after later edits;
changed category, expiryEstimated or dataSource conflicts. Historical native
receipts without retained intent fail closed409. Legacy idempotency is preserved.

New adoption captures valid source category with complete source/poststate fences
and truthful before state. Already-adopted NULL never borrows mutable projection.
No automatic data repair, backfill or historical receipt/event rewrite.

Migration0044 adds nullable display_category and category evidence guards. Existing
0024-0043 bytes remain unchanged. Reverse proof restores canonical0030 FEFO trigger
bodies byte-for-byte; quantity, mapping, version and tenancy guards remain intact.
Maximum30 UTF-16 code units/noNUL/noJSON-null is enforced at request/domain/SQL
boundaries, including supplementary Unicode. Empty-string compatibility remains.
Scan CREATE forwards category; scanner history remains the next separate packet.

## Executed checks

| Check | Result |
| --- | --- |
| `pnpm test --maxWorkers=1 --testTimeout=15000` | 414/414 files; 9228/9228 tests PASS; exit0; reported 877.15s; wall 877.97s |
| `pnpm lint`; `pnpm typecheck` | PASS; corrected frozen-source receipts |
| `pnpm check:migrations` | PASS; application and Admin local smoke |
| `pnpm build` | PASS |
| `env VITE_MEAL_PLANNER_ENABLED=true VITE_MEAL_COMPOSITION_V2_ENABLED=true pnpm build` | PASS |
| Fresh isolated actual local D1 apply/schema/positive/readback | PASS; all44 migrations |
| Local D1 forged column/receipt/event | Three expected exit1 rejections; zero forged writes |
| `pnpm audit --json` | FAIL exit1; 5 findings: 0low/3moderate/2high; Hono/Zod/Undici unresolved |

Final suite binds 1260 frozen source/test/config hashes;
zero differences. Runtime evidence uses identical106 runtime source hashes.
Focused final adoption23/23, actual D1 category48/48 and bounded schema/staging
fixtures60/60 pass. Earlier focused7files/238tests preceded four adoption cases.
Exact argv, durations, source maps and full-log hashes: `evidence/category-authority/checks.json`.
Raw logs remain ignored; all attempted checks and failures are retained/hash-bound.
Existing unresolved-at-build Admin font warnings remain in build logs.

## Actual browser and database evidence

Local Chromium390, reduced motion: create0.25pack spice; filter/reload/detail;
category-only PATCH; USE0.05pack via synthetic local control; UI MOVE to freezer;
original CREATE replay; three changed-intent409s; zero extra replay writes.
USE does not certify a product UI control. Four inspected screenshots and complete
synthetic DB/receipt/event readback are published in `evidence/category-authority/`.
Browser errors=[], localOnly=true, useViaSyntheticControl=true.

D1 readback: lot/projection spice, quantity250milli/0.25pack, version1;
forged commands/events0; foreign_key_check empty; quick_check=ok.
Default `pnpm schema:check:local` failed with `D1 schema query failed`; cause
unproven. Successful isolated namespaces used explicit `--local --persist-to`.
They do not certify the default namespace, hosted D1 or production.

## Preserved failures

- First actual final local D1 apply failed: `too many terms in compound SELECT`.
  Validator changed from seven terms to two while retaining all seven sources.
  Fresh final2 apply/gate/positive/three rejection probes/readback passed.
  A supplemental Python limit simulation failed before migration because its
  sqlite3.Connection lacked setlimit; it is not D1 evidence.
- First full serial suite: exit1,411/414files,9213/9220tests; wall962.69s,
  reported961.33s. Seven fixture failures: reviewed schema hash, two bounded
  staging0043 fixtures consuming current0044, four canonical category expectations.
  Corrections pin reviewed SQL, bound historical fixtures to declared TIP and
  reject full current ledger, explicitly test canonical versus unmapped categories.
  No assertion or production guard was removed. Failed frozen-source proof retained.
- Corrected default full suite: exit1,413/414files,9227/9228tests; wall916.19s,
  reported915.23s. Only the isolated local Wrangler migrations-list case exceeded
  default5000ms (5120ms). Unchanged focused rerun:32/32PASS, wall6.76s.
  Final full command explicitly allows15000ms per test; no assertion, test or
  config change. This is a full CLI15s gate PASS, not a default-timeout full PASS.
  Both failed full attempts retain separate frozen1260-path proofs and log hashes.
- Dependency audit remains FAIL; no dependency change is part of CAT01.

## Recovery, scope and release limits

Final recovery/protected-scope results: PENDING_FINALIZATION.
Original Argon workspace remains read-only. Full private snapshot and selected
salvage/assets/ledgers/prior evidence must pass the separate post-commit receipts.
Private recovery location is never published.38 owner reviews remain PENDING.
Independent diff/guard review found no concrete CAT01 runtime/security defect;
its receipt does not certify unresolved dependency advisories or external gates.

0044 must precede the new Worker. Old24-field writers remain valid for NULL lots;
old writers must fail closed on categorized lots. Mixed-worker coexistence and
rollback require a separate operator-reviewed plan. Application rollback keeps
additive schema. No local success authorizes a release.

No new frontend layout/assets or rebuild. Finite UI01-UI15+C12/C13 local scope was
previously executed; owner/media/device/Safari/screenreader/live/hosted acceptance
remains pending. Next: SCAN01 manual review history, WKD01 durable offline queue,
WKD02 immutable Week swap replay, each with its own ADR/gates.
No push, merge, deploy, remote migration or production operation.

Public evidence preparation initially exited1 with KeyError:log_path because a
verification-only proof was mistaken for an execution receipt. The ignored
exporter now requires log_path; retry succeeded with38 receipts and4 screenshots.
No source/test/config changed. Final export assertions bind the passing full,
lint, types, migrations and both builds to the frozen manifest; historical
attempts retain their own hashes. Finalizer hardening is later than the independent
review's recorded helper hashes; it does not change that review's runtime scope.
