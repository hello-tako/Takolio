# Source authority

Verified via GitHub API repositories/1385308553 on 2026-10-17 (Asia/Tokyo): public repository lol-vn/Tako-san, default branch main.

- Main: 526596a8cd857984ad2b69901a8c7b0e9d6bccc2.
- PR #77: OPEN, DRAFT, MERGEABLE; handoff/admin-v1-r2-20261015 at cc1267e719b4af38325a20290382481e86f67a05.
- New implementation branch starts at that PR head. Main is an ancestor of the handoff. Customer and accepted Takolio changes are already included.
- R2 source: 87d6d3d2acc69a6ca3f0409c3c22753469807222 through 8d08c787d11994d974dc083c9695fcf0fe2474e3 (19 intervening commits).
- Local rescue refs: rescue/admin-r2-8d08c787, rescue/admin-r2-start-87d6d3d.
- Verified complete Git bundle: ../recovery/admin-r2-source.bundle with ../recovery/SHA256SUMS outside the repository. Local persistence only.
- R2 stash 7acadce3ad76ca58e88375665537538b7d957584 is unavailable locally and returns GitHub HTTP422. At recovery startup, eight documented modules were absent from recovered commit trees and local filesystem search. Their contracts and the additional adapters/fixtures were subsequently reconstructed; this observation records the historical loss, not a current missing-import claim.
- Newer remote brand receipt docs/takolio-production-receipt-20261016 at 7eb2cc6ad1589ff959d89e4dfa462f4987b67dcb is preserved remotely and read as context; no customer code transplant required.

Existing unrelated dirty local checkouts were left untouched. Work uses an isolated clone with no hardlinks. API snapshots and baseline logs are in ../recovery (private local evidence).

## Observed release protection gaps

Main requires validate, strict up-to-date checks, no force pushes/deletions, and enforces admins. Required approving review count is zero; stale approvals are not dismissed. Production Environment has one reviewer with prevent_self_review=false and no branch restriction. Staging has no protection rules. Repository workflow token defaults to read and cannot approve PRs. These observations are blockers, not permission to alter protection.

No production or real staging operation is authorized. No deployment, remote D1, secrets change, merge, or approval is performed.

## Historical local runtime checkpoint (066c35ad)

Frozen runtime source: `066c35ad670bc877756150c2055e3844dd7a17ce`; tree `341df1dd57e1034890007b3fec9a22c020fbadfb`.
Last verified remote branch source is ba762a205fd890efe4af47ef6c0fd7cd6f45fc14;
UI and CI fixture repair checkpoints are local-only. Source identity refresh
(`gh api repositories/1385308553`) and `git fetch origin` now fail with HTTP 403
and account-suspended responses. An unauthenticated public identity lookup returned
404. These failures do not prove a rename or new repository identity. Latest
GitHub refs, PR state/protection and hosted CI cannot be refreshed. Codex review
connector also requests GitHub sign-in. No prior R1 CI is relabeled as R2 evidence.

The final packet's source and migration manifest is in evidence/release-plan.json.
Its declared mode remains offline-plan-only and readyForDeployment=false.
Documentation packaging is a later commit whose runtime manifest is compared
byte-for-byte; only the stated frozen runtime SHA has full local test evidence.
Timestamp: 2026-10-16T20:59:47.897729+00:00.

Current local source `9395f0e31ea599f1eb7780a8eba36964fed7c483` supersedes the runtime evidence anchor for the final delivery.
The previous full verification remains preserved under evidence/historical-066c35ad.
GitHub identity/refs and PR #82 remain last-verified only; no new remote claim is made.
