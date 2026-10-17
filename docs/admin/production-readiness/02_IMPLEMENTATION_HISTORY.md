# Execution ledger

## G0 source preservation

2026-10-17 Asia/Tokyo: verified stable repository identity, main/PR/R2 full SHAs, inspected local branches/worktrees/stashes and remote release protection. Created isolated implementation branch from cc1267e719b4af38325a20290382481e86f67a05, local rescue refs and complete verified Git bundle with SHA256 manifest before reconstruction.

Next: recover selected R2 source without replacing current customer/brand code; reconstruct absent contracts and schema; reproduce baseline failures; checkpoint every coherent package. Findings remain OPEN and no R2 PASS is claimed.

Gates: G0 in progress; G1-G4 pending. Independent review and real staging require external operator/reviewer participation.

## Reconstructed R2 source package

Typecheck succeeds after reconstructing the missing facade contract, RPC Worker/client, customer query projections, Admin identity schema and governance helpers. Dedicated facade tests pass 3/3; Admin API/RBAC + R2 authentication tests pass 22/22 including twenty injected decider-revocation races. These are working-tree checks, not frozen-SHA release evidence. F1-F11 remain open pending complete regressions and independent review.

Production Access authority now uses Admin DB issuer/subject enrollment and security epoch, independent from customer passwords. Local credentials are isolated in Admin DB. Customer code, migrations and release workflows are preserved. Facade uses fifteen named operations with signed short-lived server capabilities; additional strict output schemas and query-resource bounding remain required before F1/F7 closure. Staging is not authorized.

## Recovery validation reconciliation

The R1 fixture expected two bootstrap grants and customer credential coupling. R2 now tests three enrolled operators, one atomic ceremony audit, Admin-local credential changes, operator revocation and security epoch revocation. 76/76 focused governance/remediation/tooling tests pass. Access login now rejects a mismatched verified email even with a valid enrolled subject. Enrollment schema remains strict: explicit approval references are required; no legacy defaults or implicit identity enrollment. Full suite, query bounds, runtime, offline recovery and release workflows are still pending.

## R2 boundary hardening checkpoint (2026-10-17)

Added strict output schemas for all fifteen named facade operations, a capped
materialized source query boundary, offline Ed25519 recovery verification with
distinct keys and database-side replay/audit guards, and safe offline workflow
plans. Admin Settings resolves enrolled operator labels from ADMIN_DB, with a
regression that first failed when customer D1 was unavailable and now passes.
Updated the E2E assertions for three-operator enrollment and HTTP 404 on unknown
server routes. Generated visual evidence remains outside tracked screenshots.

Working-tree validation: lint, typecheck, build, dependency audit, Admin migration
smoke, migration matrix 23/23, workerd 9/9 and browser E2E 12/12 passed. Initial
full regression: 8,636 passed, 11 failed, all in two unchanged T21RC2 temp-path
suites on macOS Node 25. Those 93 tests pass with bundled Node 24 and canonical
TMPDIR=/private/tmp; final whole-suite rerun on the frozen checkpoint is required.
Earlier failures and command logs remain in .artifacts/admin-r2/final/.

No independent closure, live release adapter, staging, production access or
production readiness is claimed. Next: freeze this source, run complete checks
on the exact commit, obtain separate code/security review, finish the evidence
packet and publish only after public-change/workflow safety checks.

## CI fixture startup repair (2026-10-17)

Exact-source validation of `6c3c68147efb3f95b435b9452df34e76bea17a82`
with CI=true reproduced a tooling blocker: synthetic preview and local D1 seed
called the real operator provisioning guard, which rejects CI. Workerd reached
its first three closed-surface scenarios, then fixture setup failed; browser
startup also failed. These are retained as FAIL, not certified browser results.
The in-progress full suite was deliberately stopped (SIGTERM) before changing
source and is retained as INTERRUPTED, not PASS.

Synthetic preview/seed now use a dedicated guard that retains explicit --local,
development environment, remote-flag and reachable-token restrictions. Real
operator provisioning retains its CI prohibition. Two dedicated regression cases
cover positive synthetic CI setup and negative CI operator/remote/env/credential
paths. Working-tree validation: 25/25 tooling/config tests, lint and typecheck
exit 0. New exact-source workerd/browser/full validation follows this checkpoint.
No remote resource or credential operation is added.

## Frozen local verification and evidence package

Timestamp: 2026-10-16T20:59:47.897729+00:00. Runtime SHA `066c35ad670bc877756150c2055e3844dd7a17ce`.
All fourteen owner validation commands completed with exit 0 and source unchanged;
see 12_REGRESSION_RESULTS.md for counts, commands and artifact hashes. Earlier
failed/incomplete runs are attributed to their original sources. Separate
independent final-delta review has no new actionable finding within its scope.
Nineteen required documents and sanitized evidence are packaged. Live release
adapters, account access, operator/staging authorization and certification remain
blockers. No production or real staging operation is performed.

| Checkpoint | Package |
| --- | --- |
| b15215286bb4a9c392e50be80634e96bac2fb92d | docs(admin): checkpoint verified R2 recovery provenance |
| 50cdd740ca2d250b9160477251e2ff3c77fac3ba | fix(admin): recover R2 facade and independent operator authority |
| 3b75f20e3a6ab9c55c479dacc612eb483f6f4598 | fix(admin): enforce bounded disclosure and offline recovery controls |
| 53f4f4a0c14475fb411aa1a53ae90d09d87b5498 | fix(admin): preserve eligible operator roster and atomic target enrollment |
| 77a08c38484e8a32d718ab11c932d6d402ab9d3e | test(admin): update migration manifest expectation |
| ba762a205fd890efe4af47ef6c0fd7cd6f45fc14 | fix(admin): permit safe offboarding with three eligible operators remaining |
| 6c3c68147efb3f95b435b9452df34e76bea17a82 | test(admin): align governance UI with three-operator floor |
| 066c35ad670bc877756150c2055e3844dd7a17ce | fix(admin): allow isolated synthetic fixtures in CI |

## Release containment and evidence producer

Current source `9395f0e31ea599f1eb7780a8eba36964fed7c483` adds signed disabled release adapters and five manual
workflows, including independent containment, strict smoke, restore compensation,
account-wide route checks and signed staging-report artifact packaging. Full local
checks and independent review are attributed to this exact source in 12/13.
