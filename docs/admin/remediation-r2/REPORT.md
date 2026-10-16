# Admin R2 recovery boundary — 2026-10-16

**Status: ADMIN_V1_R2_BLOCKED. Do not publish, merge, deploy or enable.**

Recovered source revision: `9f3e59a6ed3a9b6b6041fef2e0a83340d1db1dd5`. All current observations below refer to
this incomplete recovered source or the explicitly labelled preceding revision
`9ade6a1593016e99ecd6cd4044495c95ed7cccb9`. No independent review PASS is claimed.

Repeated sandbox replacement restored stale branch refs and removed uncommitted
facade/governance modules. Committed Git objects survived: the implementation
branch was fast-forward recovered through `9ade6a15`, then the matrix's missing
`spawnSync` import was corrected in `9f3e59a6`. No reset, rebase, force push,
publication, remote D1, deployment, production bootstrap or activation occurred.
The historical handoff branch and PR #77 were not modified. Task auto-merge for
PR #77 is explicitly off; the existing review loop remains enabled.

## Reproducible blocker

The recovered integration imports modules that are absent from this source:

- `src/worker/admin-read-facade-worker.ts`
- `src/worker/facade/contract.ts`
- `src/worker/facade/customer-read-service.ts`
- `src/worker/routes/admin/customer-facade-client.ts`
- `src/worker/routes/admin/governance.ts`
- `migrations-admin/0002_admin_identity_governance_r2.sql`
- `tests/integration/admin-r2-facade.test.ts`
- `tests/integration/admin-r2-governance.test.ts`

These are not optional dependencies. Do not replace them with permissive stubs,
re-enable the direct customer DB binding, skip assertions or deploy this tree.
The only surviving migration is Admin0001/version1, while auth requires version2.
A successful current `check:migrations` therefore tests version1 only, not R2.

## Final checks after recovery

At source `9f3e59a6ed3a9b6b6041fef2e0a83340d1db1dd5`, the expanded local
migration matrix completed with exit1, **20/23**. Its three failing rows expose
the lost R2 schema: Admin version remains1 versus required2, and rollback
failure injection cannot find the missing new columns. The historical41 and
current-main43 migration/strict drift scenarios passed. Full JSON is retained
in `evidence/migration-matrix-9f3e59a6.json`.

Lint, version1-only migration smoke and20 routing tests passed on the recovered
integration source before the matrix import-only fix. Typecheck/build/auth
collection/workerd/browser startup failed because required modules are missing.
The full-suite bail attempt was stopped after the same confirmed import failure
(exit143); no completed full-suite result is claimed. Current browser screenshots
cannot be verified or supplied because the app does not start.

## Recovery references and next action

The restored preliminary draft is preserved in local stash
`7acadce3ad76ca58e88375665537538b7d957584` and ignored recovery artifacts. It was
not applied: it is not the completed signed-recovery/enrollment implementation
and must not be mistaken for certified R2 source. The last runnable pre-R2
checkpoint is `a066204047d0ec4c306987db9c82fb5aa3ac4d5e`; its recorded full suite
has a failure and is not a clean all-gates PASS.

Next: recover or reconstruct the missing modules in a durable workspace,
checkpoint each before verification, finish integration, then run every mandatory
gate on one frozen implementation SHA. Re-run all original/adversarial PoCs,
real multi-Worker workerd, ten keyboard repeats and browser appearance/behavior.
Complete all evidence before changing the verdict. No push is authorized.

---

# Admin Console remediation R2

**Status: ADMIN_V1_R2_CHANGES_REQUIRED. Local implementation and integration in progress.**

This is an implementer report, not an independent review or a deployment approval.
The customer Worker, customer authentication, customer migration history, payment
runtime and release workflows must remain unchanged from merged main `0ff82ed`.

## Provenance

Initial handoff: `87d6d3d2acc69a6ca3f0409c3c22753469807222`.
Main merge: `a2f47c5cb22230d242d47d135ec6861964232c00` (parents `9ee4c49`, `0ff82ed`).
WP0 checkpoint: `a066204047d0ec4c306987db9c82fb5aa3ac4d5e`.
Local R2 integration checkpoints follow on `feat/admin-v1-r2-isolation-governance`.
The final tested implementation revision must be recorded in SOURCE_MANIFEST.md
before this package can be marked ready for independent review.

## Verification boundary

The WP0 migration matrix ran 14/14, workerd surface checks 108/108,
browser E2E 12/12, lint, typecheck, build and both migration smokes passed.
These observations preceded the unfinished R2 changes and are not R2 evidence.
The WP0 two-worker full-suite run failed one 30-second family-planner test
(8,574 passed / 1 failed); its isolated rerun passed 3/3. That combination is
not a clean full-suite PASS. A fresh single-worker run was interrupted by the
unexpected sandbox replacement at approximately 07:38 UTC on 2026-10-15.

The replacement restored an older snapshot and removed uncommitted source and
new evidence. Recovery uses retained tool/agent context and local checkpoint
commits; no lost output is being presented as a fresh current-source check.

## Delivery restrictions

No R2 push, PR publication, merge, deploy, remote D1 access, credential change,
production bootstrap or remote activation is authorized or performed.
PR #77 remains a draft handoff; task auto-merge is explicitly disabled.
