# ADR PRODUCT-001: Dormant VNext family collaboration policy

Offline candidate only; no existing household policy or route changes.
Roles owner/editor/viewer must be loaded from server membership. Viewer reads,
editor manages stock/plans/shopping, owner alone changes roles. Revoked or foreign
membership denies every action. Any actor can see only the authorized household;
normal membership never grants enrichment-global authoring. Adoption into runtime
requires independently approved role schema/migration and UI acceptance.

# ADR PRODUCT-002: Dormant notification digest

Offline consent-aware scheduling; no emails/push or cron registration. Opt-in,
IANA timezone and local-day delivery key control one digest/day even across DST.
Quiet interval suppresses emission. Receipt dedupe remains durable when activated;
mock pure scheduling cannot certify actual delivery. Owner must approve channel,
quiet-hour and retention semantics before storage/runtime work.

# ADR PRODUCT-003: Evidence-bound local purchase units

Only explicit ingredient-bound package contents may convert purchase count to
mass/volume. Unknown package size never means one gram or zero demand. Use integer
milli quantities and deterministic ceil rounding; retain package leftovers separate
from demand. No new inventory writer or SKU authority is introduced.

# ADR PRODUCT-004: Enrichment admin

Catalog review is separate from household membership. Explicit global reviewer
capability, immutable source release, decision/evidence reference and expected
revision are mandatory. Preview cannot issue runtime authority or data certificates.
Human source/license/nutrition decisions remain PENDING_EXTERNAL_EVIDENCE.

# ADR PRODUCT-005: Trial/subscription lifecycle

Offline projection of existing paid entitlement and explicit trial evidence.
Trial requires owner-approved start/end/policy/eligibility; absent/expired evidence
never grants Plus. Paid authority remains signed payment ledger; candidate does
not write subscription, modify quotas or automate refunds. Repeated trial IDs do
not reset the window. Business duration/reuse policy remains externally pending.

# ADR PRODUCT-006: Privacy analytics

Allowlisted event categories and count buckets only; no user/email/path/cookie/
stock/image/provider/payment payload. Consent is explicit and absent consent
suppresses collection. No collector, account identifier or remote transport here.
Retention/window/access/minimum cohort are decisions before activation; offline
aggregate function refuses small cohorts rather than inventing anonymity.

Each candidate's user-visible acceptance is described by its behavioral tests.
Local cost is zero external calls; no release latency/SLO is certified. All six
activation decisions are PENDING_EXTERNAL_EVIDENCE, independent from offline code.
