# Nine-region production rollout - 2026-10-12

Status: RELEASE_PREPARATION. User explicitly authorizes production upgrade after
receiving the offline completion status. This authorizes protected push/PR/merge,
staging, additive 0041 production migration and application deployment. Real OTP,
paid AI, live payment testing and unrelated feature activation remain unauthorized.
AI test expenditure ceiling: USD 0.

## Release scope

Ship Turnstile lifecycle/loader fixes, concrete auth/provider/queue types and
validated billing responses. Add expand-only 0041 schema and dormant checkout
admission implementation. Keep the current no-key checkout, PayOS signatures,
prices, pending-only grants, strict OTP, stock commands and complete D1 catalog.

New checkout admission is OFF by default. Only exact Worker opt-in
CHECKOUT_ADMISSION_ENABLED=true advertises the authenticated capability and admits
keyed requests. This release does not set that var. The UI uses the existing
no-key flow when capability is false or missing. The candidate cannot silently
fall back to legacy creation when a keyed request arrives while disabled.
PayOS sandbox/retention/refund/operator-resolution acceptance remains
PENDING_EXTERNAL_EVIDENCE before enabling this feature.

The security workflow remains a preserved YAML candidate under the offline packet,
outside .github/workflows. No hosted scanner adjudication, independent review or
policy promotion is claimed. Restore it through a separately reviewed policy
promotion; its trusted-base fail-closed design is unchanged. Existing required
validate/protection/Environment gates remain intact.

AI V3/provider switches, Ingredient V2 promotion, Product VNext, collectors and
notification/trial/analytics activation remain dormant. Existing planner and T20
paired flags remain true, catalog d1/cutover true/canary 0 remain unchanged.

## Execution sequence

1. Review baseline/current diff, validate dormant capability boundaries and
   expand-only migration/old-worker compatibility. Preserve applied 0040 bytes.
2. Run full local lint/typecheck/tests/41-migration/build plus browser default-off
   and mock opt-in journeys. Run source scanner/audit checks retaining raw findings.
3. Push release branch, create normal PR, wait exact-head CI, merge without
   bypass, wait exact-main CI. Never alter branch protections.
4. Apply only 0041 to staging via dedicated identity/ledger/bookmark/exact-main
   workflow. Verify constraints, FK/quick_check and aggregate preservation.
5. Deploy exact main to staging retaining catalog/T20 flags and run public
   read-only SHA/PWA/branding/auth-guard checks.
6. Dispatch protected production D1 migration 0040 -> 0041, inspect actual
   Environment approval and sanitized bookmark/ledger/schema/catalog evidence.
7. Dispatch exact-SHA production deployment through separate Environment approval.
   Verify active 100% Worker, exact SHA, D1/catalog/schema, public/PWA smoke and
   bounded health observations. Existing compatible-worker rollback stays active;
   do not down-migrate or delete receipts.
8. Record actual results/failures/source/run identities in rollout receipt and
   state docs. Missing evidence remains pending; local success is not live rollout.

Production approvals are required by the configured GitHub Environment reviewer
vn-taphoanhatung. The CLI currently uses hello-tako; no bypass or reviewer change.
