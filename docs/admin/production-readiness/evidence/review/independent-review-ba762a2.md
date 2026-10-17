# Independent targeted security re-review

Exact reviewed runtime candidate: ba762a205fd890efe4af47ef6c0fd7cd6f45fc14.
Previous resubmission: 53f4f4a0c14475fb411aa1a53ae90d09d87b5498.
Initial reviewed R2 candidate: 3b75f20e3a6ab9c55c479dacc612eb483f6f4598.

## Findings and disposition

No unresolved concrete finding remains in the reviewed remediation scope on this exact candidate.

- Initial P1, normal three-to-two SUPER_ADMIN revocation disables all production-policy sessions and logins: addressed. The runtime uses a minimum of three eligible operators, API decision counts use the configured actor issuer cohort, and additive migration 0003 enforces the remaining same-issuer active enrolled human roster at the durable role transition. Inactive identities, revoked human operators, and other-issuer assignments do not inflate the count.
- Initial P2, target enrollment revocation immediately before SUPER_ADMIN or ordinary role grant: addressed. The SUPER_ADMIN approval transaction checks target eligibility again; the additive insert trigger covers active role grants, including ordinary grants and recovery. Revoked binding and revoked human-operator race cases returned 409 without a grant or a success audit.
- Follow-up P2, safe offboarding of an already-ineligible fourth SUPER_ADMIN is blocked: addressed in the final runtime diff at src/worker/routes/admin/index.ts:88, :256, and :334. Both request and approval count eligible operators remaining after excluding the target assignment and require at least three. Production-policy probes verified successful audited cleanup of a revoked binding and a revoked human operator while the three remaining operators retain session/login access.

## Independently executed final-candidate checks

- External local harness: 12 production-policy scenarios passed on this exact SHA using local SQLite D1 constraints and locally generated signed Access assertions. Covered three-to-two refusal; inactive binding fourth; inactive human fourth; other-issuer fourth; successful four-to-three removal; pre-batch roster-loss race; both safe cleanup cases; revoked binding/operator before SUPER_ADMIN and SUPPORT_AGENT grants. No remote resources were used.
- Final focused test rerun: three files, 20 tests passed with bundled Node, TMPDIR=/private/tmp, --maxWorkers=1, and --testTimeout=20000. Files: tests/integration/admin-r2-governance-races.test.ts, tests/unit/admin-config.test.ts, tests/unit/admin-recovery.test.mjs.
- The preceding run at the default five-second timeout had 19 passes and one fixture/setup-related timeout in the first governance-race test. There was no failed behavior assertion. This timeout was observed while full validation and the external fixture-heavy probe were running concurrently; it is retained as a test-duration observation, not silently replaced by the passing rerun.
- Final diff whitespace check passed. The checkout was clean and HEAD matched the full SHA when inspected.
- Verified the final resubmission changes only the remaining-roster API predicates, two cleanup regression cases, and the exact migration-list assertion. Historical migrations 0001/0002, additive migration 0003, facade, recovery verifier, workflows, and customer runtime/migrations/release configuration are unchanged from the prior reviewed candidate.
- Machine-readable final scenario evidence: independent-review-ba762a2-reproductions.json.

## Review coverage

Across the exact-SHA review chain, inspected Access identity/signature/issuer/audience/time handling; session identity, epoch, expiry and revocation; server RBAC; Origin/CSRF/CSP and asset routing; internal Service Binding and HMAC operation/input authority; named read-only customer SQL and bounded output contracts; bootstrap, approval, audit and minimum-roster atomicity; additive migration behavior; offline Ed25519 manifest verification and one-time audited recovery; and least-privilege offline workflow triggers and publication safety. The unchanged recovery tests were rerun on the final candidate and pass with schema version three.

This was performed by a delegated reviewer who did not implement the R2 code or fixes. No repository source was edited by the reviewer. No external communications, Cloudflare access, environment approvals, deployments, production D1 operations, or certification actions were performed by the reviewer.

## Limits and release blockers

This is targeted independent source review and local verification. It is not complete security certification, operator approval, a live staging pass, or production readiness approval. Earlier test/source evidence is attributed to its exact candidate; it is not represented as a full final-candidate test suite result.

The review did not validate real Cloudflare Access/JWKS rotation, actual D1 distributed concurrency, staging resource identities, GitHub protected-environment settings, real operator independence, staging rollback, production shutdown, deployment or migration adapters. All four release workflows remain offline preparation plans; absent reviewed live adapters and explicit staging/operator authorization remain technical release blockers. The larger final local validation run is managed separately by the implementation owner and is not claimed by this reviewer.
