# Integrated release completed - 2026-10-12 JST

Status: PRODUCTION_VERIFIED_WITH_EXTERNAL_ACCEPTANCE_OPEN.
Backend integration and complete Brand V3 are merged in hello-tako/Tako-san
(ID 1385308553) through PR66/67/68. Production serves source `0c0f9933dcd1af2296d8033709ea3bf5ceec30f2` at
https://frigo.tungjpstore.net. Main CI 38208731783 and protected production deploy
38209910253 succeeded. Actual reviewer vn-taphoanhatung approved migration and deploy;
protection settings were preserved. Migration 0040 ran once from 6bc1fe96; the schema
is unchanged in 0c0f9933. D1 ledger 40, integrity/constraints and 500-recipe authority
are verified. Normal 100% Worker and inactive strict-OTP recovery are recorded.

Latest full local/hosted suite: 320 files / 7650 tests PASS. Integration evidence includes
94 isolated E2E and 198 responsive screenshots; these retain their recorded build SHAs.
Final staging/production rendering smoke: 30 checks each, browser/public/PWA scope.
Production 11 observations over 301.163 seconds pass exact-SHA,
DB/queue/catalog/config checks; runtime reports degraded only for the deliberate
D1 authority warning. This is bounded verification, not a seven-day SLO.
Production WebKit external Turnstile frame errors are preserved and live auth
acceptance remains open. Earlier WebKit image/empty-content failures and harness
errors remain recorded, with direct controls; their intermittent cause is unconfirmed.

Full dependency graph audit: 0 advisories. Final pinned source-delta scanners: 0 findings;
full-source Gitleaks raw 17 remain context-adjudicated with 0 unresolved, not raw 0.
Paid AI/provider activation, real inbox delivery, independent OCR/data/ingredient
quality, physical device/browser-floor, protected payment/billing and operational
load/chaos/SLO acceptance remain open. Synthetic invoices/fridge images stay
TEST_ONLY; dormant provider/V3 writer/Ingredient V2 candidates remain unpromoted.

Use [release result](../final-local-completion/RESULT.md),
[receipt](../final-local-completion/release-receipt.json) and
[remaining inputs](../final-local-completion/OPEN_ACCEPTANCE.md) as the current release
state. The following checkpoint is historical; its security/remote-release status
is superseded by this verified integrated release, while its independent data and
provider limits remain applicable.

---

# Backend program local result - 2026-10-12 JST

Status: LOCAL_IMPLEMENTATION_VERIFIED_WITH_BLOCKING_SECURITY_AND_EXTERNAL_GATES.
Implementation `7ef2f8407d3a6a958c78146db3b5c9a9f0990b78`, branch `codex/backend-program-20261011`.
The implementation and this evidence checkpoint are separate commits. Existing
B00/B01b/B01a receipts and the attached masterplan remain immutable.

The authorized local sequence delivers stronger household/session guards, truthful
offline ScanV3 contracts/evaluation, injectable governed provider controls, durable
scan cancellation, a dormant exact budget kernel, evidence-bound ingredient review
and pilot preparation, whole-week/shopping/cooking fixes, Week read extraction with
parity, an OpenAPI candidate, bounded telemetry and an executable security candidate.
See [packet matrix](STATUS.md) for exact activation limits and pending gates.

Final full **309 files / 7463 tests PASS** on the clean implementation commit.
Required lint, TypeScript,40-migration smoke and sequential build PASS. Independent
local D1 replay has exact40 ledger entries, no reapplication/pending/schema/FK issues,
quick_checkok and all six OTP tables. Matched independent frozen builds yield
387 byte-identical web assets.50 source and30 candidate inputs match implementation
Git blobs;1847 other source files match baseline blobs and executable bits.

First full execution retained62 failed payment tests: the old session fixture had
no household/member rows under the new current-membership guard. Only6 setup lines
were added, restoring126 focused auth/payment tests; every148 expect call and all
other bytes remain unchanged. A later full run was interrupted (exit130) after
Vitest discovered309 copied tests in each of three private scanner snapshots.
Snapshot bytes were preserved outside the project; the runner now creates its
private snapshot outside the project from the outset, and exact discovery confirms
only309 intended test files before the final passing run. No billing handler or assertion was changed. All
other development failures and recoveries are preserved in the validation packet.

Security is still **BLOCKED**. Fresh committed-source audits:2critical/16high/
19moderate/4low in the full graph;2moderate production. Actual pinned engine
selftests24 PASS; repository scan has16 unreviewed Gitleaks candidates,72 zizmor
workflow findings and1 Semgrep parser error. Syft inventories786 declared library
components. The new candidate workflow independently passes local zizmor and strict
synthetic audit validation; it is not enabled and has not run on hosted Ubuntu.
Raw security reports/snapshots remain private; only bounded metadata is exported.
A changed documentation commit requires another current-source scan for release.

Real OCR assets/labels/licensing, human ingredient/conversion/nutrition evidence,
complete trusted provider token/output/pricing/retention proofs, controlled inbox,
staging/load/SLO/rollback and the protected billing task are outstanding. No remote
D1/R2 write, deploy, paid AI, actual mail, push, PR or merge was performed. Local
verification does not certify data quality, security, staging or production.

- [Exact commands and evidence](LOCAL_VALIDATION.md)
- [Machine validation receipt](validation.json)
- [Source and protected hashes](source-freeze-final.json)
- [Ordered remaining work](NEXT_ACTIONS.md)

Verify the packet from the canonical repository root:

```bash
python3 docs/backend-upgrade/program-20261011/verify_packet.py --committed
```
