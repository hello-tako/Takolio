# Database migrations

Runtime source: `9395f0e31ea599f1eb7780a8eba36964fed7c483`. Main baseline: `526596a8cd857984ad2b69901a8c7b0e9d6bccc2`.
Prepared by implementation owner `/root` (Codex); independent reviewer is
`/root/independent_admin_review`. Evidence environment: local macOS arm64,
Node v24.16.0, pnpm 10.33.2, Python 3.9.6, `TMPDIR=/private/tmp`.
Evidence timestamps are UTC. Commands, exit codes, log digests and limitations
are in `evidence/verification.json` and `12_REGRESSION_RESULTS.md`.
No live Cloudflare operation or operator approval is implied.

Customer `migrations/` and production migration workflows are preserved.
Admin ledger is separate under `migrations-admin/`; historical 0001 is unchanged.
No customer index/schema change is authorized by this work.

| Migration | Purpose |
| --- | --- |
| 0001_admin_console_foundation.sql | Retained foundation, roles/sessions/audit/approvals and original guards |
| 0002_admin_identity_governance_r2.sql | Approved humans, issuer/subject binding, epoch/session revocation, atomic bootstrap, immutable approval and independent authority guards, local-only credentials, DB identity and recovery audit/replay guards |
| 0003_admin_governance_transaction_guards.sql | Eligible SUPER_ADMIN view, same-issuer three-operator floor, enrollment insert guard and approval target recheck; schema version 3 |

Exact file SHA256 and chain digest are in `evidence/release-plan.json`.
Runtime requires schema version `3`; partial upgrade fails closed. Migration 0002
revokes old sessions, so an upgrade requires controlled operator re-enrollment
and reauthentication rather than retaining R1 customer credential authority.

Local evidence: customer+Admin smoke scripts, all-prefix/upgrade/replay checks in
`evidence/migration-matrix.json` and `evidence/verification.json`, SQLite failure
injection and actual local Wrangler D1 migration replay. The matrix compares
main baseline, pre-Admin/R1 and current source and records compatibility limits.
It is local D1 evidence; it does not inspect any remote ledger.

## Future authorized apply sequence

Freeze a reviewed source and exact manifest; identify dedicated ADMIN_DB and
prove it differs from every customer target; obtain a restorable backup; compare
remote identity and ledger with the approved manifest; use a protected reviewed
Admin-only adapter; stop on any mismatch; verify resulting schema/version,
append-only audit, session invalidation and replay behavior while flag remains
off. Do not edit the customer ledger or expose a generic SQL command input.

Rollback is forward-only for schema. Disable the console first and keep schema
3 with its data/history. An old R1/Admin Worker is not a supported rollback for
independent R2 authority. Use a previously certified schema-3-compatible Worker
or leave Admin disabled. Customer application recovery is separately tested and
must not delete Admin tables or change customer migrations.
