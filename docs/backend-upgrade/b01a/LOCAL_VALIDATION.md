# B01a A1 - Local validation

Status: B01a_A1_DORMANT_LOCAL_VERIFIED. These are executed local checks; the
legacy auth routes still handle live traffic. Independent review is agent review.
The frozen tested source matches implementation Git blobs. sourceAttribution records
commit/run chronology retrospectively; the original runner did not capture start HEAD.
Exact command arguments, UTC start, environment, wall duration, exit, raw SHA256,
and deterministic gzip SHA256 are in validation.json. Failed runs remain distinct.

Node24.16.0, pnpm10.33.2, NODE_OPTIONS=--no-experimental-webstorage, CI=true,
WRANGLER_SEND_METRICS=false; remote gate flags unset. Full-suite TMPDIR is a new
canonical /private/tmp task directory with actual-registry Wrangler metadata
(version4.149.0, fetched timestamp/raw hash recorded), not an installed upgrade.
No timeout/assertion/source waiver. Build is sequential with real Vite SSR tests.

Test Files  291 passed (291)
Tests  6908 passed (6908)
Duration  356.22s (transform 4.56s, setup 1.21s, collect 36.75s, tests 602.47s, environment 10.47s, prepare 11.41s)

| Gate | Result | Wall seconds |
| --- | --- | --- |
| audit-full | FAIL / exit 1 | 2.4 |
| audit-prod | FAIL / exit 1 | 1.158 |
| build-final | PASS / exit 0 | 7.536 |
| build-sequential | PASS / exit 0 | 7.77 |
| build | FAIL / exit 1 | 5.017 |
| focused-final | PASS / exit 0 | 16.768 |
| focused-fourth | PASS / exit 0 | 12.671 |
| focused-second | PASS / exit 0 | 5.231 |
| focused-third | PASS / exit 0 | 11.15 |
| frozen-install | PASS / exit 0 | 0.484 |
| full-tests-committed | PASS / exit 0 | 357.039 |
| full-tests-rerun | FAIL / exit 130 | 226.082 |
| full-tests | FAIL / exit 1 | 336.804 |
| historical-recovery-agent | PASS / exit 0 | 133.674 |
| historical-root | PASS / exit 0 | 6.833 |
| isolated-local-d1-rerun | PASS / exit 0 | 10.669 |
| isolated-local-d1 | FAIL / exit 1 | 11.604 |
| lint-final | PASS / exit 0 | 6.321 |
| lint-frozen | PASS / exit 0 | 6.502 |
| lint-post-historical | PASS / exit 0 | 7.308 |
| main-reverify | PASS / exit 0 | 0.559 |
| migrations-final | PASS / exit 0 | 0.51 |
| migrations | PASS / exit 0 | 0.462 |
| scope-freeze | PASS / exit 0 | 0.196 |
| staging-historical | PASS / exit 0 | 5.819 |
| typecheck-final | PASS / exit 0 | 13.507 |
| typecheck-frozen | PASS / exit 0 | 14.47 |
| typecheck-post-historical | PASS / exit 0 | 14.329 |
| typecheck | FAIL / exit 2 | 9.279 |

## Failure history and recovery

The earliest coordinator development fixture produced 41 failures because household
created_by was absent. The fixture was corrected; no raw command log is retained
for that early observation. The first retained focused log reports 90 PASS; later
focused 102, 201, 208 and final 287 PASS show successive review regressions.
A retained typecheck failure was an incorrect Vitest spy overload, fixed by
MockInstance typing; final typecheck and lint pass without suppression.

Initial full suite: 4 failed files / 287 passed; 7 failed / 6890 passed tests (6897 total),
including one failed suite whose 8 tests could not collect. The new 0040 exposed
historical fixtures selecting the current chain rather than reviewed 0039 candidate
and 0038 observations. Four test files now retain that historical prefix, recompute
matching manifest metadata and reject later chains. Seven further recovery/staging
fixtures pin the actual historical 652e Git source; this prevents failure after 0040
is committed. Historical recovery 331 tests and staging 37 tests passed. The intermediate
full rerun was interrupted by root at 226 seconds (exit 130) to finish that scope;
no completed-suite claim follows from it. The final full suite runs on committed
implementation 0649324a with an actual 40 entry Git migration manifest. Production scripts/workflows
and old 39 migration bytes are unchanged. Only the independently reviewed schema
SQL hash pin changes with the additive template.

The concurrent build failure is consistent with a shared artifact race: the existing
SW token hook can execute on actual
Vite SSR dev close while build uses the same dist/client/sw.js. Source path and
mtime match this explanation; exact writer PID was not captured. Sequential build
passes. Existing hook/config remains unchanged; B08 owns a durable harness fix.

Initial isolated D1 verification used SQL LIKE with unescaped underscores, so its
OTP table selection also matched auth_otps. All SQL/apply/integrity commands had
succeeded; the final Python table-list assertion failed. The corrected substr
selector ran against a second fresh isolated local database and passed. Raw first
and rerun outputs are retained separately.

Fresh audits exit 1: full 2 critical / 16 high / 19 moderate / 4 low; production 2 moderate,
0 high / 0 critical. Unchanged lockfile; findings remain B08 triage, no audit PASS claim.

## What the evidence proves

The actual coordinator comparison boundary is spied under 20/100 distinct racers,
20 same-key racers, fifth-candidate success, budget denial and no-key retries.
Required-write-ignore/constraint faults roll back effects in real SQLite batches;
lost responses retain admission ownership and never mint replay credentials.
Principal recreation, proof deletion/expiry/supersession, legacy imported failures
and paired stale transitions are covered. Six additive tables,52 columns and two
indexes are enforced by the schema gate. The isolated Wrangler ledger is exactly
40 entries, reapply has no pending migration, gate [], FK [], quick_check ok.

No hosted D1/route/client/current-production certification follows from these
local results. Kernel remains unimported by routes/providers; A2 integration and
hardened rollback proof remain open. No aggregate production check/browser E2E,
mail/paid-provider calls, remote DB/R2 or deploy were run.
