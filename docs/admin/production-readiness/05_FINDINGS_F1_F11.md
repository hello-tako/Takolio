# Findings F1-F11

> Historical source-specific findings. The owner removed staffing/quorum requirements;
> current controls and live gates are in [19_SINGLE_OWNER_RELEASE.md](19_SINGLE_OWNER_RELEASE.md).

Runtime source: `9395f0e31ea599f1eb7780a8eba36964fed7c483`. Main baseline: `526596a8cd857984ad2b69901a8c7b0e9d6bccc2`.
Prepared by implementation owner `/root` (Codex); independent reviewer is
`/root/independent_admin_review`. Evidence environment: local macOS arm64,
Node v24.16.0, pnpm 10.33.2, Python 3.9.6, `TMPDIR=/private/tmp`.
Evidence timestamps are UTC. Commands, exit codes, log digests and limitations
are in `evidence/verification.json` and `12_REGRESSION_RESULTS.md`.
No live Cloudflare operation or operator approval is implied.

Canonical historical findings remain at `../handoff/SECURITY_FINDINGS.md`.
Historical reviewer reports and archived reproductions are retained unchanged.
This matrix supersedes their implementation status for the runtime source in
this packet; it does not rewrite historical findings as independently closed.

Common validation: `focused` command in `evidence/verification.json`; workerd,
migration matrix, browser and keyboard commands in 12. Fixed commit attribution
uses full immutable SHAs in `evidence/implementation-history.json`.

| ID | Original failing evidence | Fix / regression | Fixed commit | Current closure scope |
| --- | --- | --- | --- | --- |
| F1 | Historical R1C-B2/B3: customer binding + password/salt access | Admin binds only ADMIN_DB; named facade; capabilities and strict output. `admin-r2-facade.test.ts`, config tests and workerd HTTP/RPC topology | 50cdd740ca2d250b9160477251e2ff3c77fac3ba; hardened 3b75f20e3a6ab9c55c479dacc612eb483f6f4598 | Locally remediated; independent source review; real binding/exposure pending |
| F2 | Historical R1C-D2: unavailable second SUPER_ADMIN deadlocks grants | Three eligible operators, atomic minimum and audited offline recovery. Governance/race/recovery tests | 50cdd740ca2d250b9160477251e2ff3c77fac3ba; 53f4f4a0c14475fb411aa1a53ae90d09d87b5498; ba762a205fd890efe4af47ef6c0fd7cd6f45fc14 | Local review found and verified fixes; actual recovery ceremony pending |
| F3 | Historical design reproduction: two accounts can belong to one person | Approved-human roster and unique issuer/subject/operator enrollment, three-person bootstrap | 50cdd740ca2d250b9160477251e2ff3c77fac3ba | Schema constraints pass; real people and staging ceremony unverified, OPEN acceptance |
| F4 | Historical R1C-D1: precheck/batch authority race | Approver/requester/target durable checks, immutable request, same-issuer roster, target insert guard; 20-race regression + dedicated race suite | 50cdd740ca2d250b9160477251e2ff3c77fac3ba; 53f4f4a0c14475fb411aa1a53ae90d09d87b5498 | Independent local source/failure-injection verified; live D1 pending |
| F5 | Historical R1C-D3: partial bootstrap leaves grant without closure/audit | Single ceremony insert triggers all grants/marker/audit; injected audit failure rolls back | 50cdd740ca2d250b9160477251e2ff3c77fac3ba | Locally remediated and reviewed; staging ceremony pending |
| F6 | Historical R1C-C1: wrong passwords exhaust victim account budget | Client budget before local password verification; no victim-email allowance consumed; local auth compiled out remotely. `admin-r2-auth.test.ts` | 50cdd740ca2d250b9160477251e2ff3c77fac3ba | Positive/negative local checks; live Access/rate-store policy pending |
| F7 | Historical EXPLAIN: unbounded date/count source scans | Capped materialized indexed reads, per-operation limits and explicit 503 beyond source cap. `admin-r2-facade.test.ts` plan/oversize assertions | 3b75f20e3a6ab9c55c479dacc612eb483f6f4598 | Bounded local mitigation; original all-aggregate plans + representative D1 load/cost acceptance remain OPEN |
| F8 | Historical 6-run keyboard test: 2 failures | Eventual `expect.poll` on scroll offset; ten-repeat command | 3b75f20e3a6ab9c55c479dacc612eb483f6f4598 | Local regression verified; final results in 12 |
| F9 | Historical E2E modified tracked documentation PNGs | Generated screenshots under ignored `.hoplite/artifacts/admin-e2e`; tracked diff check | 3b75f20e3a6ab9c55c479dacc612eb483f6f4598 | Local regression verified; no tracked reference replacement |
| F10 | Historical R1C-A1: dot/colon IDs fail shell deep links | Shell/API ID contract aligned; traversal segments denied; `admin-r2-routing.test.ts` | 50cdd740ca2d250b9160477251e2ff3c77fac3ba | Local route controls and independent source review |
| F11 | Historical email-bound authority design | Independent ADMIN_DB binding requires exact issuer/subject, rejects mismatch; epoch revokes sessions | 50cdd740ca2d250b9160477251e2ff3c77fac3ba | Local positive/negative checks and review; actual tenant enrollment pending |

## Additional independently reproduced defects

Reviewer reproduced a three-to-two revocation causing production-policy access
loss and a target enrollment revocation between request and commit. Fix
`53f4f4a0c14475fb411aa1a53ae90d09d87b5498` adds migration 0003 and regressions.
A later review found that safe cleanup of an already-ineligible fourth operator
was also blocked; `ba762a205fd890efe4af47ef6c0fd7cd6f45fc14` corrects remaining
eligible-operator counts. Reviewer ran 12 production-policy scenarios, including
both cleanup paths and denied grant races. See 13 and its machine-readable
artifact. The final UI-only commit corrects minimum-roster copy and the blocked
control assertion.

No new failing historical pre-fix run was fabricated. Older reproductions are
historical evidence at their stated SHAs; current regressions test the inverse.
All F1-F11 are not independently closed to production acceptance: F3/F7 and live
criteria remain explicitly open.
