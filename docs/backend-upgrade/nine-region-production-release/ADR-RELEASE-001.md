# ADR-RELEASE-001: Deploy verified improvements with unaccepted candidates dormant

Accepted for this release preparation, 2026-10-12. User authorizes production
upgrade. Offline evidence still cannot certify external providers or financial
policy. Do not activate such candidates by implicitly treating release permission
as missing provider, retention, human-label or independent-review evidence.

Expose an authenticated boolean checkout capability, default false for absent
older-server fields. A new optional Worker var requires exact true; keyed POST
fails closed when disabled and candidate recovery GETs are unavailable. No-key
creation and webhook authority retain their existing behavior. UI only loads
recovery/sends stable keys/freezes the offer when the server advertises acceptance.
The flag is absent from both existing deployment configs and is not enabled here.

0041 is additive with no backfill, drops, rewrites or financial data mutation.
Apply via exact target/ledger/bookmark/constraints checks before new schema-gated
application deployment. Old Worker may continue on expanded schema. Keep all
receipt tables on rollback. This is schema availability, not checkout activation.
Recognize 0041 as a reviewed post-media-preservation tip; actual hero metadata,
active hero coverage and catalog fingerprint checks continue to reject drift.

Preserve the new scanner workflow as a candidate artifact outside executable
GitHub workflows until independent policy promotion. Existing live security,
branch protection and production deployment policies are unchanged. Scanner
candidate selftests retain permissions/pins/trusted-base/redaction assertions.
No failed security job is suppressed or reported as PASS.

Consequences: production gains verified fixes and additive readiness while the
nine external acceptance rows remain open. New checkout/security activation
requires its own concrete acceptance and release decision. AI budget/OTP/payment
testing restrictions remain unchanged. No phantom PASS, retention policy, human
review or seven-day SLO certification is asserted.
