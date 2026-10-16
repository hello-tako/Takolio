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
