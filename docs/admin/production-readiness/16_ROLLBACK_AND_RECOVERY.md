# Rollback and recovery

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

## Immediate containment

For suspected identity, disclosure, audit or binding failure, an authorized
operator should use the separately signed emergency-disable workflow to replace
the exact Admin target with the minimal denial Worker and verify protected
HTML/assets/API fail closed externally. A separately authorized incident action
may set ADMIN_CONSOLE_ENABLED=false on the exact ordinary runtime target when
that path is healthy; the prepared emergency lane is independent of its health. Revoke affected
sessions/identity and disable the Access policy/service binding as appropriate
under the incident plan. Preserve audit and release evidence; do not mutate
customer billing/data or delete authority history. This procedure is prepared;
actual flag propagation/shutdown time is not measured.

## Worker rollback

Record the prior certified schema-3-compatible Admin and facade versions before
release. Switch only to an explicitly compatible version after containment and
repeat negative/auth/customer health checks. A rollback to R1 is unsafe for R2
identity authority and schema semantics; leave Admin off if no compatible
version exists. Customer release recovery remains independent and must preserve
its current migration ledger. No customer release rollback is executed here.

## Schema and authority recovery

Keep additive migrations; do not drop/rewrite 0001-0003 or erase append-only
history. Backup restoration must be rehearsed on an isolated dedicated database,
with manifest, schema/integrity and audit checks, followed by session revocation
and operator/key freshness reconciliation. A stale backup can resurrect grants,
recovery allowances or revoked keys; never attach it live without a reviewed
reconciliation plan. Backup custody, retention, RPO/RTO and live restore adapter
are operator-owned prerequisites, currently unverified.

Offline break-glass is described in 08. Loss of one operator is handled with the
remaining distinct approvers where quorum is sufficient; severe roster loss
requires two independent current custodians and enrolled target through the
reviewed narrow adapter. No permanent emergency login is exposed.

## Source recovery

Local rescue refs retain broken R2 source. Full Git bundles preserve history and
implementation checkpoints; final bundle identity/hash is recorded in the
external output receipt so a bundle never claims to contain its own hash.
Verify bundle SHA256 and `git bundle verify`, clone into a new isolated folder,
select the exact source ref and compare source/migration manifest before any
work. Uncommitted/ignored local artifacts are not part of Git bundles; the
separate output evidence archive retains required local validation artifacts.
GitHub suspension makes the final checkpoints local-only until a successful
normal push is verified. No force push or history rewrite is required.

Actual staging backup, compatible release switch, customer regression and
emergency shutdown demonstration are OPEN (ST19/ST20).

The implemented emergency adapter replaces only the exact Admin target with an import-free denial Worker; it bypasses D1/facade/secret health dependencies and uses a separate protected workflow lane. rollback-disabled restores only signed certified compatible disabled versions after full live authority checks and compensates back to shutdown on failure. See 10 for exact controls. Actual remote propagation and restoration remain ST20 NOT RUN.
