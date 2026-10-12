# B01a A2 - Local validation

Status: B01a_A2_ROUTE_CLIENT_LOCAL_VERIFIED. Final implementation `dcc0e1a74d2f5e3b67e13ecbb241bc04c8fafdde`.

Root runner records working directory, start/end HEAD, UTC start, elapsed time,
command arguments, environment, exit and raw SHA256. Agent receipts retain only
the execution metadata they actually captured; missing UTC values are not invented.
Raw logs are preserved in deterministic gzip files with hashes in validation.json.

Final full suite: **293 files / 7037 tests PASS**.
Recovery focused: **15 files / 454 tests PASS**.

Node24, pnpm10.33.2, CI=true, NODE_OPTIONS=--no-experimental-webstorage,
WRANGLER_SEND_METRICS=false; remote gates unset. Full suite uses maxWorkers=2,
the same bounded worker setting as the verified A1 run. Wrangler ancillary update
lookup uses actual registry metadata in a task-only TMPDIR, with no dependency
or timeout change. Build runs after full tests because Vite SSR tests share
dist/client/sw.js. No concurrent build is used.

| Gate | Result | Wall seconds |
| --- | --- | --- |
| typecheck-first | PASS / exit 0 | 12.875 |
| cleanup-first | FAIL / exit 1 | 1.481 |
| routes-first | FAIL / exit 1 | 5.015 |
| routes-password-second | PASS / exit 0 | 5.152 |
| routes-parity-first | FAIL / exit 1 | 7.421 |
| routes-parity-second | FAIL / exit 1 | 6.514 |
| routes-parity-final | FAIL / exit 1 | 7.447 |
| lint-first | PASS / exit 0 | 5.818 |
| typecheck-password | PASS / exit 0 | 12.539 |
| routes-final | PASS / exit 0 | 6.656 |
| isolated-local-d1 | PASS / exit 0 | 81.545 |
| migrations | PASS / exit 0 | 0.442 |
| audit-prod | FAIL / exit 1 | 2.004 |
| audit-full | FAIL / exit 1 | 3.077 |
| focused-frozen | FAIL / exit 1 | 39.466 |
| typecheck-frozen | PASS / exit 0 | 12.628 |
| lint-frozen | PASS / exit 0 | 5.592 |
| scope-freeze | PASS / exit 0 | 6.539 |
| schema-final | PASS / exit 0 | 1.176 |
| frozen-install | PASS / exit 0 | 0.498 |
| lint-final | PASS / exit 0 | 5.683 |
| main-reverify | PASS / exit 0 | 2.86 |
| typecheck-final | PASS / exit 0 | 15.338 |
| focused-final | PASS / exit 0 | 39.024 |
| scope-freeze-final | PASS / exit 0 | 5.767 |
| lint-committable | PASS / exit 0 | 5.304 |
| full-tests-committed | FAIL / exit 1 | 138.94 |
| route-clock-final | PASS / exit 0 | 6.844 |
| lint-recovery | PASS / exit 0 | 6.636 |
| typecheck-recovery | FAIL / exit 2 | 11.127 |
| focused-recovery | PASS / exit 0 | 24.631 |
| lint-recovery-final | PASS / exit 0 | 5.744 |
| typecheck-recovery-final | PASS / exit 0 | 13.013 |
| scope-freeze-recovery | PASS / exit 0 | 5.719 |
| full-tests-final | PASS / exit 0 | 348.603 |
| build-sequential | PASS / exit 0 | 10.663 |

## Failure history and corrections

First root cleanup run failed because the fake DB batch returned no statement
results. The fake now executes every statement and preserves per-statement receipts.
First route run: 33 PASS / 2 FAIL; an intended expired key used a 34-character nonce,
and users=[] ignored the migration-seeded demo user. Both fixtures were corrected.

The password-choice transition run kept coordinator tests passing while 59 old
route tests failed because the HTTP schema/forwarder still stripped newPassword.
Registration now forwards the chosen activation password; forgot verify remains
preliminary. Missing chosen password is VALIDATION_ERROR before admission.

