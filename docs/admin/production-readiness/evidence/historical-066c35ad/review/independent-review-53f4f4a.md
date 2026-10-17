# Independent targeted review: 53f4f4a0c14475fb411aa1a53ae90d09d87b5498

Candidate: 53f4f4a0c14475fb411aa1a53ae90d09d87b5498.
Prior reviewed candidate: 3b75f20e3a6ab9c55c479dacc612eb483f6f4598.
Review was source-read-only. Local artifacts were written outside the checkout. No Cloudflare, external publication, approval, staging, or production operations were performed.

## Remaining finding

P2 - Safe cleanup of an already ineligible SUPER_ADMIN role is blocked when three eligible operators remain. `src/worker/routes/admin/index.ts:254-259` rejects any SUPER_ADMIN revocation request whenever the current eligible same-issuer count is three, even when the role being revoked belongs to a revoked binding/operator and therefore is not in that count. The approval guard at `:332-335` has the same current-count assumption. The new database trigger correctly counts the remaining eligible cohort excluding the target assignment. Align the API guards with that trigger: require the remaining eligible cohort, excluding the target assignment, to be at least three. This permits safe offboarding without allowing three eligible operators to become two. The implementation owner acknowledged the issue and is preparing a successor candidate.

## Prior findings: targeted verification

- Prior P1 three-to-two outage: addressed on this candidate by minimum-three runtime policy, active enrolled operator view, same-issuer API counts, and additive database revocation guard. Independently verified blocked three-to-two revocation and continued production-policy session/login availability.
- Prior P2 target enrollment race: addressed by transaction-local target check for SUPER_ADMIN approval and the insert trigger for all active role grants. Independently verified revoked binding and revoked human operator at the pre-batch boundary for both SUPER_ADMIN and SUPPORT_AGENT grants; each returned 409 with no grant or success audit.

## Independently executed checks

- Five R2/recovery test files, 23 tests passed with bundled Node, TMPDIR=/private/tmp, and --maxWorkers=1.
- Admin schema smoke passed with schema version three, bootstrap rollback/audit, minimum guard, immutable identity, and append-only audit checks.
- Ten additional production-policy scenarios passed using locally generated signed Access assertions and real local SQLite constraints: three eligible operators; fourth binding revoked; fourth human operator revoked; fourth operator in another issuer; valid four-to-three approval; fourth operator revoked immediately before approval; target binding/operator revoked before SUPER_ADMIN grant; target binding/operator revoked before SUPPORT_AGENT grant. Subsequent session and fresh login remained successful in the tested revocation scenarios.
- Exact machine-readable scenario evidence: independent-review-53f4f4a-reproductions.json.
- Historical migrations 0001/0002, offline recovery verifier, facade, workflows, and customer release/runtime/migration surfaces were unchanged in the resubmission diff. Diff whitespace check passed.

## Wider review and limits

Inspected unchanged R2 auth/session identity and epoch validation, Access signature/issuer/audience/time checks, CSRF/origin/CSP and Worker assets, server RBAC, HMAC capabilities bound to operation and input, read-only named facade SQL, bounded query/output contracts, bootstrap and approval atomicity, offline Ed25519 recovery with target/audit/replay guards, migration compatibility, and offline GitHub workflow triggers and permissions. No additional concrete security finding was confirmed in those areas.

This is targeted independent review and local verification, not complete security certification. Real Access/JWKS operations, staging resources, real D1 concurrency, protected GitHub environments, production deployment/rollback, and live release adapters were not validated. The four release workflows remain offline plans; missing live adapters and operator/staging authorization remain technical release blockers. A successor SHA is required for the remaining cleanup fix and must receive exact-source verification.
