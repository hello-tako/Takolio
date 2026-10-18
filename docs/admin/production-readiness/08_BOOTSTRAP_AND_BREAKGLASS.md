# Bootstrap and break-glass

> Historical schema-3/source-specific snapshot. Staffing, signing, release operations
> and current blockers are superseded by [19_SINGLE_OWNER_RELEASE.md](19_SINGLE_OWNER_RELEASE.md).
> Retained receipts are not current-source or live deployment evidence.

Runtime source: `9395f0e31ea599f1eb7780a8eba36964fed7c483`. Main baseline: `526596a8cd857984ad2b69901a8c7b0e9d6bccc2`.
Prepared by implementation owner `/root` (Codex); independent reviewer is
`/root/independent_admin_review`. Evidence environment: local macOS arm64,
Node v24.16.0, pnpm 10.33.2, Python 3.9.6, `TMPDIR=/private/tmp`.
Evidence timestamps are UTC. Commands, exit codes, log digests and limitations
are in `evidence/verification.json` and `12_REGRESSION_RESULTS.md`.
No live Cloudflare operation or operator approval is implied.

## Ceremony prepared for authorized staging

1. Owner verifies three independent humans and their approved Access issuer and
   subjects; record durable independent approval references outside public Git.
2. Record target environment/database identity and exact reviewed source and
   migration manifest. Confirm the authority database is empty for first setup.
3. Enroll approved-human records and one immutable binding per operator using a
   separately reviewed privileged adapter; do not infer human independence from
   email or subject count alone.
4. Submit one `admin_bootstrap_ceremonies` insert for exactly three enrolled user
   IDs. Its trigger writes all three SUPER_ADMIN assignments, completion marker
   and mandatory audit atomically. Any failure rolls back the entire statement.
5. Verify the three independent Access logins, no client local-password authority,
   negative duplicate/subject tests, and the audit/closure record. Keep flag off
   until the rest of the staged release gates permit enabling it.

Local provisioning/fixtures are for local development only. They must not be
used as a remote enrollment adapter. No real ceremony was executed.

## Privileged operation lifecycle

A SUPER_ADMIN grant or revocation creates an immutable, expiring operation.
Requester, target and approver cannot bypass human separation. At decision,
active enrollment, issuer and roles are rechecked by the durable batch/triggers.
Replay, stale approval and authority changes return conflict without a successful
grant/audit. At least three eligible same-issuer operators must remain on normal
revocation, including when cleaning up an already-ineligible assignment.

## Offline recovery procedure

`scripts/admin-recovery.mjs` verifies a versioned exact-source/database manifest,
maximum one-hour validity, two distinct active Ed25519 custodians and two distinct
keys. The target must be independently enrolled and distinct from those
custodians. It creates a new private output SQL file exclusively; it never sends
SQL to a database. CLI: `node scripts/admin-recovery.mjs MANIFEST APPROVALS
TRUSTED_ROSTER EXACT_SHA DATABASE_ID OUTPUT_SQL`.

The trusted roster must come from an independently verified authority snapshot,
not a caller-controlled replacement. Signatures cover canonical manifest bytes.
A reviewed live adapter must independently confirm source/environment/database,
roster/key freshness and approvals, consume only this narrow insert, and record
the execution artifact. Database triggers recheck current roster/keys/identity,
expiry and one-time ID/hash, grant only SUPER_ADMIN to the enrolled target,
append `admin.breakglass` and revoke target sessions atomically. No public API
executes recovery and no permanent bypass is added.

Offline tests cover tampered source/database/expiry/signatures, duplicate
custodians/keys, replay and injected audit rollback. Real key custody, roster
verification and real staging execution are OPEN; local adapter review is recorded in 13. Two entries in
GitHub's reviewer list do not prove two approvals.