Root parity first run: 48 PASS / 2 FAIL; the test used SQLite seed() with unbound
parameters so its account/membership mutations never applied. Bound writes now
inject real postcommit changes. Subsequent single failures were expiry fixtures
violating expires_at>created_at, then an unchanged-expiry assertion after the fixture
explicitly aged both known/unknown issuances. Constraint-respecting fixtures and
accurate timestamp assertions corrected those failures.

First combined focus: 407 PASS / 8 FAIL, across two files. Exact issuance DTO
assertions omitted the new cooldown; a schema success fixture omitted the chosen
activation password. Exact DTO/parity checks were retained and updated.

First complete committed-source run: **293 files, 289 PASS / 4 FAIL; 7037 tests,
7012 PASS / 25 FAIL**. One parity test compared 59 with 60 seconds across a D1
second boundary. It now compares stable public fields and independently validates
each cooldown from its own D1 clock/expiry. Cleanup expected deletion of retained
legacy failure evidence; fixtures now assert its preservation and zero-failure
deletion. Guest-transfer fixtures used legacy challenges and untyped mail results;
they now use accepted strict challenges and preserve native/backfilled/legacy
inventory and all auth authority snapshots. Deferral precedes admission, including
wrong/expired/used/locked/missing challenges; explicit continuation verifies a
strict OTP with chosen password. Turnstile test asserted after two microtasks while
new asynchronous crypto work remained pending; bounded state-based waiting now
asserts completed registration/resend while preserving the one-widget contract.

Agent development failures remain separate: first transaction 176 PASS / 1 FAIL
was a obsolete KV-warning fixture; first client development 39 PASS / 8 FAIL had
old delivery fixtures (no raw log retained). Client password transition 118 PASS /
5 FAIL, then 125 PASS / 2 FAIL had old payload/input fixtures; final 128 PASS.
See raw logs and reviewer receipts for exact runs; no failed result is renamed PASS.

Recovery focused passed 15 files/454 tests. The concurrent recovery typecheck failed
TS2344 on a test-only spy overload annotation. The MockInstance type-only fix
then passed global lint and typecheck. The final clean committed full suite includes
this exact final fixture; recovery focused is not claimed as a committed-source run.
The first guest/cleanup adaptation had 26 guest setup failures and 11 cleanup PASS:
retained historical legacy evidence had a fresh default created_at and correctly
triggered imported cooldown. Aging that historical fixture consistently restored
37 PASS; both agent logs remain preserved.

Fresh audits exit1: full 2 critical / 16 high / 19 moderate / 4 low; production 2 moderate,
0 high or critical. Lockfile unchanged. B08 owns remediation; audit is not PASS.

## Scope and practical limits

The 23 frozen source/test files match final implementation Git blobs. All 369
protected records, including every 40 migration, config, workflows, dependency
files and unrelated backend authority, match the prior A1 receipt baseline.
The masterplan input hash is unchanged. D1 local apply/reapply proves exact 40
ledger entries, no pending migration, schema gate[], foreign keys[], quick_check ok.

Comparison spies prove the 5-candidate bound under 20/100 distinct racers and
single-key replay; real SQLite required-write failures roll back registration/reset
effects. Postcommit profile/email/membership/revocation faults publish no cookie.
Forgot parity covers pending/rejected/unknown/consumed/superseded/expired/deleted
states without a timing-indistinguishability claim. Active proof/current budget/
legacy failure/import retention and cleanup rollback are exercised.

This is local route/client verification. No browser E2E, hosted D1 fault/concurrency
proof, real mail/inbox/bounce, production readiness, hardened rollback, secret
rotation, remote DB/R2, push/PR/merge or deployment certificate follows. Guest
inventory transfer remains explicitly deferred. Current0039-pinned release tooling
must be updated/reviewed separately before a0040 hosted rollout.
