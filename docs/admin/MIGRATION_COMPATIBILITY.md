> Current schema is 4 (migration 0004). See production-readiness/19_SINGLE_OWNER_RELEASE.md.

# Admin migration and compatibility - R2

Current authority: [production-readiness/09_DATABASE_MIGRATIONS.md](production-readiness/09_DATABASE_MIGRATIONS.md)
and its exact [migration matrix](production-readiness/evidence/migration-matrix.json).
Runtime source: `066c35ad670bc877756150c2055e3844dd7a17ce`.

Admin schema version is 3, applied from migrations-admin/0001, 0002 and 0003.
0001 is retained unchanged; later migrations add independent human identity,
Access enrollment, bootstrap/recovery and durable governance guards. The customer
43-file ledger is identical to main baseline 526596a8cd857984ad2b69901a8c7b0e9d6bccc2.
The withdrawn original customer Admin migration is historical only; it must not
be restored or added to the customer release allowlist.

Local migration smoke and actual local Wrangler D1 matrix cover fresh apply,
R1 -> R2 upgrade/replay, partial apply rollback, strict ledger drift and schema
mismatch. Full commands/results/timestamps/digests are in production-readiness/12.
No remote ledger is queried. Schema changes are forward-only; R1 binary rollback
is not certified for R2 authority. Disable Admin and use a previously certified
schema-4-compatible Worker; preserve grants/audit and current customer ledger.
Actual backup/restore, compatible rollback and staging rehearsal remain blocked.
