# ADR-RELEASE-001: Deploy verified improvements with unaccepted candidates dormant

Accepted for the separately authorized production upgrade, 2026-10-12. Offline
evidence cannot certify external providers or financial policy. Release permission
does not supply missing provider, retention, human-label or independent-review
receipts. See EXTERNAL_ACCEPTANCE.md for the nine open regions.

Expose an authenticated boolean checkout capability, default false for absent
older-server fields. A new optional Worker var requires exact true; keyed POST
fails closed when disabled and candidate recovery GETs are unavailable. No-key
creation and webhook authority retain their existing behavior. UI only loads
recovery, sends stable keys and freezes the offer when the server advertises
acceptance. The flag is absent from both deployment configs and is not set by
this deployment. Authenticated live checkout acceptance is not certified.

0041 is additive with no backfill, drops, rewrites or financial data mutation.
Apply through exact target/ledger/bookmark/constraints checks before schema-gated
application deployment. Old Worker may continue on expanded schema. Keep receipt
tables on code rollback. Schema availability does not activate checkout. Recognize
0041 as a reviewed post-media-preservation tip; active hero metadata, coverage
and catalog fingerprints still reject drift. Never reapply or rewrite 0040.

Preserve the scanner workflow as a candidate outside executable GitHub workflows
until independent policy promotion. Existing live security, branch protection and
production deployment policies are unchanged. Candidate selftests retain pins,
permissions, trusted-base and redaction assertions. Raw Gitleaks findings/status
remain recorded even when exact local contexts have no unresolved match.

Actual rollout: PR69 merged, exact main d63321af CI and staging0041/deploy/public
smoke PASS. Production migration38235082984 and deploy38236084633 SUCCESS after
actual vn-taphoanhatung approvals. Canonical D1 ledger41, active Worker/paired
T20/catalog500/exact fingerprint/assets verified. Protections unchanged.
Public production smoke PASS30; bounded monitoring is recorded separately in
rollout-receipt.json. The captured strict-compatible previous Worker is a recovery
target; no actual rollback rehearsal or data restore is claimed.

Consequences: production receives verified fixes and additive readiness while all
nine real acceptance rows remain PENDING_EXTERNAL_EVIDENCE. Checkout/scanner,
AI/provider/V3 writer, Ingredient V2 and Product VNext activation each require
concrete missing acceptance and a separate decision. AI test budgetUSD0 and
no real OTP/live payment testing remain. No seven-day SLO is inferred from a
bounded monitor. Failed local/network attempts are preserved without being PASS.

## Concurrent PayOS integration

After the verified deployment, main was observed at
4fb7c40d01769f0d8d8d043fac0c799b435b3e3e. The user confirmed that another thread
owns the ongoing PayOS/payment integration. This packet certifies only the
released source d63321af13d81a20a3f19f12969030fe353376b9 and its recorded workflows;
it does not certify the concurrent integration or later main revisions.

Save these receipts on the separate documentation branch
codex/nine-region-release-receipt. Do not merge, rebase, deploy or change payment
configuration as part of this receipt checkpoint. The PayOS owner can incorporate
the historical release evidence without treating its dormant checkout candidate
as accepted or inheriting CI/release certification for a different SHA.
