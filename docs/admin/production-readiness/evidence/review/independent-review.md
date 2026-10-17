# Independent review: 3b75f20e3a6ab9c55c479dacc612eb483f6f4598

Reviewed `cc1267e719b4af38325a20290382481e86f67a05..3b75f20e3a6ab9c55c479dacc612eb483f6f4598` read-only in the recovery worktree. No Cloudflare access, deployment, approval, or repository edits were performed.

## Findings

### P1 - Revoking the third eligible SUPER_ADMIN disables all production admin access

`src/worker/routes/admin/index.ts:254-265, 328-330` permits an approved SUPER_ADMIN revocation while the database trigger in `migrations-admin/0001_admin_console_foundation.sql` and `ADMIN_SUPER_ADMIN_MINIMUM` retain a floor of two. `src/worker/routes/admin/auth.ts:182` and `src/worker/routes/admin/governance.ts:9-12` require at least three active enrolled SUPER_ADMIN operators for every production session and login. Therefore a valid 3-operator production roster can approve removal of one operator, leave two active rows, and immediately make `/me` and new login return `503 ADMIN_GOVERNANCE_INCOMPLETE`.

Reproduced against the exact candidate with a locally signed Access JWT and local SQLite D1: delete request `201`, approval `200`, active eligible SUPER_ADMIN count `2`; the existing session then returned `503 ADMIN_GOVERNANCE_INCOMPLETE`, and a fresh login returned the same `503`.

The existing tests verify readiness becomes false at two operators, but do not exercise a production revoke followed by session validation/login. Add a regression that attempts the 3-to-2 transition and asserts the transaction is rejected before the role/audit mutation.

### P2 - SUPER_ADMIN approval can grant a revoked target

`src/worker/routes/admin/index.ts:315-317` checks `eligibleUser()` before the approval batch, but the guarded `UPDATE` and subsequent `INSERT` at `:323-338` only recheck requester authority, target's existing SUPER_ADMIN row, and expiry. They do not recheck an active `operator_identity_bindings` row joined to an active `approved_human_operators` row for `target_user_id` inside the same transaction. If the target's identity is revoked after the precheck and before the batch, the approval still becomes `approved`, inserts an active SUPER_ADMIN role, and writes a success audit.

Reproduced against the exact candidate by using the local D1 `beforeBatch` hook to revoke `fx_user_003` immediately before the approval batch. The endpoint returned `200`; the target binding was `revoked`, yet `admin_role_assignments` contained an active `SUPER_ADMIN` row and `admin.approval.approve` had a success audit.

The same precheck-only race exists for the immediate non-SUPER grant path at `src/worker/routes/admin/index.ts:209-231`: the target can lose its active enrollment between `eligibleUser()` and the unconditional `INSERT`. Add transaction-local active enrollment predicates for both grant paths, plus a test that injects target revocation before the batch and asserts no role or success audit.

## Validation

- Focused exact-candidate tests: 4 files, 14 tests passed with `vitest --maxWorkers=1`, bundled Node runtime, and `TMPDIR=/private/tmp`.
- Local-only reproductions above used SQLite D1 and locally generated RSA Access assertions; they are not staging or production evidence.
- Known limitations: no Cloudflare staging/production adapters or live resources were accessed; workflow files are offline preparation plans; full-suite validation was not used as a release certification.
