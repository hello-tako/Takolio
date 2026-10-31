# ADR-TAKOLIO-004: reject poisoned static cache and tolerate transient audit reads - 2026-10-26 JST

**Status:** accepted narrow release repair. Production Chrome reproduced module MIME failures; Cache Storage contained four JavaScript URLs with `text/html` in the f5895354 cache after same-SHA ON/OFF recovery. Current network assets are valid JavaScript. Production observation 40238763799 also failed on Cloudflare HTTP500/code10500 page2; recovery equality falsely rejected reordered custom domains. Read-only audit40239761525 confirmed identical domain membership/content.

**Decision:** validate JavaScript/CSS MIME before serving or storing static cache responses; refetch invalid cache entries and replace only with valid content. Preserve release cache naming, activation/client refresh, origin bypass, navigation and offline data. Bound retries to three attempts for transient HTTP read failures only (including the fixed read-only ledger query); retain pagination completeness and sanitized errors. Compare domain/DNS/route inventories by sorted stable identity while retaining every entry, duplicate and full projected metadata. Worker/operational/ledger comparisons remain strict.

**Compatibility:** no schema, application API, authentication, payment, dependency or infrastructure configuration changes. Existing clients receive a new release cache; poisoned entries can also recover within one cache. Invalid offline JavaScript fails rather than executing HTML. Mutation requests are never retried. Same-SHA production catalog continuity remains deliberately strict; deploy a new reviewed SHA through normal CI/staging/certification/Environment review.

**Verification:** runtime fetch-handler regression, transient-page retry/exhaustion/privacy cases and order/duplicate/content drift cases required, followed by full repository gates. Hosted release and production recovery remain pending until recorded separately. Original Argon checkout and private backup remain preserved.

---

# ADR-TAKOLIO-003: render the reviewed 3D candidate as lightweight illustrations - 2026-10-16 JST

**Status:** accepted implementation scope after operator feedback on the genuine Blender candidate. Design acceptance is provisional; premium production approval, concept fidelity and legal clearance are not asserted.

**Decision:** keep the kit's outlined logos, UI icons, PWA/store-prep icons and vector mascot URLs intact. Add six transparent static 3D renders from one procedural Blender master, with state-specific expressions/props, to the single Takolio contract. A presentation component selects responsive raster variants for illustrations >=96 CSS px and retains the existing SVG as an unsupported-format/network fallback. Small uses remain vector. Do not ship a WebGL engine or the high-detail GLB/native file to browsers.

**Adoption:** public landing, login/register presentation, three onboarding steps, unplanned Home and generic non-error EmptyState illustrations. Keep layouts/task actions compact, preserve all callbacks/conditions, and leave protected Plus/payment mascot pointers unchanged. AuthShell changes are decorative markup only; AuthPage, credential/session/OTP/Google logic and Worker are outside scope. Existing logo correction remains authoritative.

**Source/recovery:** procedural construction and pose scripts plus hashed 2048px PNG masters/provenance live in the versioned brand source directory. Native Blender/GLB remain local handoff outputs. The normal pinned Sharp generator creates web variants offline; Blender rendering is an explicit authoring step, not a CI/network dependency. Precache only the preferred raster variants; retain vector/old asset paths and the existing release-aware cache lifecycle. A reviewed follow-up can remove illustration consumers while retaining generated paths for installed clients.

**Limits:** starter rig/weights and facial controls still need production polish. Rendered poses are candidate illustrations, not certification of a complete production animation system. Physical-device, premium finishing and legal/trademark gates remain open.

# ADR-TAKOLIO-002: show the product name throughout the kitchen shell - 2026-10-16 JST

**Status:** accepted corrective presentation change; supersedes the small-header micro-symbol choice in ADR-TAKOLIO-001. The operator reported that Home, Recipes, Planner Setup and Shopping lack the visible Takolio name while entry/onboarding show it. An accessible name alone does not provide visual brand recognition.

**Decision:** reuse the canonical outlined horizontal master at 180 CSS px in the shared kitchen header. For a back-arrow header below 375px, use the existing wordmark at 120px to fit the back, notification and scan controls without shrinking 44px targets. The 640-1023px tablet header retains the horizontal logo while the narrow rail keeps its symbol. At >=1024px the existing 168px rail wordmark owns the name and the header retains its motto. Preserve the master composition, intrinsic aspect ratio and built-in clearspace; no new glyph, asset crop, live-text wordmark or global compactLogo remapping.

**Compatibility:** presentation and its tests only. Existing routes, control destinations, symbols in immersive contexts and dynamically measured sticky-header behavior remain. The shared header also appears on protected Plus chrome: verify its inherited layout without editing payment source or behavior. No new runtime assets, generator, token, auth, business-rule, API, database, flag, workflow or production changes.

**Fidelity limits:** the kit explicitly identifies its Comfortaa-derived glyph outlines as a candidate pending official glyph finishing and its mascot as 2D gradient pending premium 3D finishing. A completed migration/test suite is not 100% concept-board, legal or owner design approval. Reference boards remain visual references only. The kit logo usage document remains the source for variant, clearspace and minimum-size decisions.

---

# ADR-TAKOLIO-001: versioned identity with protected compatibility - 2026-10-16 JST

**Status:** implemented locally; publication/release requires review. Mission `TAKOLIO-BRAND-MIGRATION-V1`.

**Problem:** Takosan V3 contract and asset URLs feed many product screens plus protected payment consumers. A global rename would break persisted/technical identities or change protected systems.

**Decision:** add `/takolio/v1` source/runtime line and one canonical `TAKOLIO_BRAND`; re-export through legacy modules, preserve `.takosan-rebuild`, old asset trees and cache build/lifecycle identifiers. Keep root semantics and payment code byte-identical. Only product-copy literals and scoped presentation change. Two auth fallback literals change without auth behavior edits.

**Kit adaptations:** retain supplied vector wordmark geometry (Comfortaa OFL notice retained as source provenance); UI/heading fonts are Plus Jakarta Sans/Nunito. Outline the kit's live text from pinned legal Plus Jakarta Sans masters. Use compact micro symbols in small headers and wordmark on desktop rail because tagline lockups are unreadable at header sizes. Rebuild true one-ink silhouettes with face knockouts; reverse only navy text, preserving mascot detail. Do not crop reference boards. Supplied art is 2D gradient; premium 3D finishing remains pending. These choices are documented source adaptations, not claims of visual or legal approval.

**Accessibility:** semantic navy CTA and derived green `#276F3F` preserve white text AA. Raw coral/green remain brand accents. Focus/error/warning and root payment semantics stay authoritative. Keep existing router/components and 44px target authority.

**Consequences:** protected payment/Worker strings (25 literal/template locations) remain DEFER. V3 clients keep valid URLs. No schema/data/flag/domain change is needed. Rollback is a reviewed code/metadata revert retaining both asset trees; normal SW build-ID lifecycle advances on separately approved release. See `docs/brand/takolio/v1/` for receipts and exclusions.

# ADR-063 - Compact kitchen presentation and progressive setup (T27)

Date: 2026-10-15. Status: Accepted for local implementation.

## Context

The product's 40-44px page headings, large repeated panels and two-row mobile
header use too much of a small screen. Planner setup exposes saved preferences
and secondary instructions before the main action. Reducing the root font size
would also shrink controls, touch targets and safety information.

## Decision

Use `data-kitchen-density="compact"` on existing kitchen app routes, excluding
`/plus`, and a final scoped `kitchen-density.css` layer. Standalone onboarding
uses its existing page scope. Keep the established Nunito/green/cream identity.
Page titles use 22-28px, sections 18px, card titles 15-16px and UI body 14-15px.
Editable text stays 16px and action hit areas stay at least 44px. The mobile scan
action keeps its accessible name in the existing dynamically measured header.
Narrow dish rows give the dish name a full line before the actions.

Show saved family habits as an editable summary; first-time setup remains open.
Applied allergies and forbidden ingredients remain visible outside the disclosure.
Keep automatic whole-meal and explicit manual-calendar paths distinct. Use task
headings and shorter Vietnamese copy. Saved-recipe empty/search states expose a
next action. Mobile shopping prioritizes its purchase list and puts manual entry
in a labelled native disclosure; desktop keeps that form open by default.

## Compatibility and limits

This changes presentation and local disclosure state only. Existing routes,
commands, quantities, constraints, private favorites, shopping review/recovery,
planner deadlines and Week compatibility remain authoritative. No API, database,
migration, flag, dependency, payment or deployment change is introduced. Native
keyboard disclosure behavior, zoom/reflow, accessibility and small-screen layout
must be checked in the actual app. Local synthetic browser checks do not certify
hosted signed-in behavior, native iOS behavior or real-user retention.

---

# Nine-region production release preparation - 2026-10-12 JST

**Task/status:** RELEASE_PREPARATION. Active packet
../backend-upgrade/nine-region-production-release/PLAN.md. User separately
requests production upgrade; protected release/migration authorized. OTP/provider
paid tests remain unauthorized, AI budget USD0. Offline checkpoints0407011d/d8699437
remain preserved. Release branch codex/nine-region-production-release.

**Changes:** Checkout admission has a default-off exact Worker capability;
UI preserves no-key legacy checkout while disabled, keyed requests fail closed.
Recovery reads are disabled without opt-in. PayOS signatures/prices/pending-only
grants unchanged. Scanner workflow moved to a preserved non-executable YAML
candidate pending independent promotion, no protection/check bypass. Added staging
0041 identity/exact-main/ledger/bookmark/constraint certification workflow. Extended
production0041 exact-main/constraint checks and explicit post-media tip without
relaxing catalog/media integrity. 0040 bytes/config/dependencies/deploy unchanged.
See ADR-RELEASE-001 in the release packet.

**Checks/failures:** Verification in progress. First focused run235behavior tests
PASS but new workflow-test quote syntax failed; first fullcheck failed generic
Zod input/output inference. Both fixes applied; new complete gates in progress.
No current-SHA PASS or new live deployment claimed yet. All old receipts retained.

**Database/deployment:** Production last separately verified0c0f9933/ledger40.
0041 rollout must precede app deploy and preserve old-worker coexistence; no
remote mutation/new release executed yet. Environment reviewer vn-taphoanhatung
required; CLI hello-tako. Never change protections or reapply0040.

**Next/limits:** Finish local gates/browser/scanners, protected PR/exact-main CI,
staging0041/deploy/smoke, production0041 and deploy with separate Environment
approvals, then receipt/monitor. All nine external acceptance rows remain
PENDING_EXTERNAL_EVIDENCE; checkout/security/AI/data/VNext remain dormant as
specified. No real OTP, paid AI or live payment testing. Original checkout
preserved. Historical entries below remain immutable.

**Local verification:** pnpm check PASS: 330 files / 7705 tests,166.03s;
lint/both TypeScript projects/41-migration replay/build PASS. Remote gates
explicitly skipped. Focused migration checks18/18 PASS. Full/prod dependency
audits0. Source scan4865 files: Semgrep/zizmor0; Syft504 declaredcomponents;
Gitleaks raw17/exit1 retained, exact-context17matched/0unresolved. Eleven
protected appliedmigration/provider/grant/price/config/lock/deploy paths exact.
All four baseline failure logs retained: plan-capability expectation, quote
syntax, Zod inference and exact workflow migration-list expectation. Browser
attempts preserve port collision, dev-preview empty document and service-worker
interception bypass/401; final mock tests explicitly block service workers.
Public PWA remains a separate deployed check; no actual OTP/provider/payment call.

**Release scope/next:** checkout admission default OFF and scanner workflow
non-executable candidate; real acceptance remains PENDING_EXTERNAL_EVIDENCE.
Push normal PR and wait exact-head then exact-main CI; staging0041/deploy/smoke
before protected production0041/deploy/monitor. No production mutation yet.


Final local browser acceptance PASS in both modes: Chromium/Firefox/WebKit at
320/1440,12 cases/24screenshots, zero stable axe/overflow/broken/page-errors or
external requests. Default-off calls no recovery API or idempotency header;
opt-in keeps key/reload replacement fence/GET resume. Actual new checkout remains
OFF in staging/production configs. Stable enabled-button opacity resolved the
transient WebKit contrast capture; failed evidence remains retained.

---

# Nine-region local decisions (2026-10-12)

ADR-OFFLINE-001 is accepted solely under the user's explicit nine-region request,
which authorizes bounded checkout/billing work despite AGENTS protection. Latest
instruction restricts execution to offline/mock/synthetic, AI budgetUSD0 and separate
approval for real OTP/paidAI/production. No prior production authorization overrides
that restriction. Expand-only0041/key-admission does not change ADR029 pending-only
signed grant policy, prices or PayOS signatures/provider. The client freezes plan
and key after dispatch; ready order/reload cannot silently create replacement.
No automatic cleanup/refund/resolution policy is inferred. Finance/privacy must
approve retention and inherited delete behavior before actual activation.

Six PRODUCT001-006 decisions are dormant offline candidates, not accepted release
policies: family roles, digest consent/timezone, evidence-bound package units,
global/revision-bound enrichment review, explicit trial projection and private
analytics. See ../backend-upgrade/nine-region-offline/ADR-PRODUCT-001.md.
IngredientV2 consumer preview and scan source oracle cannot confer data/AI authority.
Synthetic seven-day arithmetic cannot certify production SLO. Scanner context binds
exact source/provenance and uses trusted-base policy for PRs, while raw17 findings
remain findings; independent/hosted promotion still pending. Read-only schema SQL
fingerprint was re-bound after reviewing additive0041 objects, preserving the
unchanged production executable path. Implementation0407011d; all real acceptance
uses PENDING_EXTERNAL_EVIDENCE. See PLAN.md, RESULT.md and validation.json.

---

# B08 dependency mitigation final checkpoint - 2026-10-12 JST

**Task/status:** LOCAL_MITIGATION_VERIFIED_WITH_BLOCKING_RELEASE_GATES.
Implementation30f1630b63c782de9e6fd37d8726cdadae0fffea; patch0f52b1963c1b2075ba2d47f4cd05b3c4b3d6a495;
base receipt b9612d199bbad57efbe71a423ab97b41fab8f3af; branch codex/backend-b08-tailwind-feasibility.
Canonical worktree /Users/tunbee27/.codex/worktrees/backend-b00-baseline/frigo.

**Delivered:** owned pnpm braces3.0.3 fixed128-depth parser/walker patch; original
versions/overrides/glob behavior retained.59new tests,756upstream differential
vectors0mismatches; fresh offline frozen install7JSfiles exact. Unpatched default
Node24 does not crash on4000-container strings here; explicit512KiB children
reproduce6stack failures, patched12/12controlled rejections. No all-DoS claim.
Private official Tailwind4.3.3 removes advisory but fails compatibility:20actual-route
style pairs/15pixel pairs and6state pairs differ, all baseline controls exact.
Major candidate stays unapplied; specific migration/browser/native plan recorded.

**Checks:** clean committed313files/7582tests PASS156.645s; focused3files/152tests
PASS; frozen install/lint/both TS/40migrations/sequential build PASS. CSS134861bytes
exact, actual SW commit token.4564protected base files exact; product sources,
config/public/workflows/40migrations/payment/auth/data/provider authority unchanged.
Pinned4557-file scan:853/853Semgrep0errors/findings;17unchanged captured secret
candidates0unresolved;2HIGHzizmor;518declaredSyft components. Full audit1HIGH,
production0; securitygateFAILED. No suppression/waiver/hosted certificate.

**Failures/evidence:** firstfull2files/11fail from omittedTMPDIR /var-vs-/private/var;
prior canonical /private/tmp fixes assertions unchanged. Import-order warnings,
pixel-control drift, nominal-route fallback, YAML helper/default-stack assumption
and generatedpatchcontext whitespace warnings retained.39command metadata/log
hashes and9bounded attachments; rawlogs/scans/pointers/candidate stay private.
Final docs-only receipt/current-SHA scan/verifier follow in ignored artifacts.

**Limits/next:** upstream patched owner or certified Tailwind4 compatibility,
independent/hosted review, permitted realOCR/labels/provider facts/paid budget,
human ingredient/fourdata blockers, explicitly protectedbilling/inbox/staging/
edge/load/chaos/SLO/alerts/retention/access/rollback/release remain required.
Original checkout unchanged; no remote write/deploy/mail/paidAI/push/PR/merge.
See docs/backend-upgrade/b08-tailwind-feasibility/RESULT.md, LOCAL_VALIDATION.md,
MIGRATION_PLAN.md and NEXT_ACTIONS.md. Historical suffixes remain immutable.

---

# B08 remaining dependency mitigation - 2026-10-12 JST

**Task/status:** LOCAL_FIXED_DEPTH_MITIGATION_IMPLEMENTED_FINAL_GATES_PENDING.
Active packet docs/backend-upgrade/b08-tailwind-feasibility/PLAN.md; branch
codex/backend-b08-tailwind-feasibility; base receipt b9612d199bbad57efbe71a423ab97b41fab8f3af.
Canonical worktree /Users/tunbee27/.codex/worktrees/backend-b00-baseline/frigo.

**Changes:** official Tailwind4.3.3 candidate is private and rejected:20 actual-route
pairs differ in computed styles,15 differ visibly;6 focus/hover/forced-color pairs
also differ with exact baseline recovery. Corrected candidate build/frozen install/
full and production audits pass;437 declared graph removes braces. No product
migration applied. MIGRATION_PLAN.md records specific cascade/default/browser/
native-toolchain acceptance. Fixed-depth pnpm patch of braces3.0.3 bounds parser
and compile/expand/stringify walkers to128; all package versions/overrides unchanged.

**Executed checks:**59 focused tests and types PASS;756 upstream differential
vectors0 mismatches. Default Node24 unpatched control does not crash here; explicit
512KiB children reproduce6 stack failures, patched12/12 bounded rejections. First
import-order warnings, pixel-control drift, incorrect nominal-route probes, YAML
helper resolution and default-stack control assumption are retained and corrected.
Full committed-source gates and final scanner/receipt follow; no release claim.

**Limits/next:** product src/config/public/Worker/payment/auth/data/provider authority,
workflows and40 migrations protected. High published advisory remains blocking;
local patch is not a suppression/upstream release/all-resource-exhaustion fix.
No independent agent/hosted/native-device/release certification is claimed.
No remote write/deploy/mail/paid AI/push/PR/merge; original checkout unchanged.
Complete local gates, protected-byte review and final source-bound receipt; then
published compatible patch/certified major migration and existing external gates.
Historical receipts and checkpoint suffixes follow unchanged.

---

# Backend program final local aggregate - 2026-10-12 JST

**Task/status:** LOCAL_IMPLEMENTATION_VERIFIED_WITH_BLOCKING_RELEASE_GATES.
Final implementation41da180a941b348c6385895628b2bdd61b666763; branch
codex/backend-b08-log-privacy; immutable parent receipt efffb4f84b52eb42979c69547b6bd7263963099a.
Canonical worktree /Users/tunbee27/.codex/worktrees/backend-b00-baseline/frigo.

**Delivered:** prior strict auth/email/offline ScanV3/provider-cancellation/dormant
budget/data-pilot/whole-week/shopping/cooking/API/telemetry/toolchain work remains
verified in its exact receipts. Final87-producer/28file review removes41raw exception
arguments and bounds cleanup/shadow errors and public media path diagnostics.
Responses/commands/SQL/retention/catalog/modes/scheduler/throttle stay compatible.

**Checks:** clean committed312files/7523tests PASS; focused9files/132tests PASS;
frozen install/lint/both TS projects/40-migration smoke/sequential build PASS.
CSS134861bytes identical. Fresh scan4511files/SG849complete0errors0findings;
GL17 unchanged provenance0unresolved; zizmor2HIGH; Syft518 declared components.
Full audit1high; production0. Security gateFAILED, no production certificate.
15command logs/9attachments preserved after38-input privacy check0issues0overlaps.
First TS7006 and reconciliation digest-order assertion failures retained and fixed.

**Limits/next:** original checkout unchanged; protected payment/auth business logic/
package/lock/workflows/config/Worker/migrations/assets/data/provider authority intact.
Real OCR/human data/provider bounds/pricing/privacy/retention, paid benchmark budget,
protected billing, inbox/hosted/staging/edge/load/chaos/SLO/alerts/retention/rollback/
release gates remain open. No remote writes/deploy/mail/paid AI/push/PR/merge.
Final docs are a separate receipt with postcommit verification/current-SHA scan in
ignored artifacts. See docs/backend-upgrade/b08-log-privacy/RESULT.md and NEXT_ACTIONS.md.

---

# B08 business log privacy in progress - 2026-10-12 JST

**Task/status:** LOCAL_LOG_PRIVACY_FINAL_GATES_IN_PROGRESS.
Active packet: docs/backend-upgrade/b08-log-privacy/PLAN.md.
Branch codex/backend-b08-log-privacy; immutable base receipt efffb4f84b52eb42979c69547b6bd7263963099a.

**Work:** final review of the request-only telemetry boundary found41 raw exception
log arguments, cleanup raw messages, mutable shadow error names and unconfirmed
public media path IDs. Minimal local diagnostic corrections retain HTTP/data/
cleanup/catalog behavior. Independent producer provenance review and representative
adversarial tests are in progress. No whole-platform privacy/security certificate.

**Checks:** focused9files/132tests PASS after emitter own-data snapshots. Lint PASS;
first typecheck FAIL TS7006 in a new test callback, narrow unknown annotation fixed;
recovery and clean committed-source full gates follow. Inherited B08 implementation remains309files/7463tests verified separately.
All prior receipt documents remain immutable. Package/lock/workflows/40migrations,
Worker entrypoint/config/payment/auth logic/data/provider authority unchanged.
No remote write/deploy/mail/paid AI/push/PR/merge. External production gates remain
listed in the immutable B08 NEXT_ACTIONS; final aggregate receipt follows.

---

# B08 local compatibility and security decisions - 2026-10-12 JST

ADR-B08-LOCAL-001 accepted locally. Direct supported owner upgrades, scoped
selector-parser overrides with exact CSS proof, unused PWA dependency removal,
Router urgent-navigation compatibility and native PNG pixel/metadata parity are
verified on d3cce9560593a263e70f85646e061291e8829b56. All public assets, Worker/payment/
migrations/config/date/resource/provider authority remain unchanged.
Existing action pins/quoted env SHA/credential/cache edits preserve every release
and migration gate. The docs security pipeline candidate remains disabled.
Actual audits/scanners and privately adjudicated17 matches do not certify security.
The unpatched braces advisory and hosted/real-data/provider/inbox/SLO/billing gates
remain open. Receipt-tool NUL Git traversal fixes are docs-only; final receipt tools
bind to their own documentation commit. See b08-local-remediation RESULT/NEXT_ACTIONS.

---

# Backend program decisions - aggregate checkpoint 2026-10-12 JST

Implementation `7ef2f8407d3a6a958c78146db3b5c9a9f0990b78` is locally verified. Packet ADRs in backend-upgrade record
B01c live membership; B03a truthful offline scoring; B03b strict V3 contracts/version
fences; B04a provider admission and shared cancellation/deadline; B04b cancellation
and dormant exact durable budgets; B05a evidence-bound review/pilot; B06 minimal
closed-loop fixes; B07 parity-preserving read extraction/OpenAPI; B08a bounded logs.

B02 remains design-only under the protected billing rule. Its auth regression
fixture gets only 6 membership seed lines; all payment assertions/runtime remain
unchanged by independent byte comparison. Candidate AI budget SQL is outside the
40-migration chain; no durable cost-ceiling claim until complete trusted token,
output-limit, pricing and retention providers exist. ScanV3 writes/clients and new
models remain disabled. Symbolic corpus/pilot output does not grant data authority.

The pinned security candidate is executable and independently reviewed locally,
with 24 actual engine selftests. Repository findings/errors and dependency audits
remain blocking; no suppression, exception, workflow enablement or security/
license/SLO certificate. Source/staging/data/quality/security/release are separate
states. The complete masterplan remains open at those explicit dependency gates.
Preserve implementation/receipt hashes and historical source documents; see
backend-upgrade/program-20261011/STATUS.md and NEXT_ACTIONS.md.

---

# Backend program decisions - 2026-10-12 JST

Accepted for the declared local implementation only. Hosted/data/provider/release
certification remains separate. Packet ADRs define compatibility and rollback.

- B01c live current membership/cookie authority: [ADR](../backend-upgrade/b01c/ADR-B01c-001.md).
- B03a offline evaluator and truthful statistical/cost denominators: [ADR](../backend-upgrade/b03a/ADR-B03a-001.md).
- B03b pure V3/evidence compatibility and disabled writer/readers: [contract](../backend-upgrade/b03b/ADR-B03b-001.md), [reader fence](../backend-upgrade/b03b/ADR-B03b-002.md).
- B04a governed injected provider, shared deadline/abort/admission hooks: [ADR](../backend-upgrade/b04a/ADR-B04a-001.md).
- B04b dormant conservative durable budget and terminal cancellation: [budget](../backend-upgrade/b04b/ADR-B04b-001.md), [cancellation](../backend-upgrade/b04b/ADR-B04b-002.md).
- B05a independent source/evidence proof and no runtime promotion: [ADR](../backend-upgrade/b05a/ADR-B05a-001.md).
- B06 reproduced cannotBuy/receipt recovery/repeated-line allocation corrections: [ADR](../backend-upgrade/b06/ADR-B06-001.md).
- B07 exact-compatible Week reads and bounded structural contract: [reads](../backend-upgrade/b07/ADR-B07-001.md), [OpenAPI](../backend-upgrade/b07/ADR-B07-002.md).
- B08 bounded trusted request telemetry: [ADR](../backend-upgrade/b08/ADR-B08a-001.md).

B02 retention/refund design, real provider bounds/pricing, V3 writer/storage/client,
IngredientV2 data authority, scanner workflow/toolchain upgrade and numerical SLO
remain separate reviewed decisions. No existing PayOS/release rule is superseded.
Historical accepted ADRs follow unchanged.

---

# ADR-B01a-001 - Dormant strict OTP transaction foundation

Status: ACCEPTED_FOR_DORMANT_A1_LOCAL_IMPLEMENTATION, 2026-10-11 JST.
Packet: ../backend-upgrade/tasks/B01a-strict-otp.md.
Full decision: ../backend-upgrade/b01a/ADR-B01a-001.md.
Implementation 0649324a729b57019df61da6bceec40cd9ba1135; local checks in b01a/validation.json.

Dedicated raw D1 claims/assertions reserve total admissions before actual digest
comparison, preserve account-wide replay identity, budget/cooldown/generation and
same-transaction business effects. Migration 0040 additive and non-cascading. Keys
use DB time; legacy counts import conservatively once; session replay never mints
a new credential. Local adversarial comparison/required-zero faults and isolated
D1 schema replay pass. This accepts the dormant A1 policy/code only; legacy routes
remain active and A2 route/client/registration/guest/cleanup/release contract is
not accepted by implication. No production protection or hosted D1 certificate.


---

# ADR-B01b-001 - Bounded provider acceptance and conservative email fallback

Status: accepted for local B01b A1 implementation, 2026-10-11 JST.
Packet: `../backend-upgrade/tasks/B01b-email-adapter.md`.
Independent source/contract and test-matrix reviews completed before integration.
Extends ADR-028 only in email adapter routing/evidence; production certification
and B01a strict issuance integration remain separate.

A native send may be accepted before its caller receives an exception. Existing
unconditional native-to-Resend fallthrough can therefore send the same OTP twice.
Add sanitized state/evidence while retaining `sent` as provider-acceptance bridge.
Native fulfillment/Resend2xx prove accepted, never delivered. Structured native
policy codes and HTTP4xx except408 prove rejected; arbitrary errors, timeouts,
408/5xx and unexpected statuses are delivery_unknown. Absence of providers is
not_configured. Delivered/bounced require later authenticated lifecycle evidence.

Only exact string E_SENDER_NOT_VERIFIED / E_SENDER_DOMAIN_NOT_AVAILABLE permit
native-to-Resend fallback. Recipient suppression/policy/quota codes terminate;
message-text matches can classify an error but cannot authorize fallback. No
retry after unknown, and no automatic HTTP redirect/retry. Provider dispatch and
metadata share an8000ms deadline per attempt, max16000ms sequential fallback plus
local scheduling overhead. Timeout publishes once, aborts HTTP best effort and
fences late outcomes. Native cannot promise cancellation. These are chosen local
policy bounds, not measured production SLOs or exactly-once send guarantees.

Retain/parse at most4096metadata bytes and make at most64stream read calls.
Discard the chunk crossing the byte limit; transport-byte ingress is not bounded
by this parser. Omit invalid optional IDs and preserve HTTP acceptance/rejection
if metadata is unavailable. Replace unused raw messageId with optional SHA256 messageIdHash of bounded
opaque tokens (8-128ASCII letters/digits/underscore/hyphen, at least one letter);
omit malformed/contact/numeric/control-bearing values. No current caller reads IDs. Neither raw IDs nor hashes enter logs. Log only stable provider/category/purpose/environment
and state/evidence, never raw provider payloads/errors/recipient/OTP/credentials.
No callback, new authority, dependencies, migration, bindings or flags.

Compatibility: auth still reads sent/provider/error. Unknown returns false, so
legacy production invalidation and KV cooldown clearing remain until B01a. A1
prevents duplicate fallback within one invocation; it does not certify safe
resends across requests or real inbox delivery. Rollback must keep conservative
ambiguity handling. B01b E2E/inbox/bounce/retention follows B01a separately.

---

# B00 backend decision register - 2026-10-11 JST

ADR-B00-001 accepted for source/evidence/documentation scope only; implementation policy drafts B01-B08 at `../backend-upgrade/b00/DECISIONS.md`. No accepted runtime ADR is silently superseded by B00. Runtime OTP/email/key/legacy cutover/ScanV3/billing decisions require their own reviewed ADR before integration. Historical decisions follow unchanged.

---

# ADR-052 - Scoped stock detail and system-state presentation (UI09)

Status: accepted and locally verified for UI09, 2026-10-10 JST.
Full281files/6615tests PASS;focused223;browser49snapshots/9journeys;Weekflagoff
audit16screens/2journeys. Evidence: ../ui-rebuild/round-9/VERIFICATION.md.
Owner/device/navigation/Weekimplementation/hosted/release remain.
Implementation `251e42ad9efd5b84e87171c69f9fc1bfb3e9b463` verified against125sourcehashes/
115evidencepayloads and manifest Git objects/worktree; protectedpaths unchanged.
Packet: `tasks/UI09-stock-detail-states.md`; extends ADR-044 through ADR-051.

Detail aliases and reconciliation still use the supplied shell, tiny copy and
truncated evidence. Adopt existing digital tokens/assets through explicit routes,
shared kitchen header/heading and a readable single-column detail workspace.
Quantity/expiry/provenance precede editing; related recipes indicate ingredient
relevance only. Preserve canonical queries/fallback, dirty-only versioned PATCH,
lot-bound drafts, conflict reload truth and server reconciliation intent/proposals.
Pending fallback must show loading rather than a premature not-found message.
Metadata controls lock during save; input/error/return focus and explicit cancel
warnings improve interaction without adding persistence or stock commands.

SystemStatusPage owns standalone identity for AppErrorBoundary and SessionBoundary
markup. Keep verification effects, session/Plus/onboarding/logout logic and all
App guards unchanged. No auth protocol or payment surface redesign.

Week has an unsent per-day schedule and a separate command/sheet lifecycle.
Audit real flag-off local preview in this packet and plan UI10 for that workflow.
PREVIEW_MEAL_PLANNER_ENABLED opt-in false sets both preview frontend/server flags;
default remains true. No production flag, router, Week/store/service change.
No backend/schema/dependency/config/asset/font/pose/remote/push/deploy changes.
Local new-surface QA and full gates are required; Week audit and synthetic faults
are not device/owner/hosted/release approval or whole-system UX certification.

---

# ADR-051 - Account and entry adopt the scoped digital identity (UI08)

Status: accepted and locally verified for UI08, 2026-10-10 JST.
Full277files/6588tests PASS;focused121;recovery130;browser106checks/107PNG/13journeys.
Evidence: `../ui-rebuild/round-8/VERIFICATION.md`; owner/device/remaining/hosted
release remain. Implementation `5ad78191295fabe4a8b2accd14e134452e203788` verified against
Git objects: 95 source hashes / 137 evidence payloads and the manifest match worktree.
Packet: `tasks/UI08-account-entry.md`; extends ADR-044 through ADR-050.

Remaining account and entry screens mix the supplied kit, very small copy and
unsupported AI/notification promises. Adopt UI07 assets, font and tokens through
explicit account routes and page-owned public entry scopes. Shared account chrome
uses the existing KitchenHeader, heading and primitives; preserve form authority.
Group profile navigation by task and present unavailable sharing/data capabilities
in plain language. Notification preferences store local intent only; no scheduled
or delivered-reminder claim. Scan imagery may contain personal content, so privacy
copy must not promise otherwise.

AuthPage/security/services and unrelated guards stay byte-identical. AuthShell and fields may
change visual layout/geometry; OTP paste/expiry, resend, Turnstile/GSI, transfer,
returnTo and session fencing remain. Onboarding drafts/request/completion and
navigation remain. Preserve Plus link JSX/target and existing logout authority;
no payment UI or backend/config/dependency/production edits. Legacy Week needs
separate flag-off evidence and is not included in this presentation packet.

Actual guest QA exposed the existing onboarded /onboarding guard racing finish's
week navigation with a Home redirect. Match that guard to the existing in-memory
primaryGoal intent; preserve /week/setup alias and server-authoritative completion.
No other guard or authentication protocol changes. Verify all goals through App
and actual browser retry; direct alias resolves /planner/new when flag is enabled.

Validate actual local interaction and responsive/enlarged/reduced-motion states,
focused behavior tests and full gates. Synthetic provider results are not real
email receipt/Google credential/device install/production or final brand approval.

---

# ADR-050 - Scoped digital identity from the kitchen direction (UI07)

Status: accepted and locally verified for UI07, 2026-10-10 JST.
Implementation `94b9ae3f889781e58999c3fe3a21a0f265d3a5cb` verified against Git objects.
Full274files/6551tests PASS;focused82;browser41checks/45PNG/6journeys. Owner/device/
remaining routes/hosted/release remain; evidence `../ui-rebuild/round-7/VERIFICATION.md`.
Packet: `tasks/UI07-brand-kit.md`; builds on ADR-044 through ADR-049.

The supplied chef-hat/leaf uppercase kit and the UI01 kitchen prototype diverge;
public icons/OG still identify the older kit. Finish the existing kitchen direction
as a reviewable digital system: simple octopus, lowercase licensed outlined
wordmark, optical micro, horizontal/stacked and reversed/one-color variants.
Preserve the displayed Takosan spelling and all technical IDs/domain/commands.

Keep new masters/exports under /takosan/rebuild and retain every supplied/legacy
path and TAKOSAN_BRAND for remaining surfaces. Update browser metadata and add new
assets to the existing release-aware precache. No cache policy, auth/payment UI,
Worker, schema, migration, production flag or dependency change. Default generator
uses repository vector masters; explicit supplied-kit invocation remains supported.

Persistent desktop sidebar owns the lockup; header shows the existing motto.
Mobile/tablet and immersive workflows keep accessible header identity. Layout mode
comes from AppLayout, not route duplication inside Header. Verify actual render,
small-size readability, pixel safe zones, export determinism and full gates.

Local verification is a digital direction checkpoint, not final owner approval,
trademark/recognition/usability research, physical install or production release.
Remaining route and mascot adoption needs its own scoped inventory/packet.

---

# ADR-049 - Planner workspace and truthful shopping presentation (UI06)

Status: accepted and locally verified for UI06, 2026-10-10 JST.
Implementation `c441e194b0fe861fc1e3f81747e6346c30266f09`.
Full272files/6533tests PASS;browser59checks/91PNG/21journey groups (repeated across
V2/V1/mismatch). Independent/device/hosted/release review remains; evidence
`../ui-rebuild/round-6/VERIFICATION.md`.
Packet: `tasks/UI06-planner-shopping.md`; builds on ADR-044/046/048/031.

Keep the canonical /planner and legacy /week flag routing, V1/V2 DTOs and all
server commands intact. Present dates as a responsive day board, setup as a
readable form with context, and shopping as a summary plus explicit demand list.
Do not introduce recipe media or new arithmetic. Partial/unplanned/stale/unknown
prices, untracked components and temporary recommendation checks stay explicit.
Remove the looping legacy link in favor of a real /shopping saved-list destination.

A pathname-keyed workspace owns async UI callbacks. Changing subroute unmounts
the old workflow; existing private-session guards and query caches remain. A late
server commit may exist and must be read on return, but cannot navigate/accept into
an abandoned screen. Generation keys remain stable while retrying on that screen.

Saved shopping exposes positive fractional quantity and the eight wire units,
keeps blank invalid, confirms removal and labels verified queued writes. Its
existing server/client item identity and durable outbox are retained. Return a
pendingSync receipt for toggle/delete without changing HTTP payloads. Local cache
projection must not re-read the server after a committed mutation or duplicate an
already queued client ID. No inventory mutation is introduced by any check.

No production flag/schema/dependency/Worker/payment/auth/infrastructure change.
Full final brand kit, legacy detailed workflows, account/settings and release
remain separate packets. Validate actual local V1/V2/mismatch/aliases and shopping
flows, then full repository gates; local QA is not production certification.

---

# ADR-048 - One cooking review and immutable completion attempt (UI05)

Status: accepted and locally verified for UI05, 2026-10-10 JST.
Implementation `cef5acb5a21964fb58d4886fb58ffd098e54fe89`. Full270files/6514tests PASS;
focused70; browser32checks/55PNG/12journeys. Independent/hosted/device/release
review remains; evidence `../ui-rebuild/round-5/VERIFICATION.md`.
Packet: `tasks/UI05-cooking.md`; builds on ADR-044/045/047.

## Problem and decision

The two completion surfaces diverge in errors/session fences and hide pendingSync.
Their coarse +/- controls cannot enter fractional actual use. Retrying generates
another command ID. Voice callbacks capture the original step. The tick countdown
loses background time and leaves running true at zero; empty steps can crash.

Share one review component and an in-memory cooking-run command snapshot. Inputs
preserve blank and zero; strict sequential availability checks prevent duplicate
rows spending the same compatible stock. Freeze payload and key on first confirm.
Unknown transport/response/5xx failures allow only same-key/same-payload retry.
Known 400/409/422 rejections permit explicit fresh authoritative inventory fetch
before unlocking edits with a new key. Idempotency-conflict and access errors do
not auto-reset identity. Known safety rejection permits explicitly ending the
rejected run to choose another recipe; it never resubmits that meal. Successful/
queued results lock review and show their actual status until the user explicitly
enters inventory. Cached offline reads cannot substantiate a fresh-stock claim. Worker remains sole mutation authority.

Own lifecycle by run ID, recipe route and private session. Late results cannot
reset another run or navigate an unmounted surface. Voice reads the current store
step at callback time, stops on review/route/unmount, clears feedback timeouts.
A deadline countdown accounts for elapsed wall time while open; pause stores
remaining time, resume creates a new deadline, navigation resets it. Expiry alerts
once per timer generation, not each render. Manual controls and existing live
region/focus contracts remain. No claim of alarms when browser/OS suspends app.

## Compatibility and limits

No backend endpoint/schema/SQL/authority/migration change. Keep existing aliases,
preparation availability, conversions, per-lot offline projection, session reset,
Week invalidation and idempotency/outbox headers. Cooking-only service typing and
response validation must preserve current callers. Offline projection uses stock
from before the attempted mutation to avoid subtracting a lost-response commit
again; an existing queued key must not project twice. Outbox persistence must be
verified before claiming pendingSync. No new persistence of private drafts; warn
on document exit while unsaved/uncertain. Prototype brand is not final brand kit.

---

# ADR-047 - Shared scan review presentation and truthful lifecycle (2026-10-10)

Status: accepted and locally verified for UI04; independent/hosted review and
release/device/usability validation remain. Full268files/6490tests PASS; focused188;
browser29checks/51PNG/8journeys. Evidence: `../ui-rebuild/round-4/VERIFICATION.md`.
Verified implementation: `85b86442257ae9573701c2df6107cd5e509cdade`.

## Problem and decision

Photo and receipt reviews duplicate fields and diverge in typography, unit labels,
expiry status and action layout. ScanPage claims timed processing milestones with
no server evidence. Adopt shared typed review fields and a scoped review header,
summary and responsive action region within the existing prototype shell. Retain
all route IDs, server ownership, extraction evidence and explicit confirmation.
Keep canonical resolution on the existing server; display mapping limitations
without a new static/catalog picker or implied confirmed remapping.

Uploading is an in-flight request, not a claimed completed queue/AI stage. Pending
and processing DTOs alone determine queued/analyzing presentation. No artificial
percentage or timer-based completion. Elapsed time remains visible but not live
announced every second; reduced motion is respected.

Accepted fields must be valid independently of native form submission. Rejected
photo rows disable fields and submit ID+rejection so invalid discarded edits do
not block durable rejection. Synthetic offline confirmation skips rejected rows,
validates accepted quantity rather than inventing 1, and reports pendingSync
only when synthetic imports enqueue at least one item. All-rejected imports
produce no command and no claimed pending operation.
Photo review retains that state until the user leaves review; it then clears the
queued ready draft so returning must hydrate server state rather than editing
the locally queued command; receipt retains
its existing explicit pending toast. Camera effects own and stop their stream.

## Compatibility and limits

No endpoint/schema/migration or inventory command change; eight wire units,
expiry flags, server extraction/price facts, quota, session fences, conflict
refetch and Week link remain. No review draft persistence or new image read path.
Only an explicitly bound in-memory image for a ready/confirmed matching scan
may show a source preview (photo or authorized receipt); new reads cannot adopt
an old preview merely by hydrating their scan ID. Review remains
explicit: AI never writes stock before confirmation. Validation includes T13
round trips, offline/rejection/invalid edits and local browser/full repository gates.

---

# ADR-046 - Additive discovery summaries and snapshot-fenced pagination (UI03)

Status: accepted for local implementation, 2026-10-10 JST. Packet:
`tasks/UI03-discovery-api-media.md`. Builds on ADR-044/045/026/025.

## Problem

UI02 limits DOM to24 but downloads full recipe requirements/steps for every result.
Legacy recommendations treat cuisine/time as score preferences, while discovery
needs hard filters. Ranking depends on household stock; unfenced offset links can
silently duplicate/skip dishes after inventory or catalog changes. Fresh local D1
contains429 imported dishes sharing one decorative pasta illustration. Several
legacy global dishes reuse unrelated food photographs; Unsplash mappings have no
repo evidence proving each image depicts the named dish.

## Decision

Add `GET /api/v1/recipe-discovery`, authenticated under existing middleware, with
strict Zod request/response schemas and no-store responses. Use one existing
recipe authority snapshot and a strict household inventory read per request.
Filter full catalog before the existing quantity-aware ranker; resolve score,
match percentage and time ties by stable recipe ID. Slice only after ranking.
Return small card summaries, total/page/pageSize/pages and previous/next cursors;
media enrichment reads only the selected IDs. Recipe detail remains independent.
Recipes defaults24; Home requests3. Old endpoints, scoring and command consumers
are unchanged. No database migration or parallel catalog authority is introduced.

Cursor encodes version, target page and SHA256 witness over normalized filters,
page size, user/household, catalog source/fingerprint and sorted inventory fields
used by quantity/ranking (plus available version identifiers). It contains no raw
identity or stock. It confers no access: the current authenticated inputs must
produce the same witness. Malformed/page-mismatched cursor400; changed witness409
`DISCOVERY_SNAPSHOT_CHANGED`. UI shows explicit restart with same filters/page1.
An unfenced direct page URL uses current data and clamps to current pages. Links
carry cursors for refresh/back/detail-return; changing filters removes the cursor.
This is stateless snapshot-fenced offset pagination, not persistent historical
snapshots or database keyset paging. No HMAC secret is needed because the witness
cannot select stock/catalog or bypass authorization and only compares current data.

Frontend shares the contract, validates responses, retains transport/session
fences, uses the existing scoped recommendations cache prefix for inventory
invalidation, and labels offline static-catalog/local-inventory results. Offline
source has its own witness; switching source invalidates fenced navigation.
`src/web/services/recipe-discovery.ts` is an explicitly approved offline static
reader in the T14D audit allowlist; server discovery only accepts its routed
RecipeAuthoritySnapshot. The unknown-reader guard remains enforced.

Media quarantine lives in shared presentation policy: generic illustration,
precise confirmed recipe/path mismatches, and known legacy Unsplash mappings
without dish review. Raw URLs/release fingerprints/migrations stay intact;
ready canonical media wins and its failure falls only to an allowed legacy image
or neutral placeholder. Audit records URL reuse separately from duplicate bytes,
local file SHA/dimensions, pending media, and unknown license/provider provenance.
No generated replacement or claim of new verified photo coverage.

## Limits and compatibility

Server still loads the authoritative full catalog and evaluates candidates for
household ranking each request. This reduces transfer/DOM and bounds media reads,
not catalog hydration/CPU. Canonical media may change independently of ranking.
Legacy APIs retain their payloads and source selection. A fail-closed strict
inventory read is specific to the new endpoint; no legacy reader behavior changes.
No payment/auth/command/Week/flag/infrastructure or remote operations.

Validation: API all-page coverage/filter/no-buy/source/stock/session fixtures;
mounted URL/loading/recovery tests; real local Worker/browser/network/axe checks;
full pnpm check exit0,266files/6468tests;15browser axe/layout checks,0violations.
Verified implementation `dbba0535f66b585ff3bdedb27894ee72b57872d1`; exact commands,
failures/repairs and limitations in `../ui-rebuild/round-3/VERIFICATION.md`.

---

# Architecture Decisions

## ADR-045 - Home plan authority and scoped daily discovery

**Status:** Accepted for local UI02 implementation on 2026-10-10 under the user's
request to continue one milestone; release remains a separate activity.

**Problem:** Home reads legacy Week even when Planner uses canonical meal-planning.
Home can therefore claim no plan for a household with an active future plan.
Composition may supersede a V1 anchor. Header/identity differ between rebuilt pages
and navigation; discovery loses filters on reload and renders500 rows at once.

**Decision:** Select the current-plan query using the existing planner UI flag and
reuse its household-scoped key. Read canonical DTOs through the existing validated
client; keep the legacy Week path when the flag is off. A pure presentation adapter
uses canonical fixed-offset dates and intent slots, with distinct upcoming/past/
no-today states. Home links to meal detail for authoritative composition handling.
Use shared composition reads when enabled. Never show V1 titles on pending/error/
missing/revision-mismatched composition; only UI-off or explicit404 permits V1.
V2 components can fill originally unplanned slots. An explicit server V1 projection
retains a family-variant anchor, matching existing Planner compatibility; it does
not permit fallback on uncertain reads or an empty V2. Explicit future slot times
remain eligible beyond the default meal window. Do not derive current-stock or
food-safety claims from the planning projection or manufacture budget data.

A shared header/page heading and prototype shell apply only to the four migrated
route families. Navigation keeps its current IA/Scan and defaults elsewhere;
payment/auth presentation and commands remain protected. Store validated recipe
filters and page in URL, preserving unrelated parameters. Client pagination shows
24 results and searches the entire returned set. Native filter disclosure collapses
on smaller devices and defaults open from1280px; active count remains visible.
Recipe detail returns to its accepted originating Home/catalog context.
This is a DOM/UX improvement,
not a smaller API response: server list DTO/cursor design remains UI03.

**Compatibility:** No schema, migration, flag, dependency, server contract or
payment/auth/infrastructure changes. Existing Week and canonical planner keys are
retained. No stock/cooking/planning mutations are introduced. Rollback is source
only; there is no persisted-data conversion. Browser tests are synthetic/local.

## ADR-044 - Quantity evidence and a scoped interface rebuild foundation

**Status:** Accepted for local implementation on 2026-10-09 under the user's
instruction to start the Tako-san UI rebuild; remote release requires separate work.

**Problem:** The legacy matcher treats compatible but insufficient stock as
no-buy. Detail checks only positive stock and shopping posts the whole demand.
The generic image fallback depicts a different dish. Filter emptiness is presented
as an empty fridge. The accepted audit roadmap calls for a more mature visual system.

**Decision:** Reuse T02's lot index/reservation arithmetic in an explicit
quantity-only adapter for the legacy matcher, detail and cooking drafts. Preserve
existing type-match percentage and ranking weights; no-buy requires satisfied
required demands. Add optional `ingredientAvailability` evidence to the result;
keep existing fields and full required lines in `missingRequiredIngredients` for
compatibility. Only a known positive `missingQuantity` may be posted to shopping.
Unknown/contextual conversion requires review, never a guessed shortage.

This adapter projects quantity, identity, unit and freshness, with no expiry dates:
the fixed index date is inert. It does not certify expiry/allergen safety, replace
planner eligibility or authorize stock consumption. Existing authenticated inventory
readers own household scope. Real lot IDs retain duplicate detection; legacy inputs
without IDs receive deterministic per-row IDs. Required lines reserve before optional
lines, so repeated demands cannot double-spend stock. Cooking commands/FEFO/session
and revision fencing remain server-owned and unchanged.

Use a neutral SVG image fallback. Keep valid canonical/legacy media resolution.
Distinguish true empty inventory from empty search/filter results. Apply the prototype
palette/Be Vietnam Pro and responsive typography only within rebuilt inventory/detail
surfaces. Existing global brand and protected payment presentation remain intact until
subsequent component migration. The name remains Takosan per current identity contract.

**Compatibility:** No schema, migration, catalog, flag, dependency, auth, payment or
production-infrastructure change. The additive evidence is optional for old clients
and mocks; rebuilt detail recomputes against its inventory query. No-buy semantics
become stricter as intended. Legacy contextual stock may now require checking.
Rollback source/UI together; no data or composition records need removal.


## ADR-043 — T20 hiển thị composition có thẩm quyền và kiểm tra prerequisite trên cả hai môi trường

**Trạng thái:** Đề xuất implementation ngày 2026-10-09, chờ reviewer độc lập
kiểm tra final PR head. Không cấp quyền merge, deploy, migrate hoặc bật flag.

**Bối cảnh:** Khi GET composition pending, lỗi 500/offline hoặc thiếu slot,
PlannerMeal/PlannerWeek có thể hiển thị title/ingredients/method V1 đã không còn
mô tả bữa V2. Guard prerequisite planner chỉ áp dụng staging; production có thể
bật T20 nhưng parent UI hoặc Worker planner vẫn tắt. API Assisted đã có
`regenerate_unlocked` nhưng UI chưa cung cấp action đó.

**Quyết định:**

- Pending/error/missing composition phải có loading/error/retry và chặn nội dung
  V1 có thể sai cùng thao tác regenerate. Chỉ 404 từ composition API cho phép
  compatibility fallback khi server tắt; family V1 vẫn dùng editor V1. Slot URL
  không tồn tại trả unavailable, không retry vô hạn. Meal page truyền canonical
  query vào composer để tránh refetch khi mount.
- UI expose `regenerate_unlocked` bằng API preview/apply hiện có, giữ validation,
  proposal identity, locked components và shared revision fence của ADR-031.
- Production build, pre-upload guard và Worker deploy override derive planner
  flag từ normalized T20 release decision. T20=true đòi hỏi cả planner Worker
  và compiled UI=true. T20=false giữ production planner=false như baseline.
  Staging planner vẫn true độc lập; guard chung kiểm tra cả hai môi trường.
- Validation copy vi/en dựa allowlist mã lỗi; không đưa raw server text vào UI.
  Week/shopping phải ghi rõ simple-food `not_tracked`; không gọi đó là covered,
  không bịa số lượng hoặc thay calculator.

**Tương thích và rollback:** Không thêm API, schema hoặc migration; không thay
composer/scoring, T19 authority, T21 diagnostics, auth, PayOS hay physical stock.
0039 additive đã có theo receipt production trước; không replay migration.
Đổi workflow là draft cho release sau review, không đổi runtime hiện tại.
Rollback bằng paired flags/source đã review, giữ composition records và ledger.
Local SQLite/browser/build verification không thay staging certification hoặc
operator approval. Xem `T20_TAKEOVER_AUDIT.md` và `T20_RELEASE_READINESS.md`.


## ADR-042 - Operational media gates after the catalog media rollout

**Status:** Accepted for bounded implementation and independent review 2026-10-08.
Normal PR/current-main CI and independent production Environment approval still
control remote execution. No real users exist; user-data retention certification
remains excluded by the operator's instruction.

**Context:** Normally approved diagnostic37681758263 proves a complete V1 runtime
catalog at0038,500ready media records, and rejection solely by the historical
media_ready=0/exactly-one-pending-hero catalog gate. Generic migration verification
also unconditionally calls the seed gate. T15A explicitly marked this gate as a
future compatibility issue. A global ready count does not prove hero coverage or
metadata integrity; ready data must not be demoted/deleted to satisfy the old gate.

**Decision:** Preserve the immutable0035 seed and historical0034-0037/catchup
certification. For complete reviewed catalogs at exact0038/0039, require each
recipe to own exactly one ready hero, or exactly one pending hero when no ready
hero exists. A pending successor may coexist with its ready predecessor. Require
no orphan media, no duplicate ready(recipe,role), valid metadata identities,
closed role/status/source vocabularies and integer versions1..1000000. Ready
metadata must match the existing domain storage-key/MIME/dimension/hash/length
policy. Missing, NULL or malformed aggregate evidence fails closed. Validate the
existing media schema/index/immutable trigger as well as actual data.

Before0039, capture every existing media metadata column in deterministic order
in private runner-local JSON and bind its rowcount to the catalog aggregate.
After0039, require the same count and canonical SHA256 plus successful current
metadata/schema certification. Upload only counts/hashes, never raw rows, storage
keys, generator references or exception messages. Keep existing bookmark, ledger,
main/CI and separate Worker deployment gates. No ready media write is introduced.

**Compatibility and limits:**0039 is additive and must preserve media. Recipe
runtime authority/fingerprint excludes media and remains unchanged. Existing
ready semantics rely on byte verification at promotion; this gate certifies
persisted metadata and observed before/after preservation. It does not freshly
verify R2 existence or bytes, prove transactionally atomic cross-query snapshots,
or supersede the separate media-serving/promotion boundaries. Historical seed
checks, applied migrations, runtime/config/dependencies, credentials, payments,
auth and Environment review policy remain unchanged. A failed preservation check
stops rollout; it does not authorize an automatic database restore.


## ADR-041 - Bounded V1 catalog source replacement before production release
**Status:** Proposed 2026-10-05 for independent implementation review. A credential-free main-push echo job registers the workflow; the production
gate explicitly requires manual dispatch. Remote execution
requires the normal independent production Environment approval. The operator
has requested production recovery and states there are no real users; user-data
retention certification is excluded from this operation.

**Context:** Protected topology run37316530751 completed on certified main and
proves the current 6720-line catalog cannot be safely paired with V1 lines to
invent positions. It does not prove corruption. The production Worker still has
D1/cutover enabled and falls back static only because catalog diagnostics fail.
Recovering D1 would activate it automatically. Migration0039 does not repair this.

**Decision:** Replace the active recipe catalog with the existing certified V1
release `rel-bd00a4f53fcaeee4`, fingerprint
`f8cf8c7ff59df9fe29e246b9e3c9aad0fd155fa8df35bf671ac4d03fa2b5ab37`.
No live-line semantic pairing is used. Independently review the complete final
PR tree; bind its merged implementation head to an identical main tree and
exact-main successful push CI,
and normal independent Environment approval. Recheck those proofs at mutations.

First clone the exact existing Worker module bytes and runtime, inherit all
bindings/secrets/assets and change only catalog routing to static/0/cutover=false.
Keep its old Git SHA. This config operation deploys no T20/main application
bundle and does not waive ADR-031's0039-before-T20 prerequisite. Provider versions
are immutable; unknown API metadata fails closed. Assets retained via Cloudflare's
`keep_assets:true` contract are distinguished from a content digest the API does
not expose. Verify the active100% version, bindings and served static authority.

Replay immutable migrations only in local preparation, verify V1 independently
through the real runtime hydrator, then generate one D1 atomic import. Require
exact38 ledger/0038, known schema/triggers/FKs,500 canonical recipe IDs,6720 lines,
zero order rows, valid rollback source units/quantities and clean foreign keys.
Capture Time Travel bookmark and an immutable lossless in-database catalog archive.
Update parent IDs in place, replace six child/runtime/classification/nutrition
relations from certified V1, and unlink enrichment nutrition before restoring
version1. Shared ingredient/nutrition registries remain outside the operation.
The archive retains the prior catalog without promoting its contents as authority.

Certify500 hydrated recipes,2702 explicit positions, exact release fingerprint,
unchanged ledger and integrity after import. If certification fails, rollback only
from that archive while the catalog still equals the generated target. Static
routing must remain active throughout; do not restore the former D1-enabled Worker
after catalog mutation. Import failure uses D1's atomic original-state recovery;
ambiguous provider failure requires operator inspection. Catalog archives remain
for later intentional cleanup; no historical migration or ledger row is rewritten.

**Consequences:** This separately authorized source replacement supersedes the
historical order-repair STOP requirement to find a position for every current live
line. C2/C2T diagnostic permissions stay read-only and unmodified. This operation
applies no0039 and does not authorize a new application deployment on its own.
After catalog certification, use existing guarded0039 migration and immutable
staging/production release workflows. Existing rollout progression is retained.

### ADR-041 continuation - intentional corrected recovery guard V2

Approved inspect37460946708 proves no observed original recovery commit and
stable old catalog/static routing. It isolates the incoming-FK predicate failure;
it does not recover the lost provider cursor or prove terminal failure.

Use a new recovery ID and guardVersion2, not a replay of original SQL. Check exact
reserved-object inventory first, accepting only the documented unquoted _cf_KV
WITHOUT ROWID definition with ASCII formatting/case normalization that preserves
token boundaries. Materialize all other table names before invoking FK PRAGMA;
retain the full incoming-FK projection and bidirectional set comparison. FK target
and trigger parent coverage folds SQLite identifier case; projected metadata
remains exact so unknown uppercase references/triggers still reject. Unknown
application tables remain included; unknown reserved objects/schema reject before
FK inspection. The same guards protect archive rollback.

Original recovery-prefix coverage also folds identifier case while keeping strict
expected object identity; uppercase aliases remain unexpected evidence.
Keep original 37384670328 SQL/hash sealed as INSPECTION_ONLY. New read-only
preflight recompiles the exact new plan and requires all eight guards MATCH with
strict primary metadata. Before any new restore mutation require two stable
original no-commit/old-catalog/primary observations, two stable corrected
preflights, the exact original static100% Worker and fresh main/normal approval.
Record INTENTIONAL_NEW_GUARDED_RECOVERY_V2 and UNKNOWN_NO_CURSOR explicitly.
Successful observation is not provider terminal-state or future-queue exclusion
proof. Preserve independent post-import V1 certification and existing0039/release
order. No historical migration, protected subsystem or approval policy changes.

### ADR-041 continuation - file-import confirmation and third incident

Normally approved recovery37536969564 has an unknown import outcome without a
retained provider failure. Offline pinned Wrangler3.114.17 reproduction confirms
its successful file import stdout can include vendor spinner progress before JSON.
Use a narrow file-import completion parser; retain strict JSON for queries and
sanitized unknown-output failure evidence. Never infer the actual database commit
from the parser reproduction.

Seal a third read-only descriptor to exact a8fa/run37536969564 source/restore/rollback
bytes. Save and repeat SELECT-only primary observations without accepting run IDs
or receipt-selected SQL. Preserve both historical incidents and their semantics.
A future restore must prove all three namespaces absent, old bounded catalog and
corrected strict-primary guards stable before pin/bookmark/import. Applied/partial/
rolled-back/changing evidence blocks a new restore; an observed applied marker
still requires independent runtime/integrity/provenance certification. All observers
retain UNKNOWN_NO_CURSOR, retryAuthorized=false and non-release-certification.
Normal PR/current-main CI/independent production Environment review remain required.
See recipe-catalog/PRODUCTION_IMPORT_CONFIRMATION_20261007.md for exact evidence.


## ADR-040 — T21R-C2 captures protected occurrence evidence and publishes aggregate-only receipts

**Status:** Proposed 2026-10-02 for independent implementation review. Local
code/tests and normal branch publication only; no production execution or delivery.

**Context:** Merged T21R-C provides an offline classifier/schema, not an executable
protected capture. T21R-B's documented admin-bypass aggregate evidence cannot
authorize a more sensitive row read. Public Actions artifacts cannot safely carry
the full row manifest even when names and physical IDs are pseudonymized.

**Decision:** Add a dedicated manual-only workflow reusing hardened release/main/CI
and certified V1 authority. Independently validate normal production approval
before credential use; reject bypass, self-approval and unbound rerun history.
Execute only four reviewed SELECTs with exact account/database, 0038 ledger,
independent counts/rosters and two-read digest guards. Classify credential-free
with the merged implementation/schema. Keep raw/full evidence outside checkout
in restrictive runner-local files, and upload only an explicit aggregate receipt
on success. Secure row delivery remains unconfigured and separately unauthorized.

**Review-binding remediation:** The reviewed feature SHA must differ from the
dispatch main SHA, remain its ancestor, and have byte-identical security/execution
closure at gate, capture reauthorization and final recheck. Unrelated main
advancement is allowed only outside that traced closure and with current exact-main
CI. The success receipt distinguishes SELECT-only code from unproven credential
scope (`queryPathSelectOnly=true`, `tokenScopeReadOnlyProven=false`); failure does
not claim completed path attestation. This additive hardening changes no workflow,
classifier, target, production permission or row-delivery policy.

**Hosted CI environment:** PR36's depth-1 checkout omitted historical authority
objects needed by ledger tests. CI must provide full Git history; preserve exact
ledger semantics. Changing this review-bound CI file requires renewed review.

**C3 dispatch dependency hardening:** Pin the dedicated production workflow's
external Actions to verified upstream commit SHAs without changing its semantics
or CI workflow. The repository transferred to `vn-tak/Tako-san` with ID
`1385308553` unchanged; current-run gate/receipt guards use that exact name while
the certified V1 target's `resolvedNameAtReview` remains historical. All 73 bound
entries are retained. These new executable bytes require independent review of
the final C3 feature head and matching post-merge main/CI before any capture.
Environment self-review/bypass availability is recorded separately from rejected
self/bypass approval use; token read-only permission remains unproven. C3 changes
no Environment policy, production credential, live database or row delivery.
See `recipe-catalog/T21RC3_PRODUCTION_DISPATCH_READINESS.md` for source evidence,
the credential-free future packet and fixture-only validation.

**C4I separate identity diagnosis:** Add a manual production-Environment
metadata-only workflow/script outside the unchanged 73-path C2 closure. Permit
only whoami and D1 metadata list; expose stage enums, suppress raw output/debug
files and publish no artifact. Existing C2 generic identity rejection remains
unchanged. Real-Git additive binding passes and a bound-byte mutation rejects;
C3 reviewed SHA remains eligible only under future-main equivalence and all C2
gates. Identity success never proves read-only token scope or authorizes SQL,
credential mutation or C2 rerun. See
`recipe-catalog/T21RC4I_CLOUDFLARE_IDENTITY_DIAGNOSTIC.md`.

**C4L parsed Wrangler stdout:** Any Wrangler call whose stdout Tako-san parses
runs with `WRANGLER_LOG='log'` (Wrangler 3.114.17 gates `logger.log`/`table`,
including whoami's account table and every `--json` payload, at level `log`),
keeps piped stdio and the private debug-log path. No Wrangler upgrade or
`whoami --json`. The bound-byte change voids C4I `a0c1cfd` and C2 `93c4055`
review authority by design. See `recipe-catalog/T21RC4L_WRANGLER_PARSED_STDOUT_REMEDIATION.md`.

**C2D failure decomposition:** Capture binding, authority, reconciliation,
schema, aggregate and digest failures expose distinct fixed safe codes. The
existing runner-local failure receipt reconstructs code/stage only; Ajv and row
details remain private, and failure upload stays disabled. Reconciliation keeps
uncaptured parents unattributed rather than inventing a captured recipe; aggregate
validation checks recipe-local candidate references and derived status/indexes.
V1, the closed schema, capture and SELECT authority are unchanged. The old C4L
C2 reviewed SHA is invalidated by these bound bytes, not excluded from the closure.
Production run 37135187427's stage remains unknown; a completed capture followed
by classification failure is not evidence of V1 divergence or repair readiness.
See `recipe-catalog/T21RC2D_CLASSIFICATION_DIAGNOSTICS.md`.

**C2S schema boundary:** Preserve the closed schema and Ajv 6's first-error,
`allErrors:false` behavior. Only actual schema validation can create a branded
failure category. Reconstruct section/field/keyword/code from explicit static
allowlists and known schema rules, including referenced and conditional rules;
unmapped errors return `UNKNOWN_SCHEMA_CONTRACT`. No raw Ajv context or caller
diagnostic metadata is published. The existing failure log/receipt may contain
this fingerprint; failure upload remains disabled. Unique target mappings list
only satisfying witnesses; unresolved identity or content-conflict competition
remains ambiguous with its candidate graph intact. Keep the 73-entry review
closure, capture/SELECT authority and C4I unchanged; renewed exact-head review is
required. See `recipe-catalog/T21RC2S_SCHEMA_BOUNDARY_FORENSIC.md`.

**Consequences:** A later separately authorized capture can establish only
`OBSERVED_STABLE_NON_ATOMIC`, never repair readiness or atomicity. No T19/T20
runtime, migration, database, catalog, deployment or Environment policy changes.
See `recipe-catalog/T21RC2_PROTECTED_PRODUCTION_ROW_READ.md` for executable scope,
privacy, delivery tradeoffs, exact checks and outstanding authorization.

## ADR-039 — Production V2 catalog lineage is a read-only semantic comparison, not position repair

**Status:** Accepted 2026-09-30 for the additive diagnostic. No production mutation, migration, restore, deploy, recipe-authority change or T20 enablement is authorized.

**Context:** Production D1 ingredient-line IDs do not match immutable 0038 V1 (6720 live-only vs 2702 historical). Recipe IDs still match. Canonical Recipe Refresh V2 is a reviewed research package (500/6766) that is not production-release-ready. Live row count 6720 is close to 6766 and is not proof.

**Decision:**

1. Extend `Production D1 Read-Only Diagnostics` with a runner-local V2 semantic comparison of already-read catalog rows. Do not add a production SELECT unless a later reviewed packet proves the five-statement snapshot lacks a required field.
2. Match as a multiplicity-preserving multiset on documented fields only. Do not fuzzy-match names, drop quantity/unit, or use rowid/lexical order as authority.
3. Upload only sanitized counts/digests. Keep `researchV2LineageProven=false` unless ingestion provenance is separately proven. Cross-ID content matches are informational unless reconciliation is `existing_canonical_id` or reviewed `reviewed_new_canonical_id`. Missing-line metadata is classification, not causal proof.
4. Relative canonical source order is not runtime contiguous position authority. `runtimePositionAuthority` stays false. Allowed position labels are `NONE`, `PARTIAL`, `CANONICAL_V2_RELATIVE_ORDER_CANDIDATE`.
5. Keep historical V1 comparison unchanged. Keep 0039, Time Travel restore, migration replay and order-row writes stopped.

**Consequences:** Operators can prove or reject V2 semantic lineage on exact-main after Environment approval without granting repair permission.



## ADR-038 — Project unplanned slot fields explicitly and share slot time policy with T20

**Status:** Proposed 2026-09-27 for review. Staging remains on
`9d64178b8bbc8f07672a1e9f0434867f3699f339` until a separately gated
release; this decision does not authorize production.

**Context:** Live staging plan creation with `hardMaxTimeMinutes=10` or `20`
returned HTTP 500 `MEAL_PLANNING_UNAVAILABLE` for test User B. An isolated
local reproduction exposed a `ZodError`: the T05 shopping snapshot persisted
the entire T04 `unplannedSlot`, including `hardMaxTimeMinutes`, while its
strict schema accepts only the T05 subset. The V1 planner can legitimately
leave a tightly time-capped slot unplanned. Source inspection also showed
that T20 Manual restrictions and Assisted/Auto candidate generation used
the base household ranking context without the slot's hard time cap, even
though V1 uses `contextForSlot`.

**Decision:** Project the explicit T05 fields of each unplanned slot before
strict parsing; the saved plan intent retains its time constraint. Expose the
existing V1 `contextForSlot` helper and use it in T20 for each slot's Manual
hard-restriction evaluation, downstream legacy-family revalidation, and
Assisted/Auto candidate generation. Keep the same T03 evaluator and preserve
all household hard policies. An over-time component must return HTTP 422
`HARD_CONSTRAINT_CONFLICT` without changing revision or composition.

**Consequences:** A focused integration test creates a time-capped plan,
checks a valid five-minute simple food, rejects a 25-minute simple food and
a long recipe, rejects swap/save bypasses, and checks Assisted/Auto exclude
the over-cap food. The change requires exact-head CI, review, exact-main CI,
and a staging-only T20=true/static/0 deploy before repeating the LIVE hard
restriction matrix. Production, T19 authority and 0040 remain out of scope.

## ADR-037 — Staging T20 requires the planner Worker and UI gates to be on

**Status:** Proposed 2026-09-27 for review. Staging-only configuration and
release guard; production planner configuration is unchanged.

**Context:** The T20 staging deploy at `b44e9355ce8988e7acb7c3b12c55bc2b27340e1a`
passed its paired T20 flag checks, yet an authenticated composition picker
returned 404 `MEAL_PLANNER_DISABLED`. All planner routes first require
`MEAL_PLANNER_ENABLED=true`, and the web app exposes `/planner` only when
`VITE_MEAL_PLANNER_ENABLED=true`. Neither flag was set by the staging release.
Two registered test accounts can sign in but cannot exercise T20.

**Decision:** Set `MEAL_PLANNER_ENABLED=true` in the committed staging Wrangler
configuration and compile staging assets with `VITE_MEAL_PLANNER_ENABLED=true`.
The staging T20 release guard reads the committed Wrangler config and Vite's
build record and rejects any T20=true release unless both planner gates are
exactly true. The existing T20 Worker/UI pair and recipe authority gates stay
in force. Production build/deploy configuration is unchanged.

**Consequences:** A reviewed, exact-main staging redeploy is required before
live T20 certification. Staging's legacy planner UI becomes accessible along
with T20; this is an intentional staging-only exposure. A future T20-off staging
release may retain the planner gate; disabling the planner again needs a
separate explicit decision. The guard prevents another green T20 deploy whose
planner API and UI are unreachable.


## ADR-036 — Require explicit Deploy dispatch while staging T20 is enabled

**Status:** Proposed 2026-09-27 for PR review. Applies to Deploy trigger only;
production still requires its existing explicit confirmation and gates.

**Context:** Staging currently serves T20 with both Worker and UI flags true.
The automatic `workflow_run` Deploy after every successful main push has no
operator T20 input. The release gate correctly normalizes that event to
`MEAL_COMPOSITION_V2_ENABLED=false`; merging a registration fix would therefore
silently turn off T20 before the operator's intended staging dispatch. The
release policy requires an exact current-main SHA and successful hosted CI, so
a branch cannot use the standard workflow to deploy directly.

**Decision:** Remove the automatic CI-completion trigger from Deploy. Retain
`workflow_dispatch` on reviewed main with the existing exact-SHA, hosted-CI,
staging proof, paired Worker/UI flag and production confirmation gates. For the
T20 staging continuation, the operator must dispatch `environment=staging`,
`meal_composition_v2_enabled=true`, static recipe authority and zero canary
only after the PR is reviewed and merged and exact-main CI succeeds.

**Consequences:** A merge no longer deploys staging automatically. This
prevents an unrequested T20 rollback, and it also means all future staging
releases need an explicit dispatch until a separately reviewed automatic-state
policy is implemented. Production remains dispatch-only. Reverting this ADR's
trigger change while T20 stays on would restore the unsafe automatic rollback.


## ADR-035 — Pair the staging Turnstile test widget with its public test secret

**Status:** Proposed 2026-09-27 for review. No deployment or production change
is authorized by this ADR.

**Context:** Staging advertises Cloudflare's official always-pass test site key,
but a retained mismatched Worker secret can make registration return 403
`TURNSTILE_FAILED`. Live Worker secret contents are not readable with available
credentials, so this is the leading diagnosis rather than a proven live cause.
Without registered users, T20's authenticated planner cannot be certified.

**Decision:** For the exact `staging` environment and exact official test site
key only, use the paired official public test secret for Siteverify. A token is
still mandatory, and only an explicit successful Siteverify response passes.
All other staging site keys require a configured secret; production requires
its own configured site key and secret and is unchanged.

**Consequences:** Staging test registration no longer depends on a retained
Worker secret when the public test widget is configured. The public test keys
are deliberately non-security keys and must never be configured in production.
Live effect must be proved after an independently authorized staging release.


## ADR-034 — Staging captures the serving recipe-authority Worker before deploy; previous-Worker evidence is retried, never accepted (T20-R1)

**Status:** Proposed 2026-09-27 for review (branch
`feat/t20-staging-release-observability`). No deploy, T20 enablement or
production change is authorized by this ADR.

**Context:** Deploy run `36285175574` deployed staging at `0b2e0a17…`; readiness
identified the new SHA 3/3 and smoke passed, then the protected
`/api/v1/health/recipe-authority` evidence was still answered by the previous
Worker (`commit=8147dde8…`). Both endpoints read `env.GIT_COMMIT`, so this was
edge convergence, not a second commit authority. Staging captured no
`previousRecipeAuthority`, and `waitForRecipeAuthorityEvidence` retried only
same-SHA/previous-state evidence, so it correctly failed closed.

**Decision:**
1. Staging runs `release-check.mjs previous-authority` after the CI recheck and
   before `command: deploy`. It reads the protected endpoint with
   `STAGING_RELEASE_VERIFY_TOKEN`; only HTTP 200 with a JSON object is evidence
   (a rejected token, any other status or malformed JSON fails the job).
2. `verifyPreviousRecipeAuthority` proves the capture: schema 1, staging
   environment, canonical commit that is the release SHA or a Git ancestor of it,
   complete stable fields, a reviewed rollout state, and
   `verifyRecipeAuthorityEvidence` against the catalog release shipped at that
   commit (`git show <commit>:…/catalog-release.current.json`). The manifest
   records `previousRecipeAuthority` and `previousRecipeAuthorityProof`.
3. Post-deploy evidence has three classes. Class 1 (exact target commit and every
   approved field) passes. Class 2 (exactly the captured evidence on every stable
   field; a different commit also needs the matching proof and must re-validate
   against that commit's release; same-SHA must serve the captured, non-target
   state) is retried inside the existing 90 s bound and never passes. Class 3
   (anything else) fails immediately.
4. Production keeps its `transition`/deployment snapshot/rollback preflight. It
   records no proof, so previous-commit evidence still fails closed there; its
   same-SHA retry now also needs the exact captured evidence (stricter only).

**Consequences:** Final success still requires `evidence.commit === manifest.sha`
and every approved field. An unknown/unrelated ancestor commit, wrong
environment/release/count/fingerprint/mode/cutover/canary or a fallback is never
retried. A staging Worker whose current evidence cannot be proven (for example a
D1 fallback in `d1`/`canary`) now blocks the staging deploy until investigated.
The readiness helper (`verifyDeployedRelease`) is unchanged; with a captured
previous state it applies the same same-SHA rule production already uses.

## ADR-033 — Runtime Ingredient Model V2 is an evidence-gated projection, not a V1 replacement

**Status:** Proposed 2026-09-27 for review. No live cutover, D1 migration, 0040,
final release manifest, production mutation or T20 enablement is authorized.

**Context:** ADR-032 preserves 6,766 canonical research ingredient rows, but the
closed V1 `RuntimeRecipeIngredient.requiredQuantity` projects only 3,770. That
single V1 value is currently read as display, shopping/planner demand, cooking
deduction and sometimes incorrectly as edible/nutrition amount. The 2,860
release-required exclusions cannot be repaired with universal tablespoon,
teaspoon, produce-weight or process-absorption defaults.

**Options:** Expanding `StandardUnit`/nullable V1 quantities would immediately
affect T02–T05, Week, cooking and T20. Mutating the canonical ZIP would lose
source truth. A separate pure, versioned projection can make each semantic
quantity and unresolved state explicit without changing live contracts.

**Decision:** Add `RuntimeIngredientV2` as an offline projection candidate with
separate display, shopping, process and consumed channels. Source adaptation
never certifies edible yield. Shopping measurements are admitted automatically
only for directly evidenced physical units; process scaling and qualitative or
culinary measurements remain unresolved. A guarded V1 shopping projection
throws on provisional authority, missing purchase quantity or unreviewed
non-shopping exclusion. Exact physical conversions remain in the existing
domain unit policy; no culinary conversion is inferred. Reviewed ingredient
authority is a separate explicit decision: a new master row needs a reviewed
concept with basis/reference, and an alias must target an existing ID.

**Consequences:** The static 71 and present D1 hydration/fingerprint remain
unchanged. The new audit pins the source SHA and classifies every current row;
the release gate remains red. V2 is not yet a serving API, planner cutover or
D1 schema: resolving the evidence queues, authorizing the V2 runtime/content
wire model, and proving consumer compatibility are required before 0040.


## ADR-032 — Recipe Content Refresh V2 uses a richer canonical source and a separate deterministic runtime projection

**Status:** Accepted 2026-09-27 for the canonical-source branch. No migration,
remote D1/R2 mutation, recipe-authority change, deployment or T20 enablement is
authorized by this decision.

**Context:** The externally researched 500-recipe ZIP is not a runtime import
batch. It contains 15 root shapes, qualitative and process ingredients,
unsupported culinary units, 289 nominal nutrition profiles with process-media
errors, and research provenance that must not be flattened into
`RuntimeRecipeIngredient`. The existing T14E compiler is intentionally
INSERT-only, the closed runtime unit vocabulary is still required by planner,
inventory, shopping and cooking, and `ALL_RECIPES` remains the 71-recipe
rollback baseline under ADR-027/030.

**Decision:**

1. `data/recipe-refresh/v2` is the canonical research source for this content
   generation. Every recipe uses one strict schema and preserves identity,
   research sources, normalized steps, source-rich ingredient quantity evidence,
   usage/nutrition roles, nutrition certification, legacy media compatibility
   and audit metadata. Source truth may be richer than runtime truth.
2. Ingredient roles include consumed, process-only, mixed-process, optional,
   garnish and qualitative. Nutrition separately distinguishes consumed,
   excluded process, unresolved absorption and excluded optional rows. Unknown
   edible quantity or absorption remains explicit; no made-up gram/ml/count
   value is introduced to satisfy runtime contracts.
3. Ingredient identity uses the existing exact catalog resolver first, then a
   deterministic provisional name key for `ING_ENR_*` IDs. Nutrition/FDC URLs are
   evidence only and never identity authority. This prevents proxy reuse from
   merging foods such as miso with soy sauce, galangal with ginger, or bell
   pepper with generic chili. Reconciliation remains machine-readable.
4. Nutrition is recomputed from evidenced edible gram equivalents. Explicitly
   non-consumed process rows are excluded; frying, extraction, marinades and
   mixed use with unknown transfer/absorption block certification. Only a
   complete seven-nutrient profile with no material blocker publishes as
   `<recipe-id>_nutrition_v2`; blocked/null profiles expose null certified
   nutrients and retain a separate non-publishable candidate for audit.
5. `scripts/recipe-refresh-v2.mjs` is a no-network deterministic build/check
   boundary. It writes the canonical package, audit artifacts and exact
   `RuntimeRecipe` projection, hashes ordered canonical files, and computes
   runtime identity only through the project's `fingerprintRecipes()`.
   `pnpm recipe:refresh:check` fails on catalog/schema/exception/hash/projection
   drift. Mutable URL spot checks are evidence outside the canonical hash.
   The runtime fingerprint is explicitly provisional. `pnpm recipe:refresh:release-check`
   fails with typed blockers until a separately reviewed production projection
   and final fingerprint exist.
6. Runtime projection does not make quantities nullable. It admits only
   canonical IDs with positive `StandardUnit` quantities, excludes non-shopping
   water and estimated process quantities, and omits uncertified nutrition.
   Rich process/qualitative metadata remains source-only until a separately
   reviewed runtime contract can carry it without breaking planner/inventory/
   shopping/cooking/T20 behavior.
7. The T14E import compiler and current release manifest remain unchanged.
   Content Refresh V2 is a separate future convergence path. Before generating
   `0040_recipe_content_refresh_v2.sql`, reconcile runtime/content loss, promote
   ingredient authority with evidence, verify sources, certify nutrition, and
   generate a complete final projection. The migration must preserve recipe IDs,
   verify exact old/new states, inspect child FKs and fail closed on unknown state.

**PR #11 remediation:** The original canonical package conflated source validity
with release readiness. The source manifest now records four typed blockers,
`productionReleaseReady=false`, `finalRuntimeFingerprint=null`, and a separate
provisional projection fingerprint. All 500 source files retain URL references
but distinguish structural validity from content verification. Generated
`ING_ENR_*` identities are provisional until an explicit review record exists;
the ingredient-authority assertion rejects provisional IDs. Per-recipe exclusion
reasons and an aggregate coverage report make runtime loss auditable. This adds
no D1 schema or runtime quantity contract change.

**Consequences:** The canonical package can be reviewed and reproduced without
production reads, network calls or AI. A refresh release may update the D1 500
while preserving the static 71 rollback baseline. Nutrition coverage may shrink
rather than publish false precision. Media remains ADR-025 metadata/R2 work and
is not marked ready by this source. Staging certification and any 0040 rollout
are separate release tasks.

## ADR-031 — Meal Composition V2: one composition per slot, additive storage, shared revision, single-subtraction projection (T20)

**Status:** Accepted 2026-09-25 for T20 implementation. Gated off by default; no
production migration or deployment. Details: `MEAL_COMPOSITION_V2.md`.

**Context:** The Meal Planner (ADR-017/030) persists one T04-selected recipe per
slot inside versioned JSON. T20 needs meals of several ordered, lockable
components (recipes and simple foods), Manual/Assisted/Auto building, and correct
shopping — without a second recipe authority, without rewriting stored V1 plans,
and without breaking V1 clients whose schemas are `.strict()`.

**Decision:**
1. Additive migration 0039: `generated_meal_plan_compositions` (slot-level
   MealComposition, FK to the existing plan) and `generated_meal_plan_components`
   (ordered components; `recipe_id` XOR `simple_food_id`; one dish per meal via
   partial unique indexes; no FK to `recipes`). `recipe_role_assignments` stores
   non-rule role provenance with SQL-enforced confidence/review invariants.
2. Read-time V1 compatibility: a slot without a composition row is the
   one-component projection `main / legacy_v1`. The first V2 mutation
   materialises it; rows are then canonical for that slot. `result_json` is never
   rewritten. V1 endpoint schemas are unchanged; V2 uses new sub-routes.
3. One optimistic-concurrency authority: V2 writes bump
   `generated_meal_plans.revision` in the same D1 batch behind a fence insert that
   aborts the batch on a stale revision. V1 swap on a composed slot is a typed
   409; V1 regenerate preserves locked components and follows the new anchor for
   unlocked ones atomically; V1 shopping projects every component.
4. T19 authority is consumed, never re-derived: components, picker items and
   Auto candidates must be in the request's `RecipeAuthoritySnapshot`; role rows
   are read only for `d1` authority and fenced to its universe; authority change
   is the existing `CATALOG_AUTHORITY_CHANGED` revalidation.
5. Shopping: all components of all meals are evaluated by T02 against one running
   T04 projection (exact consumption witness), then T05 aggregates unchanged —
   inventory is subtracted once; no parallel shortage arithmetic.
6. Roles are deterministic rules (versioned) plus persisted reviewed/imported/AI
   rows; no runtime AI; human review outranks inference; AI rows below 0.8
   confidence are never effective.
7. Assisted/Auto share one bounded beam search (explicit anchor, per-role, beam,
   partial and scoring budgets; hard compatibility pruning; decomposed score;
   deterministic with a bounded `variant`). Suggestions never write; apply
   recomputes and requires the same option ID. Locked components are immutable
   to generation (domain-enforced and re-verified).
8. Flags `MEAL_COMPOSITION_V2_ENABLED` (server) / `VITE_MEAL_COMPOSITION_V2_ENABLED`
   (UI), independent of T19 flags. Flag off = exact pre-T20 behaviour.

**Consequences:** Deploying T20 code requires applying 0039 first (the D1
schema gate fails closed on a 0038 ledger). Composed slots describe themselves
through components; the V1 generation record remains for audit/rollback.
Leftovers, per-component servings, curated role review tooling and whole-week
Auto are deferred.

**Amendment 2026-09-26 (PR #7 review P1 remediation):**
- One hard-restriction definition: T03 `evaluateHardRestrictions` (extracted from
  `evaluateRankingEligibility`, behaviour unchanged) judges Auto/Assisted (via
  ranking) and every component a Manual mutation adds (via
  `composition/restrictions.ts`, same T02 candidate and evidence). No manual
  override model exists.
- V1 family-variant meals stay V1-edited (swap) and are refused by composition
  routes; they are projected as `legacy_family` so composed shopping keeps them.
- Composition shopping requires the planner's substitution policy
  (`evaluationScope(context)`); it cannot be constructed without one.
- Flags ship through `deploy.yml` from one normalized release output with a
  post-build guard; defaults are false everywhere.

## ADR-030 — One recipe authority for the Meal Planner, stored-plan authority identity, reviewed full-D1 release state and protected release evidence (T19 V2)

**Status:** Accepted 2026-09-22. The immutable original branch is published at
`0a04209`; application checkpoint `558be74` is integrated from current main on
`feat/t19-recipe-authority-cutover-v2-integration`. Hosted application CI is
pending; production remains untouched.

**Context:** ADR-026 made the Recipe API/Week/Shopping/Cooking read one
`RecipeAuthoritySnapshot`, but the Meal Planner still loaded the raw D1 catalog
via `loadMealPlanningSnapshot()`. With the 500-recipe ledger applied and
production configured `static`/`shadow`, the planner could plan, suggest and
swap recipes the Recipe API did not list and cooking could not resolve; planner
catalog fingerprints also hashed the whole D1 catalog, so invisible D1-only
edits staled static plans. The release path (`release-check.mjs` + Deploy
workflow) explicitly rejected `d1`, and public readiness could not certify
recipe authority.

**Decision:**
1. `loadMealPlanningSnapshot(db, scope, time, authoritySnapshot)` now takes the
   request's effective authority snapshot; `projectPlannerCatalogOnAuthority`
   (`packages/db/src/planner-catalog-authority.ts`) takes recipe definitions and
   steps from that snapshot in every mode — `d1` adds D1 planner enrichment
   (families of visible recipes, classifications, provenance, nutrition,
   diagnostics) fenced to the visible universe and degrades to the
   authority-only projection if the enrichment read fails; `static` (also
   shadow / canary-outside) reads no D1 planner rows. The planner universe is
   exactly the authority's recipe set; alternatives/swap/regenerate never expose
   an invisible recipe (invisible swaps are `REPLACEMENT_NOT_FOUND`; invisible
   locks are dropped on regenerate, never substituted in place).
2. `MealPlanningServiceOptions.recipeAuthority(scope)` is required and installed
   by route composition from deployment config + deterministic household canary;
   request input never reaches it.
3. Stored plans persist `source_json.data.authority {source, fingerprint,
   recipeCount}` (envelope version stays 1; pre-T19 rows without it still
   decode). An authority-source change is a typed revalidation: freshness reason
   `catalog_authority_changed`, `CATALOG_AUTHORITY_CHANGED` (409) on swap and
   shopping, regenerate as the only recovery path. Authority change means a
   different source, fingerprint or recipe count (same-source release drift is
   typed too). Historical plan data is never mutated.
4. Planner catalog fingerprints hash only authority-visible recipes, steps and
   nutrition rows: a D1-only edit cannot stale a static plan; a D1-visible edit
   correctly stales a D1 plan.
5. Reviewed release states become `static`/`shadow`/`canary`/`d1` with canary
   percent ∈ {1,2,5,25} (new 25 staging step) and percent 0 required elsewhere;
   `RECIPE_CATALOG_CUTOVER_ENABLED` is derived (true iff `canary|d1`), never an
   input. `d1` means every household is served the verified D1 release; runtime
   fallback semantics (verified D1 or static with diagnostics) are unchanged.
6. Observability: `/health/ready` gains a sanitized `recipeAuthority` summary
   (mode/cutover/percent/global source/fallback/release ID/expected count). A
   protected `GET /api/v1/health/recipe-authority` (bearer `RELEASE_VERIFY_TOKEN`
   Worker secret, constant-time compare, 404 when unset) returns machine-readable
   evidence that `release-check.mjs authority` verifies against the approved
   manifest — deployed SHA, mode/percent/cutover, D1 readiness, served count and
   release fingerprint, no fallback. No PII, no secrets, no household data; no
   customer account is required for release certification. Canary probes
   resolve in-cohort and shadow probes resolve through a probe-local D1
   configuration, so `shadow` proves D1 readiness before any canary while users
   keep receiving static.
7. Non-terminating aggregate shopping demand (e.g. two 2-serving meals of a
   3-serving recipe) is reported `unresolved`
   (`UNRESOLVED_PURCHASE_QUANTITY`, unknown budget) instead of throwing at the
   T05 exact-quantity boundary; rounding remains forbidden.

**Consequences:** T14D/T14F authority tests keep passing with the planner added
to the parity set; T19 cross-flow, fingerprint, persistence, observability and
release-state tests pin the behavior. Stored pre-T19 plans revalidate through
the catalog fingerprint until regenerated. Production rollout is operator-driven
through the reviewed Deploy workflow (shadow → canary 1/5/25 → d1), each gate
machine-verified: the release ref must equal current main, the deployed commit
may never move backwards, promotions require healthy evidence from the current
stage, downgrades/bootstraps require explicit confirmation, Cloudflare/D1
identity and catalog identity/integrity are certified read-only before every
mutation, and a failed or cancelled deployment restores the exact previous
Worker version through the Cloudflare API with a complete proof. Serving
rollback is redeploying `mode=shadow`/`static`.

**Evidence-only supplement 2026-10-02 (T21R-C):** Offline occurrence
classification against the T21R-A-certified V1 release does not change this
runtime authority, stored-plan freshness, ADR-031 composition/role/shopping
contracts or migration/deployment permission. Exact tuple/multiset evidence
does not establish live physical order, linked nutrition safety or a repair
action. A live T21R-C receipt, normal independent approval and bounded blast
radius remain prerequisites to a separate T21G decision; bypass is forbidden
for mutation. See `recipe-catalog/T21RC_ROW_LEVEL_RECONCILIATION_DESIGN.md`.

## ADR-027 — Reviewed Bulk Recipe Imports and Catalog Release Manifests (T14E)

**Status:** Accepted 2026-09-17; remediated 2026-09-17 after independent review (nutrition evidence persistence, complete
immutable batch hash, manifest-failure telemetry). Factory + manifest architecture open for re-review; no real catalog
growth; production remains `4ed98514…` / D1 0034 / `static`.

**Context:** T14D certifies D1 authority only when the hydrated catalog equals `ALL_RECIPES` exactly. That is correct for
71 recipes but makes intentional growth (500 → 5,000+ recipes, T14F) impossible: either `ALL_RECIPES` would have to grow
into a multi-megabyte static bundle, or readiness would have to be weakened to "D1 has some recipes". Neither is acceptable.
Bulk import also needs a safe, deterministic path from an authorized dataset to reviewable SQL without touching
`migrations/`, the static source, D1 or R2, and without inventing ingredient IDs.

**Decision:**
1. **`ALL_RECIPES` stays the immutable legacy/static rollback baseline (71).** It is never the scale strategy. Emergency
   fallback (`RECIPE_CATALOG_MODE=static`, or a D1 fallback) deliberately serves only the 71-recipe baseline; diagnostics
   must show reduced coverage rather than pretend the expanded release is served.
2. **A versioned Catalog Release Manifest** (`packages/recipes/src/import/catalog-release.current.json`, schema v1:
   `releaseId`, `legacyBaselineCount/Fingerprint`, `expectedRecipeCount`, `orderedRecipeIds`,
   `expectedRuntimeFingerprint`, `approvedImportBatches[{batchId, batchHash, recipeCount, releaseBaseCount, …}]`) is the
   reviewed expectation of the COMPLETE D1 catalog. It is composed deterministically (`composeCatalogRelease(legacy,
   approvedBatches)`), ships with the application, is verified by `pnpm recipe:import:check` + tests, and is never loaded
   from a request, header, D1 row, KV or URL. Today it describes exactly the 71-recipe baseline with zero batches, so
   current D1 readiness is unchanged (same fingerprint, same READY result).
3. **Growth-ready readiness** (`assessD1Readiness(baseline, hydration, release)`): manifest must describe this build's
   static baseline (`RELEASE_MANIFEST_INVALID`), zero hydration failures (`CATALOG_DIAGNOSTICS`), count == manifest
   (`COUNT_DRIFT`), ordered IDs == manifest (`ID_DRIFT` / `ORDER_DRIFT`), the legacy prefix byte-equal to `ALL_RECIPES`
   (`LEGACY_BASELINE_DRIFT`, protects the rollback baseline even inside an expanded release), and the full release
   fingerprint (`FINGERPRINT_DRIFT`). Unmanifested D1 growth is never READY.
4. **Import batches are immutable and reviewed.** Each batch carries `schemaVersion`, `batchId`, provenance
   (`sourceType ∈ curated|imported|ai_generated`, `sourceNamespace`, non-empty `sourceReference`, optional `license` /
   `usageNote`), and records with stable `sourceRecordId`, explicit `batchOrder` (0..N-1; physical row order is never
   authority), reviewer-supplied romanized `slug`, `verificationState` and optional `duplicateReview`. Only `reviewed`
   records are publishable. `batchHash = SHA-256(canonicalBatchProjection)` — one function for compile, verify, release
   composition and CLI — commits to schema version, batch identity, full source provenance (license, usage note) and, per
   recipe, batch order, source key, runtime content, provenance, classifications, nutrition evidence and the duplicate-review
   decision; it ignores row order, whitespace, key order, paths, timestamps and diagnostics. Any reviewed-meaning change ⇒
   new `batchHash` ⇒ new `releaseId`; a mutated approved batch fails composition (`BATCH_COLLISION`). The runtime
   fingerprint commits only to runtime recipe semantics, so provenance-only changes alter `releaseId` but not
   `expectedRuntimeFingerprint`. `ApprovedImportBatch` stays compact because the hash commits to everything and the batch's
   `normalized-recipes.json` artifact preserves it for audit.
5. **Deterministic identity:** `imp-` + 16 hex of SHA-256(`sourceNamespace:sourceRecordId`); compatible with the T14C
   media identity rule and outside the `vn-*`/`gl-*` namespaces. Any collision (ID, slug, source, content fingerprint,
   legacy, within batch, across batches) fails closed; IDs are never renumbered.
6. **Ingredient Truth boundary:** exact canonical-ID or exact normalized name/alias match against `CANONICAL_INGREDIENTS`
   only. No substring matching, no invented IDs, no automatic merge of look-alikes; ambiguity and misses are reported
   (bounded candidates) and make the record non-publishable. Units are the closed `StandardUnitSchema`; cuisine/region are
   the closed runtime vocabularies; category stays typed-open; `imageUrl` must be an audited same-origin path (default
   placeholder), never an external URL. **Nutrition is evidence-only and the evidence is never dropped:** macros require an
   `evidence` reference (+ optional ADR-004 `sourceType`, default `imported`); the evidence travels on
   `NormalizedImportRecipe.nutritionEvidence`, in `normalized-recipes.json`, in the batch hash, and is persisted by the
   generated SQL as a per-serving `nutrition_profiles` row (`<recipe-id>_nutrition_v1`, `source_reference` = evidence)
   linked via `recipe_nutrition` at version 1 — reusing the existing ADR-004/ADR-009 model, not a parallel one. The macros
   also fill `recipe_runtime_fields.legacy_*` for the runtime contract. A compiler guard (`NUTRITION_EVIDENCE_LOST`) and a
   renderer invariant make "macros without evidence" impossible in publishable output.
7. **The compiler emits artifacts, never migrations.** Output goes only beneath `.artifacts/recipe-import/` (segment-aware
   containment + symlink defense). `migration.sql` is plain `INSERT` (no `ON CONFLICT DO UPDATE`), data-only, with
   `runtime_order = releaseBaseCount + batchOrder`, explicit ingredient positions, classifications and truthful PENDING
   hero media slots (prerequisite 0035). Promotion into `0036+` and into the committed manifest is a human-reviewed T14F step.
8. **Duplicate detection is bucketed** (hash maps keyed by source, ID, slug, content fingerprint, normalized title per
   cuisine, ingredient signature): O(N + M), never N×M. Semantic candidates require an explicit
   `duplicateReview { decision: "distinct", reason }`; hard duplicates cannot be waived.

9. **Telemetry:** `D1RecipeAuthority.load()` reports a release-manifest load/parse failure as
   `status=error, code=RELEASE_MANIFEST_INVALID` — never as `D1_READ_FAILED`, which is reserved for the content read.

**Consequences:** T14F can grow D1 by promoting reviewed batches and regenerating the manifest without touching
`ALL_RECIPES`, the D1 reader (still 5 statements), the hydrator or the authority router. Readiness reason codes gain
`RELEASE_MANIFEST_INVALID` and `LEGACY_BASELINE_DRIFT` (a field change inside a legacy recipe is now reported as the latter
instead of `FINGERPRINT_DRIFT`). Generated SQL for 5,000 synthetic recipes is ≈7.9 MB, so T14F must plan deterministic
chunking across consecutive migrations with the manifest certifying only the complete release. Cuisine expansion beyond the
six runtime values is an explicit T14F taxonomy decision, not an import-time coercion.

## ADR-026 — Recipe Catalog Authority Routing, Verified D1 Authority, Deterministic Canary and Config-only Rollback (T14D)

**Status:** Accepted 2026-09-16 (architecture merged for review; production remains `static`; no deployment)

**Context:** After T14B-B the D1 recipe catalog is proven parity-equivalent to `ALL_RECIPES` (71 recipes, semantic
`runtime_order`, ingredient ordinals) but only as a shadow oracle; every runtime consumer (`/recipes`, detail,
recommendations, cooking, Week planner/swap, shopping attribution) imported `ALL_RECIPES` directly and the planner had a
hidden `= ALL_RECIPES` default. A future cutover therefore had no single switch, no readiness gate, no canary and no
observable fallback. T14C's production rollout (0035) is still pending and must not be a prerequisite for designing this.

**Decision:**
1. **One authority snapshot per operation.** `RecipeAuthoritySnapshot` (`packages/recipes/src/recipe-authority.ts`:
   `source`, `fingerprint`, `loadedAt`, `size`, `list()`, `findById()`, `findByIdOrSlug()`, id/slug indexes) is resolved
   once per request by `resolveRecipeAuthority(env, { tenantKey })` (`src/worker/services/recipe-authority.ts`) and
   passed to every recipe read in that operation. No route or domain function reads `ALL_RECIPES` directly any more;
   `generateWeeklyMealPlan`/`getSwapAlternatives` require the caller's recipe list. A static guard test keeps
   *unknown runtime readers = 0* (allowlist: static definitions, seed/migration renderers, shadow oracle, browser
   offline fallbacks).
2. **Static remains the rollback oracle and production default.** `StaticRecipeAuthority` serves `ALL_RECIPES` in exact
   order; `RECIPE_CATALOG_MODE` unset/`static` never touches D1 for content. Rollback from any mode is
   `RECIPE_CATALOG_MODE=static` — read routing only, no migration, no data change, no revert.
3. **D1 becomes a selectable authority only when verified.** `D1RecipeAuthority` reuses the T14B-B reader
   (`readRecipeContent`, one five-statement batch) and hydrator (`hydrateRuntimeRecipes`); a snapshot is produced only
   when `assessD1Readiness` passes: zero hydration diagnostics, same count, same IDs, same order, same fields ⇒ same
   fingerprint. Reason codes: `CATALOG_DIAGNOSTICS | COUNT_DRIFT | ID_DRIFT | ORDER_DRIFT | FINGERPRINT_DRIFT |
   D1_READ_FAILED`. T14D is a cutover of authority, not of content: `D1 == ALL_RECIPES` is the contract until a later
   explicit divergence policy (T14E).
4. **Parity fingerprint.** `fingerprintRecipes` = SHA-256 over the canonical, key-sorted projection of the ordered
   `RuntimeRecipe` contract (`RUNTIME_RECIPE_FIELDS`, incl. the legacy `imageUrl` string); stray keys are rejected, and
   `recipe_media`/R2/timestamps are never included — media (ADR-025) is independent and never influences authority.
5. **Modes are a closed set with a fence.** `static | shadow | canary | d1`; typos are `INVALID_MODE`, never coerced.
   `canary`/`d1` require `RECIPE_CATALOG_CUTOVER_ENABLED=true`; `shadow` (T14B-B compare, unchanged) does not.
   Production validation makes invalid/unfenced configuration fatal (`CONFIG_RECIPE_CATALOG_MODE`) and fenced D1
   authority a visible warning (`CONFIG_RECIPE_CATALOG_D1_AUTHORITY`); at request time invalid config serves static with
   an error-level `recipe_catalog_config_invalid` event rather than a 500. Mode is never user-controlled.
6. **Deterministic canary.** `bucket = FNV-1a32("recipe-catalog-canary:" + householdId) % 10000 < percent × 100`
   (`RECIPE_CATALOG_D1_CANARY_PERCENT`, integer 0..100, default 0). Stable per household, monotonic in percent, no
   randomness, no server-side assignment state; diagnostics record the decision, not the id.
7. **Bounded cache and explicit failure policy.** One verified D1 snapshot per isolate, 30 s TTL, singleflight refresh,
   ≤5 min stale grace when a refresh fails (`recipe_catalog_d1_stale_served`). Canary: any non-verified state ⇒ static +
   `recipe_catalog_canary_fallback` (warn). Full d1: emergency static fallback + `recipe_catalog_d1_fallback` (error) —
   availability over purity, never silent. `selectedSource`/`actualSource` always tell the truth.
8. **No migration, no writes, no admin API.** Authority selection is deployment configuration; `recipes*` tables are
   read-only at runtime; `wrangler.jsonc` is unchanged (production stays static until a separate OPS rollout).

**Rationale:** a single typed boundary turns cutover into a config rollout and rollback into a config revert; the
readiness gate makes "D1 is authoritative" mean "D1 is provably the same catalog" rather than "rows exist"; a
deterministic tenant canary gives a real user-visible experiment with a per-household stable experience and a safe
fallback; explicit `actualSource` observability prevents a silent static-while-claiming-D1 state.

**Consequences:** production behaviour is byte-identical today (static). The OPS sequence becomes: apply 0035 →
deploy (static) → `shadow` → fenced `canary` at a small percent → widen → `d1`, each step human-controlled and
reversible by `RECIPE_CATALOG_MODE=static`. Intentional catalog growth beyond `ALL_RECIPES` (T14E) will need a new
readiness policy because the current gate requires exact parity.

## ADR-025 — Recipe Media Authority, Immutable Versioning and R2 Serving (T14C)

**Status:** Accepted 2026-09-16 (T14C media layer infrastructure; no recipe-authority change, no production rollout)

**Context:** After T14B-B, `recipes.image_url` and `Recipe.imageUrl` are `LEGACY_MEDIA_COMPATIBILITY_ONLY`:
59 Vietnamese recipes point at `images.unsplash.com` (blocked by the production CSP `img-src`, only 45
unique references for 71 recipes, 20 duplicates), 12 global recipes point at `/frigo/recipes/global/*`
(one target, `carbonara.webp`, does not exist; several share a file). `scripts/generate-recipe-images.ts`
is a 59-entry Vietnamese prompt manifest with no global coverage and nothing generated. The R2
`IMAGES` binding (`frigo-images` / `frigo-images-staging`) exists but serves only private scan images
under `users/<userId>/scans/…`.

**Decision:**
1. **Media metadata in D1, bytes in R2, never bytes in D1.** Migration `0035_recipe_media_layer.sql`
   (rendered by the pure `renderRecipeMediaLayerSql`, checked by `pnpm recipe:seed:check`) creates
   `recipe_media(id, recipe_id → recipes ON DELETE CASCADE, role, version, status, source_type,
   storage_key, mime_type, width, height, content_length, content_hash, source_reference,
   generator_provider, generator_model, prompt_hash, created_at, updated_at)`. Roles are the closed
   set `hero | thumbnail`; statuses `pending | ready | rejected | superseded`; provenance
   `legacy_static | legacy_external | generated | uploaded | derived | NULL`.
2. **`ready` means "the canonical R2 object is serveable"** — never "a prompt/filename/legacy URL
   exists". SQL enforces: `version >= 1`; `UNIQUE(recipe_id, role, version)`; a partial unique index
   `idx_recipe_media_current_ready (recipe_id, role) WHERE status='ready'` so two current-ready versions
   are impossible; a ready row must carry `storage_key`, allow-listed `mime_type` (`image/webp|avif|jpeg|png`),
   `width/height > 0`, `content_length >= 0` and a 64-hex SHA-256 `content_hash`. The seed writes 71
   truthful `pending` hero slots with no source.
   **Verified promotion (independent-review remediation, 2026-09-16):** `status='ready'` is set only by
   `promoteRecipeMediaVersion(db, images, …)`, which first verifies the actual R2 object at the D1-derived
   key — it exists, `httpMetadata.contentType` equals `mime_type` (absent MIME fails), `size` equals
   `content_length`, and the SHA-256 of the real bytes (one bounded `arrayBuffer()` read, ≤ 16 MiB)
   equals `content_hash`. Typed failures (`OBJECT_MISSING`, `OBJECT_MIME_MISMATCH`, `OBJECT_SIZE_MISMATCH`,
   `OBJECT_HASH_MISMATCH`, `OBJECT_TOO_LARGE`, `OBJECT_READ_FAILED`, `METADATA_INCOMPLETE`) leave the target
   pending and the current ready row untouched. The verification proof is module-private; there is no
   `markReady` bypass. Hashing happens once at promotion, never per public GET.
3. **Deterministic, validated storage keys:** `recipes/<recipe-id>/<role>/v<version>.<ext>` via
   `buildRecipeMediaStorageKey`. SQL enforces the **exact** same derivation
   (`storage_key = 'recipes/' || recipe_id || '/' || role || '/v' || version || CASE mime_type … END`), plus
   rejection of `..`, `\`, leading `/`, `?`, `#`; a key such as `recipes/gl-01/hero/v2.foo.webp` is invalid in
   SQL and in the application alike (`isTrustedRecipeMediaStorageKey`), so no SQL-valid/app-invalid state exists.
4. **Immutable versions.** `trg_recipe_media_ready_immutable_update` forbids changing byte-identity
   columns of a ready row; replacement is a new version (`stageRecipeMediaVersion` →
   `promoteRecipeMediaVersion`, which verifies the object and then supersedes the old ready row and readies
   the new one in one D1 batch whose two statements share the verified-target predicate). Ready storage keys
   must never be overwritten with different bytes in R2: new bytes ⇒ new version ⇒ new key. Versioned URLs
   therefore carry `Cache-Control: public, max-age=31536000, immutable` and `ETag: "<content_hash>"`, which is
   trustworthy because the hash was verified against actual bytes at promotion; unversioned/legacy URLs never
   get immutable semantics.
5. **Same-origin serving only:** `GET|HEAD /api/v1/recipe-media/:recipeId/:role/:version` (public
   read-only, mounted beside `/health`) validates each segment against closed shapes, refuses encoded
   traversal in the raw path, reads trusted metadata from D1, requires `ready` + complete metadata,
   fetches the D1-derived key from `IMAGES`, and rejects object MIME/size disagreement (415/409). No
   request input is ever passed to `IMAGES.get`; there is no generic proxy, no bucket listing, no
   public write route, and no CSP change (`public/_headers` unchanged).
6. **Media is presentation, not content authority.** `RecipeMediaResolver` (`resolveRecipeMedia`) is
   pure with fixed precedence: current ready canonical R2 → audited same-origin legacy static →
   legacy external `imageUrl` → missing. `GET /recipes`, `/recipes/:id` and `/recommendations` attach an
   additive `media.hero {url, source, version, width, height}` **after** `ALL_RECIPES` filtering and
   `rankRecipes` ranking, in one bounded bulk D1 read (`IN (...)` chunks of 90, batched — never N+1).
   `Recipe.imageUrl` is kept. A D1 media failure degrades to legacy presentation with one bounded
   diagnostic; it never changes recipe ids/order/scores or returns 500. Planner, swap, cooking, Week
   snapshots (`IMMUTABLE_PAYLOAD_AUTHORITATIVE`) and Inventory Truth are untouched.
7. **Frontend has one fallback point,** `src/web/lib/recipe-media.ts` (`resolveRecipeImage` +
   `recipeImageErrorHandler`): canonical hero → legacy `imageUrl` → placeholder, applied to every
   recipe image surface; private scan images (`private-image.ts`) remain a separate trust domain.
8. **Generate/import once, serve many.** Population (generation/import, validation, hashing, upload,
   promotion) is a separate offline/admin workflow; nothing generates or fetches media during user
   requests. The prompt manifest stays a pure typed module and is validated against canonical IDs.

**Rationale:** D1 keeps per-version truth queryable and indexable at 5,000+ recipes (`(recipe_id,
role, status)`, partial ready index, `content_hash` for dedupe) while R2 holds bytes cheaply;
same-origin serving fixes the CSP problem without broadening `img-src` to third parties; deterministic
keys plus trust checks make the route incapable of acting as a bucket browser; immutable versions make
aggressive caching safe; keeping `imageUrl` and a fail-safe resolver means the layer can ship before a
single image is populated.

**Consequences:** Production rollout is `0034 → backup → 0035 → deploy → populate separately`; until
population, every recipe still renders its legacy image (12 static, 59 external — the external ones
remain CSP-blocked exactly as today). `PRAGMA integrity_check` cannot run on hosted D1 (SQLITE_AUTH);
`quick_check` + FK check + the extended schema gate stand in. T14D (authority cutover) and T14E (bulk
import) remain unstarted; 0034 is now pinned in `tests/fixtures/migration-sha256.json`.

## ADR-024 — Typed runtime fields, fail-closed D1 hydration and static-default shadow mode (T14B-B)

**Status:** Accepted 2026-09-16 (T14B-B parity/shadow foundation; no authority change)

**Context:** T14B-A proved D1 held 59 complete recipes while runtime served 71, and that the
foundation `RecipeDefinition` omits `category`, `region`, `imageUrl`, `nutrition`, `steps`,
`tags`. 0006 smuggled category/region into `recipes.tags` as `cat:`/`region:` markers.

**Decision:**
1. Migration `0034_global_recipe_catalog_parity.sql` (rendered by the pure
   `renderGlobalRecipeParitySql`, checked by `pnpm recipe:seed:check`) seeds exactly the 12
   static-only global recipes under their stable static IDs/slugs with `ON CONFLICT DO UPDATE`
   so an existing cooking/shopping FK anchor is upgraded in place, never duplicated or
   re-identified. Provenance stays at the schema defaults `legacy/unverified/1`.
2. `recipe_runtime_fields` is the typed, queryable, indexed home for runtime-only fields:
   `category` (typed **open** field: any non-empty string, CHECK `length(trim(category)) > 0`),
   `region` (**closed** vocabulary: CHECK `IN ('bac','trung','nam','toan_quoc')`), the canonical
   `runtime_order` (0-based position in `ALL_RECIPES`, UNIQUE, NOT NULL) and `legacy_*` nutrition
   macros. The macros are a **legacy compatibility projection**, not `nutrition_profiles` evidence
   (ADR-004/ADR-009 remain the authoritative model). `recipes.image_url` stays
   `LEGACY_MEDIA_COMPATIBILITY_ONLY` (media authority deferred to T14C). Category/region are never
   hidden in JSON or in `recipe_classifications`.
3. Catalog order is **behaviourally significant** (`rankRecipes` ties, the weekly planner's stable
   score sort and `getSwapAlternatives`' first-five candidate subset all resolve by input order),
   so it is persisted, not inferred: `StaticRuntimeRecipeCatalog` preserves `ALL_RECIPES` source
   order verbatim (never sorts), and `D1RuntimeRecipeCatalog` emits recipes by persisted
   `runtime_order` — it never reorders itself by consulting the static list. Ingredient order uses
   an explicit ordinal representation, `recipe_runtime_ingredient_order(recipe_ingredient_id PK,
   recipe_id, position)` with `UNIQUE(recipe_id, position)`, 0-based; lexical row IDs
   (`_ing_1, _ing_10, _ing_2…`) are never an ordering source.
4. `hydrateRuntimeRecipes` reconstructs `RuntimeRecipe` from one five-statement read-only batch
   and fails closed per row (FK stub, foundation-invalid, missing steps/media/fields, marker
   conflict, unknown region/cuisine, duplicate IDs/step numbers, missing/invalid/duplicate
   `runtime_order`, missing/invalid/duplicate ingredient `position`); it never defaults or
   fabricates. `StaticRuntimeRecipeCatalog` and `D1RuntimeRecipeCatalog` share one interface.
5. `RECIPE_CATALOG_MODE` is `static` (default) or `shadow`; there is no `d1` value. Shadow runs
   an off-response D1 comparison at most once per isolate per
   `RECIPE_CATALOG_SHADOW_INTERVAL_MS` (default 60 s, clamped 1 s–24 h) and emits one PII-free
   diagnostic. Healthy requires `staticOnly = d1Only = drift = orderDrift = hydrationFailures = 0`;
   any non-zero count (including order drift) logs at `warn`. D1 failure is a recorded
   `shadow_error`. Production configuration rejects any non-static value.
6. Historical Week slot snapshots (full recipe payloads) remain authoritative for historical
   plans; D1 never re-interprets them (`SNAPSHOT_POLICY=IMMUTABLE_PAYLOAD_AUTHORITATIVE`).

**Rationale:** Parity must be measurable before any cutover. Typed columns keep category/region
queryable at 5,000+ recipes without a second taxonomy; the compatibility nutrition table avoids
inventing provenance; fail-closed hydration prevents invalid persisted state from looking like a
recipe; a static-only production mode keeps user-visible behaviour byte-identical.

**Consequences:** Drift report reaches 71/71 with `nutrition.representation=legacy_compatibility`,
classification `typed_runtime_field` and `orderDriftCount = 0`. Recommendation, planner
(generate/regenerate/swap, including tie-sensitive and >5-alternative swap fixtures) and cooking
paths are proved equivalent on the **actual** `D1RuntimeRecipeCatalog.listRuntimeRecipes()`
output — with no test-side reordering — but stay wired to `ALL_RECIPES` (static remains the
production authority). Offline
reads remain bundle-resident; a cutover (T14D) must provide an offline source. Cuisine taxonomy
stays deferred (`LONG_TAIL_CUISINE_TAXONOMY_DEFERRED`) before T14E.

## ADR-023 — Runtime recipe contract, catalog completeness and immutable seeds (T14B-A)

**Status:** Accepted 2026-09-15 (T14B-A safety foundation; no runtime change).
Imported unchanged from source PR #8's ADR-022, renumbered during canonical
reconciliation because PR #9 already owns ADR-022 for Auth/OCR. That production
decision is preserved; this is a numbering change, not a design change.

**Decision:**
1. The foundation `RecipeDefinition` is NOT by itself the production runtime recipe
   DTO. The complete runtime shape is formalized as `RuntimeRecipe`
   (`packages/recipes/src/runtime-recipe.ts`), structurally identical to the legacy
   `Recipe`; `RUNTIME_ONLY_FIELDS` (`category`, `region`, `imageUrl`, `nutrition`,
   `steps`, `tags`) names exactly what the foundation contract omits.
2. Any future D1-backed reader must reproduce `RuntimeRecipe` losslessly for every
   current recipe; lossy adaptation is allowed only into the foundation catalog for
   validation/planning.
3. A D1 `recipes` row is not automatically a catalog entry. `classifyCatalogEntry`
   yields `complete` / `incomplete` (with `fkStub`) / `rejected`; the 7-column
   cooking/shopping FK anchor shape is always `incomplete`+`fkStub` and is excluded
   from catalog reads and never auto-repaired.
4. Runtime recipe authority remains static `ALL_RECIPES` throughout T14B-A/B; D1 is
   shadow data audited by `auditCatalogDrift`.
5. Applied migrations are immutable. Normal tests (`pnpm test`, `pnpm check`) may
   never write tracked source or `migrations/`; seed regeneration is an explicit,
   maintenance-only command that refuses to write inside `migrations/`.
6. Recipe media is a separate concern deferred to T14C; `image_url` is not a
   completeness criterion and the runtime contract keeps `imageUrl: string`.

**Rationale:** T14A proved the static catalog is production truth, the foundation
model drops runtime-visible fields, FK stubs already exist in D1, and a test rewrote
an applied migration. Making these boundaries explicit and test-enforced first makes
the later data-parity migration (T14B-B) deterministic and reversible.

**Consequences:** No route, planner, cooking, inventory, AI or CSP behavior changes.
Current drift stays truthfully visible (12 global recipes static-only, nutrition
unrepresented in D1). Contract widening fails `RuntimeRecipeSchema.strict()` tests.

## ADR-020 — Recoverable OCR provider selection and quality-gated queue failures

**Status:** Accepted 2026-09-12 for the OCR production-recovery candidate; this
record is not a production deployment receipt.

**Context:** The deployed application lineage is anchored to `d1b06732`, while
the current recovery worktree must handle provider model retirement, malformed or
placeholder vision output, and queue retries that cannot repair a permanent
configuration or data-quality failure. OCR remains an untrusted draft source and
must not become an authority for inventory quantities, prices or safety claims.

**Decision:** The recovery candidate keeps `AIRouter` as the single provider
boundary and makes Qwen `qwen3.7-flash` the first provider for vision, receipt
OCR, chat and ranking through the DashScope international OpenAI-compatible
endpoint (`QWEN_BASE_URL`, `QWEN_MODEL`). Structured requests disable thinking
to bound OCR latency. Groq remains a legacy compatible fallback only when
`GROQ_FALLBACK_ENABLED=true`; native Cloudflare vision is added only when
`CLOUDFLARE_VISION_FALLBACK=true`. DeepSeek remains the optional text/ranking
fallback only when `DEEPSEEK_FALLBACK_ENABLED=true`, and Z.ai/GLM the optional
vision/text extension path only when `GLM_FALLBACK_ENABLED=true`. The deployed
SHA is not changed by this record. Production mock fallback remains disabled.

Every fridge or receipt result is parsed through the existing Zod contracts and a
quality gate that removes generic/placeholder labels and confidence below `0.6`;
an empty usable set returns `AI_SCAN_NO_USABLE_ITEMS`. Providers expose typed
errors with retry intent. `MODEL_NOT_FOUND`, `AUTHENTICATION_FAILED`,
`PERMISSION_DENIED`, `LICENSE_REQUIRED`, `SCHEMA_VALIDATION`, `INVALID_RESPONSE`
and `AI_SCAN_NO_USABLE_ITEMS` are permanent. `REQUEST_TIMEOUT`, `NETWORK_ERROR`,
`RATE_LIMITED` and `UPSTREAM_ERROR` may retry within the existing queue attempt
limit and dead-letter flow. Public scan responses expose bounded, actionable
failure codes without provider credentials or raw image data.

**Consequences:** This is a code/config recovery with one additive D1 migration
(`0023_scan_request_fingerprint.sql`) and no data backfill, inventory/auth/Week/
PayOS change or automatic production deployment. The migration must be applied
and schema-gated before deploying code that reads the new scan identity columns.
The existing queue lease, idempotency, tenant fencing and rollback rules remain
authoritative. Candidate model access, provider licensing, exact-SHA CI, canary
health and readiness must be verified before release. OCR output still requires
human review/confirmation and does not create trusted retail offers.

The initial 20-25 second timeout was insufficient for full-page receipt OCR: a
production-sized Vietnamese receipt took about 51 seconds in a non-PII Qwen
smoke. The candidate therefore uses a 60 second Qwen request timeout and a 75
second Worker/queue guard, while retaining the existing 10 minute queue lease.

**Alternatives considered:** Retrying every provider error, silently falling back
to mock fixtures in production, or treating any syntactically valid OCR line as
usable. Rejected because retries cannot fix permanent provider/configuration
failures and fabricated or low-quality rows could enter a household draft.

## ADR-019 — T07 planner-wide best-effort account compute budget

**Status:** Accepted 2026-09-09 after authenticated fan-out reproduction.

**Decision:** Add one planner-only `planner-compute:<authenticated-user>` bucket
at 10 requests per 60 seconds for generation, regeneration, swaps, shopping and
on-demand explanations, alongside existing per-path controls. Keep read/feedback,
auth and payment policies unchanged. Reuse the installed limiter rather than
introducing a quota/reservation platform.

**Evidence and consequences:** Alternating two plan IDs previously admitted an
eleventh compute request; regressions now reject it before T04. KV read/put remains
non-atomic and eventually consistent, with same-key write throttling and explicit
isolate-local fallback. Neither fail-closed nor the account key promises an exact
global quota. Keep hard per-request search bounds and staged rollout; require a
separate recovery-safe atomic design only if measured abuse demands it. Exact
tests, guarantees and Cloudflare references are in `T07_H2_ABUSE.md`.

## ADR-018 — T06B opt-in presentation and minimal plan discovery

**Status:** Accepted 2026-09-09 for the authorized T06B task.

**Decision:** Reuse React Router, TanStack Query, owner-fenced cookie transport,
existing cards/buttons/dialogs and Frigo colors. `VITE_MEAL_PLANNER_ENABLED=true`
enables `/planner`; the independent server flag remains authoritative. Legacy Week
is retained. The browser sends scheduling/action intent, never engine contexts,
shortages or prices. Queries are owner-scoped, mutations are explicitly triggered,
revision-fenced and not retried automatically. Swap/regenerate replace the entire
plan response and discard previous shopping results. Past plans remain historical;
creating a new future plan is explicit rather than silently editing past meals.

T06A lacks cross-device discovery and a named swap-choice source. Add only a
creator/household-scoped current-plan lookup and a bounded read-only recipe-title/ID
catalog projection. Choices are not eligibility claims: the unchanged swap service
checks restrictions and replans. No new persistence or engine algorithm is needed.

Optional on-demand AI may reorder/select only server-grounded reason IDs. It returns
no factual prose, tools or commands. Schema/subset validation, a bounded timeout,
feature disable and deterministic fallback keep structured facts separate and safe.
Frontend vi/en text templates display the same reasons without any AI dependency.
Exact money is formatted through BigInt/Intl parts; authoritative arithmetic stays
on the server. Shopping checkboxes are ephemeral reminders, not purchases.

**Consequences:** No frontend plan-content persistence or UUID entry needed for
restoration. No full history/candidate-eligibility API, private recipe authoring,
generated recipes, payment or production cutover. Preview fixtures use isolated
in-memory D1 and real test sessions; they never install a production auth bypass.
T07 owns deferred aggregate quotas and final security/performance review.

## ADR-017 — T06A trusted backend and minimal current-plan persistence

**Status:** Accepted 2026-09-09. Supersedes ADR-016's combined delivery scope;
its frontend/AI presentation portions are deferred to T06B.

**Decision:** An opt-in Hono application boundary accepts scheduling/action intent
only. Existing cookie/CSRF/tenancy/rate-limit infrastructure remains authoritative.
One D1 batch preloads catalog, household inventory, typed T03 preferences/history,
nutrition and instructions; only server composition creates opaque T02–T05 contexts.
No request/AI plan, price, shortage, substitution review or safety assertion is accepted.
Missing reviewed safety/retail sources stay missing; no legacy benchmark promotion.

Keep final generated plans private to the authorized creating member because T03
personalization is private. Legacy Week storage is incompatible and remains intact.
Add minimal current-plan/annotation tables (0022), membership composite FKs, scoped
creation retry keys and atomic optimistic revision updates. Persist versioned,
validated final DTO plus a narrow T05 input projection, never search state, opaque
handles, ranking context or reviewer evidence. This changes only T05's accepted
input projection/codec, not arithmetic or optimizer policy. Exact money and quantity
strings cross the API boundary, with known/unknown and proof metadata preserved.

Swaps establish server-validated locks and replay the entire plan from current
inventory, rather than patching one slot. If the bounded search cannot produce a
complete valid replacement, leave the current revision unchanged. Regeneration may
return valid partial/incomplete results. SHA-256 source comparisons expose practical
staleness, not reservations. Shopping is generated on demand from plan ID/revision
and refuses stale source/time; no stale shopping cache or purchase command exists.

**Consequences:** No revision-history platform or distributed command ledger. Exact
creation retries avoid repeated planning after a completed write, but simultaneous
first requests may both compute before one durable result wins. Existing rate
limits are per account/path and best-effort under KV degradation; aggregate quotas
remain T07. Cooked annotations do not fabricate actual cooked history or consume
stock. T06B consumes only `meal-planning-api.ts`, `meal-shopping-api.ts` and
`API_INTEGRATION.md`; new endpoints do not replace legacy Week, settings or cooking.
No PayOS, authentication redesign, production deployment or AI work is authorized.

## ADR-016 — Authenticated generated-plan integration and bounded AI presentation

**Status:** Accepted for T06 implementation, 2026-09-09

**Decision:** Extend the existing Hono/session/CSRF/tenant boundary and React
application through an explicit `/planner` route; legacy Week remains unchanged.
The application service loads D1 catalog, household inventory and scoped T03
preferences/history before invoking T04 and T05. Client requests express intent,
never authoritative inventory, shortages, prices, reviews or domain contexts.
Missing retail offers remain missing; legacy benchmarks/OCR are not trusted quotes.
Absent whole-dish safety reviews cannot satisfy hard safety constraints.

Persist final generated-plan revisions separately from incompatible legacy Week
rows. Plans are private to their creating member within the authorized household
because T03 personal preferences/history are private. Revision writes use optimistic
concurrency and idempotency; reads reauthorize and expose source staleness. Swap and
explicit regeneration replay sequential planning, never patch downstream stock
arithmetic. Marked-cooked annotations do not consume stock or fabricate actual
`cooked_meals` history. No inventory acceptance or legacy cutover is introduced.

Versioned allowlisted DTOs expose exact decimal quantity strings and minor-unit
money strings, preserving uncertainty and best-known versus proven conclusions.
AI is independently disabled by default and requested on demand only. It may choose
among grounded presentation templates, not generate authoritative factual prose.
Its bounded schema, provider timeout and deterministic fallback are independent of
planning. No long-tail recipe publication or private recipe authoring is introduced.

**Consequences:** An additive revision/annotation migration is justified by durable
API identities, not a second optimizer. No search frontier is persisted. Existing
rate-limit infrastructure supplies abuse control, not a globally atomic paid quota.
Full source revalidation is required before any future acceptance/cooking adapter.
The T05 option cap remains ID-order-sensitive; T07 should audit selection quality
without changing the best-known/proof distinction. No payments, deployment or
unrelated authentication/infrastructure changes are authorized.

## ADR-015 — Trusted, generated-only economic evaluation of the fixed T04 plan

**Status:** Accepted 2026-09-09 (T05)

**Decision:** T04 per-slot deficits are the sole purchase-demand authority; no second
stock deduction or hidden replanning loop. Reuse exact T02 Quantity arithmetic.
Legacy VND benchmark/package tables lack a trustworthy offer-price relationship,
so accept a validated opaque server-owned, household-scoped price/package snapshot
without a new retail persistence platform. Currency is explicit; safe-integer minor
unit inputs, BigInt monetary arithmetic and decimal-string outputs prevent rounding
and overflow. Stale/estimated/foreign/unpriced observations remain qualified unknowns.

Use bounded iterative per-ingredient package enumeration plus additive aggregation.
Cost-first is the default; an explicit dimensionless cost-premium policy may reduce
surplus without absurd spending. Hard budgets constrain those upgrades; soft targets
only diagnose. Expose best-known versus exhaustive minima, and derive infeasibility
only from proven lower bounds that account for unknown-price alternatives. Keep
T04, shopping and budget feasibility/search completeness separate.

Surplus is not certain waste. Report existing remainder and new purchase surplus
separately using only dated expiry evidence; unknown risk remains unknown. No
global optimal-waste/allocation claim. See `SHOPPING_OPTIMIZER.md` for full proof,
limits, exact money fields, trust/temporal semantics and T06 output.

**Consequences:** No schema migration, live pricing, FX, route/UI cutover, real
inventory mutation, actual purchase or payment. Existing Week/standalone shopping
stays unchanged. This task's explicit no-replanning directive supersedes the older
T05 packet's proposed feedback loop; future orchestration must explicitly invoke
T04. Trusted catalog providers must authorize/review offers; a callback wrapper
does not turn client price/product/safety claims into authority.

Entries identify the task in which they were accepted. Supersede an ADR explicitly; do not silently rewrite
the agreed architecture. Later tasks must record migration and compatibility impact.

## ADR-001 — Extend existing identities and runtime boundaries

**Status:** Accepted 2026-09-08

**Context:** D1 and static catalogs already model ingredients/recipes. Inventory
and Week have household isolation, command fencing and compatibility migrations.
Replacing these for a new greenfield planner would duplicate or break live behavior.

**Decision:** Extend existing tables/IDs additively. Keep Ingredient, Inventory Item,
Retail Product, Recipe/line, Family, Nutrition, Preferences, Plan and Shopping as
separate concepts. Keep static normalization/`ALL_RECIPES` readers and all current
routes unchanged in T01. New catalog helpers are explicit library calls, not APIs.

**Consequences:** T01 data is not automatically visible in old screens. T02 needs
an explicit audited catalog adapter and import/drift policy; no hidden dual source
switch. Household commands, Week dual-write and old DTOs stay compatible. Leaf
foundation imports avoid expanding the existing domain/recipe barrel cycle.

**Alternatives considered:** New ingredient/recipe replacement tables; wholesale
ORM migration; immediate D1 runtime cutover. Rejected as unnecessary risk/scope.

## ADR-002 — Multilingual exact alias keys, explicit ambiguity

**Status:** Accepted 2026-09-08

**Context:** Existing aliases are loose strings; runtime uses first substring
matches. SQL cannot reliably perform full Unicode normalization on historical data.

**Decision:** Preserve raw aliases, add canonicalized language and nullable
normalized key. App uses NFKC/whitespace/lowercase, preserving accents. Unique
non-NULL `(language, normalized_alias)`; look up exact locale plus `und` and fail
closed as ambiguous if more than one ingredient matches. Atomic authoring also
indexes localized/default names. Preserve old NULL keys for reviewed promotion.

**Consequences:** Locale collisions are rejected; cross-locale/und ambiguity is
represented, not resolved by insertion order. Japanese works without a special
schema; retail quantity stripping/fuzzy NLP/automatic locale fallback wait. New
SQL writers must follow application normalization. No destructive alias backfill.

**Alternatives considered:** Global unlocalized alias uniqueness, accent folding,
SQL `lower()` backfill, first-match fuzzy resolution. Rejected for false matches.

## ADR-003 — Physical dimensions versus contextual retail quantities

**Status:** Accepted 2026-09-08

**Context:** Strict conversion already exists alongside a legacy numeric fallback.
Retail packages and count units lack universal mass/density.

**Decision:** Preserve `StandardUnit` and strict helpers. Add mirrored unit reference
data/typed dimensions: mass g/kg, volume ml/l, piece count, contextual pack/bunch/
slice. Only exact physical factors are universal; contextual identity is not proof
that two differently sized packages can be pooled.

The SQL catalog constrains codes/dimensions/bases/factors to this supported set;
adding a unit requires a matching typed change and migration, not an arbitrary row.

**Consequences:** No arbitrary onion/egg/package-to-gram conversion. Product-specific
content/estimates and rounding policy belong to T05. Tests detect SQL/type drift.
No change to legacy inventory conversions or guarded cooking commands.

**Hardening clarification:** `areUnitsCompatible`/`convertUnitStrict` accept
same-unit quantity identity, not proof of physical equivalence. `pack -> pack`
and `slice -> slice` count the same defined package/slice context; `piece -> piece`
counts the same canonical item. Neither proves mass, volume, or equivalence across
different product sizes. `UNIT_DEFINITIONS.dimension` distinguishes those cases.

**Alternatives considered:** Convert all units to grams; introduce a generic
conversion graph now. Rejected as unsafe or speculative.

## ADR-004 — Explicit nutrition basis, provenance and unknown safety state

**Status:** Accepted 2026-09-08

**Context:** Runtime recipes have optional unproven macro totals; no ingredient
nutrition schema or structured allergen evidence exists.

**Decision:** Store nullable nutrient observations in independent basis-aware
profiles (kcal/g/mg), linked to ingredients or recipe versions. Distinguish
authoritative/imported/calculated/estimated with a reference. Separate ingredient
allergen/dietary assertions from unknown/reviewed state and recipe classifications.

**Consequences:** NULL is not zero; absence of tags is not safe. Existing macros
are not promoted or reinterpreted. Later code chooses trusted applicable profiles
and current recipe version; authoritative labeling alone is not verification.
No complete nutrition database, nutrient calculator or allergy guarantee in T01.
ADR-009 clarifies and enforces that only the current recipe version is stored.
Missing dietary assertions also remain unknown; no meat tag is not evidence of
vegetarian suitability. Imported/AI classifications are not an allergy authority.

**Alternatives considered:** Unqualified totals on recipes, JSON nutrition blob,
implicitly safe empty tags. Rejected for arithmetic/safety ambiguity.

## ADR-005 — Families as bounded relational slots and options

**Status:** Accepted 2026-09-08

**Context:** Structured recipe lines exist, but modeling every fried-rice variation
as a separate dish scales poorly and obscures canonical identity.

**Decision:** Families define base servings and min/max selection slots; options
carry canonical ingredient, quantity and unit. Recipes optionally reference a
family. Core recipe quantities/servings remain existing relational fields; add
provenance/version/review fields and descriptive classifications.

**Consequences:** FK/unique/check constraints plus full-object validation protect
authoring. Families require an atomic complete write; SQL alone cannot enforce
aggregate option counts. T02 owns bounded generation and coherent instructions;
options are not arbitrary safe substitutions. Current global source metadata does
not create private user recipe ownership/publication authority.

**Hardening clarification:** Finite slots do not bound computational work. T02
must enforce `MAX_VARIANT_CANDIDATES_PER_FAMILY` (initial default 64) and
`MAX_VARIANT_SEARCH_STATES_PER_FAMILY` (initial default 1024) while exploring, not
after constructing the Cartesian product. Reaching either budget must return
deterministic truncation metadata, not a false claim of exhaustive infeasibility.
These are T02 requirements, not a generator or runtime policy implemented in T01.

**Alternatives considered:** Unstructured JSON templates, EAV rule engine, storing
all variations. Rejected for weak referential integrity or premature complexity.

## ADR-006 — Lot condition evidence without inventory rewrite

**Status:** Accepted 2026-09-08

**Context:** Inventory has storage/expiry but no date kind/source or opening evidence.
Rewriting inventory commands would threaten event/revision/idempotency guarantees.

**Decision:** Add nullable opening timestamp and unknown-default expiry kind/source
to existing lots; separate sourced ingredient/storage/package-state shelf-life
guidelines. Do not backfill guesses or expose side-channel writes in T01.

Non-unknown expiry evidence requires a date in both the combined validated input
and future-write SQL triggers. Removing that date must reset its evidence atomically.

**Consequences:** Existing HTTP projections remain unchanged. A future validated
condition endpoint must share the inventory command transaction/version. Guidelines
are advisory, not lot expiry; unknown opening does not imply sealed. Timezone and
expiry-priority logic wait for T03/T04.

**Alternatives considered:** Recompute every expiry from ingredient defaults or
infer source from `data_source`. Rejected as potentially unsafe historical rewriting.

## ADR-007 — Deterministic core and repository-owned delivery protocol

**Status:** Accepted 2026-09-08

**Context:** Future agents cannot rely on this task's conversation; current AI and
planner overlap later work, but neither is a complete safe optimizer.

**Decision:** Persist specification, ADRs, current reality, task graph and fixed
handoff in `docs/ai`; root AGENTS points there. Deterministic code/DB enforce stock,
constraints, allergies, expiry and budgets. AI only proposes/explains validated
data after the deterministic core is stable. Deliver T01–T07 incrementally.

**Consequences:** All seven task packets describe explicit incremental improvements,
not a replacement platform. Update state/board/handoff after every task and report
exact checks/failures. Older security reports remain linked historical references.

**Alternatives considered:** Chat-only handoff, prompt-only/LLM planning, a single
large implementation task. Rejected for recoverability and correctness risk.

## ADR-008 — Strict canonical ingredient identity, separate from catalog IDs

**Status:** Accepted 2026-09-08 (T01 hardening)

**Context:** All 45 seeded D1 ingredient IDs, all 45 static ingredient IDs, and
385 static recipe ingredient references (43 distinct IDs) use uppercase ASCII
snake case. The general `CatalogIdSchema` and case-sensitive SQL primary key
previously allowed a separate `chicken_breast` beside `CHICKEN_BREAST`.

**Decision:** Canonical ingredient IDs must match `^[A-Z][A-Z0-9_]*$`, be at most
100 characters, and contain no surrounding whitespace or implicit coercion.
Use a dedicated `CanonicalIngredientIdSchema` for catalog authoring, alias target
IDs, storage guidelines, recipe lines and family options. Recipe/family/profile
IDs, slugs and locale keys retain their existing distinct contracts. SQL guards
reject invalid ingredient INSERTs and ID UPDATEs, including NULL and embedded NUL.

**Consequences:** Importers must explicitly map external IDs to existing canonical
identities; do not uppercase unknown IDs or derive them from translations. No
existing legitimate seed/catalog ID changes. Published/applied 0019 is immutable;
append 0020. Its preflight stops on invalid existing IDs without renaming, merging
or deleting rows. The catalog owner must review any failing data before retrying.

**Alternatives considered:** Case-insensitive uniqueness with case-flexible IDs;
automatic uppercasing/backfill. Rejected because every current legitimate ID
already follows one strict convention and coercion would hide import mistakes.

## ADR-009 — Nutrition links belong only to the current recipe version

**Status:** Accepted 2026-09-08 (T01 hardening; clarifies ADR-004)

**Context:** T01 has one row per recipe, not historical recipe-version identities.
The positive `recipe_nutrition.recipe_version` check alone allowed impossible or
stale links, despite readers being instructed to select the current version.

**Decision:** Every nutrition link must equal its parent recipe's current version.
0020 guards link INSERT/UPDATE and blocks parent version changes (including
replacement INSERTs) while dependent nutrition links remain. To revise a recipe,
explicitly unlink its nutrition, update the recipe/version, then link newly
validated profiles in one D1 batch. Failure rolls the entire batch back. Profiles
are retained; nothing is implicitly relabeled or recomputed.

**Consequences:** No historical recipe version support is implied. Preflight
rejects existing mismatches for owner review rather than dropping evidence or
guessing a version. Deleting a recipe still intentionally cascades its links;
linked profiles themselves remain protected from deletion by foreign keys.

**Alternatives considered:** Historical recipe-version tables or automatic link
version updates. Rejected as out of scope or liable to attach stale nutrition to
changed ingredients/servings.

## ADR-010 — Traceable imported and AI recipe provenance

**Status:** Accepted 2026-09-08 (T01 hardening)

**Context:** Source type and verification were independent, but imported/AI
recipes and families could omit all traceability.

**Decision:** `imported` and `ai_generated` recipes/families require a nonblank,
NUL-free source reference. Legacy/curated/user-generated references are optional
(omitted/SQL NULL); any supplied reference must also be nonblank and NUL-free.
An internal dataset-row, import-batch or generation-job ID suffices; no public URL
is required. Zod and 0020 INSERT/UPDATE guards enforce these presence rules,
including Unicode whitespace. Zod additionally bounds authoring text lengths.
Family source types still exclude `legacy`; defaults remain legacy/curated,
unverified, version 1. A reference never confers verification or publication rights.

**Consequences:** Preflight rejects opaque existing imports/AI rows without
inventing references. Catalog owners must supply authentic evidence before retrying.
Global references must not contain private user data or credentials. No import,
generation, ownership or review endpoint is implemented in T01.

**Alternatives considered:** Require public URLs or a full provenance subsystem;
infer traceability from source type. Rejected as unnecessary or unauditable.

## ADR-011 — Indexed quantity feasibility, not runtime ranking or consumption planning

**Status:** Accepted 2026-09-08 (T02)

**Decision:** Add a reusable leaf availability index and per-candidate reservation
session. Re-export unchanged strict unit semantics from a leaf module to avoid
barrel cycles. Aggregate compatible physical lots and canonical piece quantities;
contextual package labels alone never prove equivalent contents. Preserve explicit
missing/partial/unresolved/satisfied outcomes and diagnostics. Duplicate identical
lot IDs count once; conflicting/invalid related stock is quarantined as uncertainty.
Use exact decimal rational intermediate arithmetic and explicit finite Number
boundaries; arithmetic range failures are reported, never coerced to zero coverage.

Aggregate repeated compatible requirements before serving scaling, retain source
line indices and units (mixed physical units use their base). Preserve mathematical
fractional pieces with an explicit flag: existing T01 quantity contracts allow
fractions. No hidden whole-item/purchase rounding or Week portion optimizer.
Reserve direct required demand first, then approved substitutions, then optional
demand. Lot-ID order is only a reproducible feasibility witness, not FEFO, actual
stock consumption or a multi-meal simulation. Each candidate starts independently.

Caller supplies an explicit as-of date and authorized household-scoped inventory.
Past use-by is unavailable; past best-before is not automatically unsafe; elapsed
unknown/estimated dates require review and remain uncertain. Freshness rescue flags
are carried as raw witness facts, not recalculated/weighted expiry priorities.

**Consequences:** Legacy recipe scoring, static readers, cooking commands and Week
behavior stay unchanged pending their explicit integration tasks. New functions
claim quantity feasibility only, not nutrition/allergy certification. No migration,
API, UI, payment/auth or production configuration change is required.

## ADR-012 — Explicit one-hop substitutions and bounded family traversal

**Status:** Accepted 2026-09-08 (T02)

**Decision:** Substitution rules are explicit reviewed, source-referenced quantities,
scoped to a recipe/family ID and version. Every use needs per-call approval and
positive compatibility evidence for every active constraint; missing evidence
denies use. Rules express the replacement amount per original unit, including
partial replacements, never inferred food density. No contextual conversions,
transitive substitutions, preferences or learned rules. Deterministic rule-ID order
does not claim globally optimal allocation among competing substitutes.

Family traversal is lazy with the ADR-005 limits enforced during attempted partial
states, including rejected branches; callers may lower but not exceed 64 candidates
or 1024 states per family. Canonicalize slot/options and semantic aggregate demands;
contextual demands retain separate lines and slot identities because equal labels
do not prove equivalent contents. Retain selected-slot evidence and do not persist
variants. A selected optional-slot
option is required within that variant; omission is its separate zero-selection
choice. Never emit a zero-demand variant. Truncated searches do not prove no
feasible variant exists. Family instructions/cuisine/times absent in T01 stay absent.

**Consequences:** T03 can consume structured requirement facts without repeating
inventory math. D1/static catalog snapshots remain explicit internal read-only
sources; drift/alias promotion proposals require review, not automatic writes or
runtime cutover. No new persisted substitution or variant schema is needed.

## ADR-013 — Scoped deterministic ranking, not legacy runtime cutover

**Status:** Accepted 2026-09-08 (T03)

**Decision:** Consume unmodified server-generated T02 snapshots, bound to household
and explicit calendar date, before hard gates and normalized weighted utility.
Keep T02 arithmetic untouched; add only existing family/prep metadata and a private
scope/fingerprint guard rejecting serialized or mutated candidate inputs. Candidate
review keys additionally bind demands, substitutions and lot witnesses. Review
schemas validate structure, not authority; server-owned approval/review data remains
mandatory. Unknown active hard safety/time/nutrition requirements fail closed.
No safety policy requested is not a safe-food claim. See `RANKING_ENGINE.md` for
exact scores, bounds, policy configuration, dates and nutrition source limitations.

Persist ranking-specific household and member preferences/feedback because legacy
global preferences/favorites cannot enforce household scope and Week settings are
not ranking policy. Do not auto-import global/free-form intent. Personal soft
defaults replace household defaults; hard restrictions union. Household defaults
are owner-managed, personal data membership-bound. Existing `cooked_meals` remains
the only cooking history authority; no new cooking events/commands or automatic
Week skip/swap capture. Explicit latest tastes outrank weak behavioral feedback;
cooked meals affect recency only. No separate taste aggregate or learned model.

**Consequences:** Additive persistence with canonical FKs and bulk readers, no
legacy route/ranker cutover. Static-only feedback targets require explicit reviewed
D1 registration. No safety catalog is fabricated. Nutrition adapters preserve
partial serving-basis observations as unverified; hard ranges require independently
reviewed evidence. Expiry normalizes existing allocation shares, never reallocates
stock. T04 receives candidate utility/components, not future meal decisions.

## ADR-014 — Bounded sequential planning over the T02/T03 dependency

**Status:** Accepted 2026-09-08 (T04)

**Decision:** Add an explicitly invoked, pure weekly planner. Each ordered slot
regenerates T02 availability on branch-local projected inventory and invokes T03
hard eligibility/utility with trusted server-owned context. Deterministic bounded
beam search keeps alternative futures; hard constraints never become score penalties.
Expose recipe-search and planner-search incompleteness separately. A failed bounded
search is not proof of infeasibility. No production Week/API cutover or inventory
write is performed; T06 owns an authenticated shadow/canary integration.

Reuse exact Quantity arithmetic and T02 lot witnesses. An opt-in expiry-priority
allocation order supports projected consumption while preserving T02's default
ID-order behavior. Only explicit supported expiry evidence affects priority; T02
availability remains authoritative. Servings use T02 scaling without count rounding.
One offset-bearing planning instant derives its local date and each slot's instant
using the same fixed offset, with no inferred timezone or DST rules. Actual history
is frozen at the planning instant; future choices are plan-local, not cooked events.

T03 scores cover past-relative preference/expiry/time; additional plan terms cover
future repetition, ingredient continuity and period nutrition only. Period nutrition
targets explicitly concern household totals over requested meals, not invented daily
meal allocations. Unknown/unreviewed hard nutrition fails closed. Leftover scheduling
is deferred because legacy leftovers lack a trusted prepared-food expiry policy;
every selected meal cooks and consumes its requested servings, without hidden excess.

**Consequences:** Output includes selected demand/witnesses, shortages, per-lot deltas,
initial versioned stock, projected final stock and complete search metadata for T05.
It is generated state, not a reservation, shopping purchase or persisted Week plan.
No migration is needed. A future accepting writer must reauthorize membership and
recheck inventory/catalog/preference versions before invoking existing versioned,
idempotent Week/command paths. T03 remains immutable at `3592de9`; temporary use of
its branch is a tooling constraint only, and T04 is isolated in subsequent commits.

**T04 hardening clarification:** Incomplete input/candidate evaluation is not a
search-limit hit. `no_plan_found_without_proof` covers every unproven no-plan result;
sorted, source-tagged `search.incompleteReasons` explain missing proof while
`limitReasons`/`truncated` remain specific to actual computational caps. Existing
hard eligibility and exhaustive-proof scope are unchanged. Nutrition's neutral
utility baseline is not positive evidence: a support reason requires a positive
utility delta, above-neutral aggregate fit, and an above-neutral fully qualified
soft target covering the current meal. Empty future periods cannot justify it.
This corrects the generated-only result contract before T05 integration; no persisted
consumer, schema, allocation, scoring formula or search policy changes.

## ADR-020 — Browser-side image normalization for OCR payloads

**Status:** Proposed maintenance change, local-only on 2026-09-13.

**Decision:** Normalize gallery images before upload using `createImageBitmap` and
an in-memory canvas. Cap the longest side at 2,000 px, encode as JPEG at quality
0.82, and only use the derivative when it is smaller than the source. Do not
upscale small images, mutate the original file, persist image bytes, or log image
content. If bitmap/canvas APIs are unavailable or fail, retain the existing
`FileReader` path. Cancellation and private-session fencing apply across decode,
compression and read stages.

**Rationale:** The sample receipt is 1,086x1,448 PNG and approximately 2.1 MB;
JPEG quality 0.82 produces approximately 382 KB (81.9% smaller) at the same
dimensions, reducing request transfer/base64 and provider input overhead while
retaining the text-bearing pixels. This complements, but does not replace, the
server/provider timeout recovery already deployed.

**Release boundary:** No production deployment, schema, storage, auth, payment
or provider configuration change is implied. Promote only after browser/device
OCR smoke confirms item recall and latency against the attached receipt.

## ADR-021 — Task-based Qwen runtime and production model governance

**Status:** Accepted 2026-09-13 (architecture maintenance branch)

**Decision:** Add a single task-based runtime behind `AIRouter`. Feature and
domain code submit a semantic task and compact input; the runtime resolves a
logical Qwen role, applies per-task prompts and token ceilings, validates
structured output, performs at most one repair and one policy-approved
escalation, and emits non-PII usage/cost telemetry. Production composition sets
`AI_QWEN_ONLY=true`, so legacy Groq, DeepSeek, GLM and native Cloudflare adapters
are not constructed. Physical model IDs are configurable only through Worker
role aliases (`AI_MODEL_*`). Reasoning and judge roles are explicit opt-ins and
remain off for customer traffic by default.

**Rationale:** A centralized policy prevents accidental expensive-model use,
unbounded retries, provider drift and model names leaking into application
services. Qwen remains the only production inference family while preserving
legacy adapters for test/migration compatibility when Qwen-only mode is not
requested.

**Consequences:** OCR and fridge vision still return untrusted candidates. The
quality gate, deterministic normalization, inventory fencing and reconciliation
remain authoritative. Estimated pricing is operational telemetry, not billing
truth. The rolling `qwen3.7-flash` alias is canary-only; promotion requires an
offline golden-dataset comparison and an explicit configuration review. This
branch changes no canonical `main` code and performs no deployment.

## ADR-022 — Credential-bound Google sign-in and honest OCR pending UX

**Status:** Accepted 2026-09-16 for the auth/OCR production hardening branch.

**Decision:** Production Google sign-in may enter `/auth/google` only through
Google Identity Services and a signed ID-token credential. Remove any client
fallback that fabricates `userInfo` or calls the endpoint without a credential.
The web client waits for the asynchronously loaded GIS SDK, renders the official
button once, and exposes a retry/unavailable state without pretending that an
email or synthetic profile is a Google login.

Scan and receipt review screens expose a shared, accessible pending state with
explicit queue/AI/validation stages, elapsed time and bounded polling context.
The UI never presents a pending scan as ready and never writes inventory before
the server reports a terminal review state.

**Rationale:** The production screenshot's HTTP 400 was caused by the old
credential-less Google fallback, while GIS initialization also had a script-load
race. Async OCR is expected in production; a visible staged state prevents a
user from interpreting queue latency as an app freeze without weakening the
existing Qwen, evidence, ownership or confirmation contracts.

**Release boundary:** This is frontend/auth presentation hardening only. Google
token verification, sessions, CSRF, Turnstile, queue processing, migrations,
PayOS and production resources remain unchanged. Promote only after exact-head
review and browser auth/OCR smoke; no deployment is implied by this branch.

## ADR-028 — Honest OTP delivery, unified OAuth configuration, and durable onboarding

**Status:** Accepted 2026-09-19 for T16 development; production rollout requires
separate operator authorization.

**Decision:** Treat provider acceptance as part of issuing a usable production
OTP. Use Cloudflare Email Service's structured message API as primary delivery
and Resend as fallback. Reduce provider failures to stable non-sensitive
categories; never log recipients, subjects, message bodies, OTPs, provider
response bodies, or exception text. If no provider accepts a registration or
resend message in production, invalidate the newly issued challenge and return
an honest machine-readable failure instead of claiming delivery. Development may
surface `devOtp`, but production may not.

Extend ADR-022 by using one runtime `GOOGLE_CLIENT_ID` for both GIS initialization
and backend audience validation. The public `/config` endpoint may expose the
client ID because it identifies the OAuth application and is not a secret.
Production Google auth remains signed-ID-token-only; missing configuration or a
blocked GIS SDK produces an explicit unavailable/retry state, never synthetic
user information or a credential-less request.

Persist onboarding completion on the profile and return it from authoritative
session/auth responses. Local storage is only a same-device cache. The funnel is
landing → guest or account; new sessions complete preference onboarding once;
returning completed accounts enter the app. Preference persistence and marking
completion occur in one D1 batch. Guest-to-account inventory transfer remains
deferred and retains its existing retry fence.

**Consequences:** Migration 0038 is additive. Existing opaque HttpOnly Secure
cookies, CSRF origin checks, Turnstile, household isolation, private-session
fencing, Inventory Truth, Week compatibility, and PayOS boundaries are unchanged.
Email Service binding presence is not delivery evidence: release still requires
sender-domain onboarding and a real recipient smoke test. Google release still
requires the exact production origin in the OAuth client's authorized JavaScript
origins. No production deployment is implied by this ADR.

## ADR-029 — One server-authoritative Plus payment contract

**Status:** Accepted for explicitly authorized T18B development, 2026-09-21.
No deployment or real transaction is authorized.

**Decision:** Preserve the existing operational prices (monthly 49000, annual
499000, VND) in one Worker table. Authenticated read-only plan metadata and
strict plan-identity intent creation consume that table. No client price,
discount, destination bank, reference, success redirect or local entitlement
cache is payment authority. Extra legacy request fields cannot override prices.

The Worker creates a PayOS link using server-generated order/expiry and verifies
the provider's signed response before returning instructions. PayOS can augment
the transfer description; the verified returned description, bank fields and
amount drive the server-built VietQR URL and UI together. They are bound to the
server order by the response HMAC and explicit order/amount/currency checks,
not by assuming request and response descriptions are identical.

Only signed callback data may transition an owned stored intent. A D1 batch
conditionally upserts entitlement while the intent is pending, then consumes
the intent. Replays cannot extend a subscription; separate paid orders retain
separate purchase value. Existing 31/366-day durations are unchanged. A shared
provider transaction reference cannot pay two orders. Provider-creation errors
mark the intent failed; late callbacks cannot grant it and require operator
reconciliation/refund outside this task. Never retry such a grant automatically.

**Compatibility:** No migration; existing payment rows and endpoints remain.
The obsolete `/auth/plus/activate` is read-only/non-granting for old clients and
rejects `grantCode` (410). Old shared-secret integrations must stop: retaining
their orderless grants would bypass the new authority. Checkout uses the new
owned status endpoint and fresh `/me` instead. Billing now uses the existing
expected-owner HTTP headers; other authentication behavior is unchanged.

**Consequences:** Provider configuration remains server-only and fail-closed.
Metadata is not a price lock; the returned intent is the final payable offer.
That persisted offer remains authoritative after catalog changes: issued-order
reads, callback reconciliation, replay handling and entitlement grants validate
its structure and lifecycle, never equality with today's price table. The table
controls new offers only; signed callbacks must match the stored amount.
Refreshing or closing a modal does not cancel a provider order and never grants
Plus. New explicit checkout attempts create independent intents; single-flight
browser requests prevent double-click duplication. No cancel/refund automation
or claim of live-provider certification is introduced. Operators must separately
verify PayOS configuration/webhook delivery and approve deployment.

## ADR-053 - Truthful Week compatibility and UI07 identity

**Status:** Accepted and locally verified 2026-10-10; UI10 implemented from
`3c018d7778a780f5759d967e62d58440e4e08c2d`.

**Decision:** Remove the unsupported, unsent day-schedule step and expose four
real setup stages. Week settings explicitly edit the next-generation in-memory
session draft; no durable/current-plan save claim or delayed navigation. Replace
ignored priority regeneration with review in setup. Preserve unlimited null budget,
defaulting only undefined. Await clipboard/share receipts, report failures inside
the existing focus-trapped dialog and fence abandoned completions. Pass through
the service's existing optional pendingSync in completeShopping only; queued copy
cannot claim server-confirmed import or durable offline persistence.

Six Week pages and four components adopt UI07 typography, assets and tokens through
a shared scoped workspace, exact route boundaries, responsive day board and modal
scroll/safe areas. Availability, budget and waste remain plan projections; recipe
nutrition absence remains unknown. Existing queries, services, StrictMode command
reuse, private-session fencing, selected-item snapshots, import/cook authorities,
Week dual-write and planner-on redirect aliases remain authoritative.

**Boundary:** No backend/packages/schema/migrations/dependencies/auth protocol/
payment/production configuration or remote writes. Only store change is optional
pendingSync pass-through. Durable Week outbox receipt/projection replay, inventory
fallback authority and global mobile navigation are separate packets. Local QA
cannot establish brand owner approval, device/Safari/usability/CWV or hosted release.

**Verification:** Runtime and 11 files / 192 focused tests PASS; 61 browser
snapshots / 11 journeys, seven planner-on aliases and six native-keyboard E2E
projects PASS. A full run exposed six stale earlier route assertions and one
Wrangler timeout. The route assertions now match accepted Week adoption, retain
negative boundaries and add four positive cases; recovery 5 files / 128 PASS.
Wrangler passes unchanged in reproduction/recovery and the final full run.
Final pnpm check exit0: 283 files / 6653 tests PASS, Vitest393.63s;
type/lint/migration smoke/Vite3.12s/WorkerTS PASS. Source143 and public build assets51
verified after full. Implementation `89bddf821ea4f74d639f0779febd78606bdf617f` verified: all 143 source hashes,
144 evidence payloads and manifest 29760 bytes/SHA256
`7ac94d4590e8c449ca4a1046e330871db4ce650bfda80329625595ac4d5618ab` match Git blobs/worktree.
Protected diff empty and tree clean after implementation; documentation checkpoint
follows. No timeout/config was weakened. Round-10 reports retain failed runs, generic UX
FAIL151/29/968/82 and dependency41 advisories, and distinguish synthetic receipts
from real Worker commands. UI11 navigation packet is ready; runtime not started.

## ADR-054 - Measured kitchen navigation and shell offsets

**Status:** Accepted 2026-10-10; locally verified; final full and Git-object checks PASS.
Verified implementation `74adf20db00f77c63ba47085362c621b56e050fc` on 2026-10-11 JST.
Source160/evidence271/publicassets99 and manifest verified against Git/worktree;
receipt `../ui-rebuild/round-11/GIT_VERIFICATION.md`. Owner/device/release remain.

**Problem/evidence:** Local Chromium audit from 13cef9f captures ten states.
At320px computed text x2 the six-cell69px mobile bar has three label-overlap
pairs and text below the viewport. Tablet10px labels truncate at x2; short768x420
shrinks icon rows and clips labels. Header with back/brand/notifications/account
already uses312px at320, so adding Scan in that row is not viable.

**Decision:** Kitchen-only mobile navigation contains the five existing roots,
full12px wrapping labels, intrinsic height, static active surface and real links.
An em-based grid reflows to two rows under enlarged text instead of breaking words
to force five cells on one row; the measured bar reserves the resulting height.
Scan remains an explicit labelled44px-minimum action in a second header row on
mobile; scan review pages adopt the same KitchenHeader for persistent access. Tablet uses a112px scrolling rail with14px wrapping labels; desktop keeps
256px and a labelled Scan action. Rail owns brand from640px, header owns it below.
On short viewports the header and page actions flow normally so editing space
is available; navigation itself remains reachable. No new root/drawer or asset.

Kitchen active states use segment boundaries, including inventory-reconciliation
under stock. Shopping and scan review remain contextual with no selected root;
Scan link itself marks the scan family. Planner/Week destination still follows
the existing build flag. Legacy default navigation/API retains its existing kit,
six-cell layout and matchers; protected surfaces are not migrated.

One kitchen shell measurement contract owns --kitchen-nav-height (actual visible
mobile bar including safe area), --kitchen-header-height, --kitchen-banner-height,
--kitchen-action-reserve and --kitchen-rail-width. ResizeObserver watches shell
chrome; child-list changes rebind late route/header/actions; route cleanup restores
root scrolling offsets. Main padding reserves nav and fixed page actions; scan review sticky
actions occupy their existing flow and clear nav. Settings actions are fixed
under kitchen scope: text x2 proved a fieldset-start clamp can hide sticky Save
behind the bar before its parent reaches the visible viewport. Short-height
settings actions remain in-flow. Focused main controls are kept
between visible chrome; dialogs retain their own focus/scroll authority. Inventory
Add, recipe Cook, settings StickyActions, scan review and unused BottomCTA all
consume this contract under kitchen scope. Short<=600px actions become in-flow.

**Compatibility/boundary:** App route/guard source, callbacks, commands, stores,
services, backend/packages/schema/migrations/public/dependencies/auth/payment/
production flags/config remain unchanged. Existing UI07 identity, immersive
camera/cooking/onboarding/auth and protected/legacy shell remain. Synthetic text
magnification and safe areas are explicit checks, not native zoom/device claims.

**Plan/acceptance:** Implement variants and measured shell; meaningful contracts
for five destinations, Scan, flag, active boundaries, immersive/legacy and observer
cleanup. Browser seven widths320..1440, short390x420 and768x420, text x2, keyboard,
dialog return, focus/offset/brand checks across all packet route families and both
planner flags. Preserve inventory JSON for read/navigation journeys. Freeze source/
evidence, focused/type/lint/full pnpm check, fresh guideline/UX/dependency review,
local implementation commit and Git-object verification, then documentation
checkpoint. No push/PR/deploy. Device/Safari/usability/CWV and separate offline/media/
dependency risks remain. Runtime may be refined from measured failures and recorded.


**UI11 verified adjustments:** em grid uses two rows at computed text x2;
settings toolbar is fixed after observed fieldset clamping; action buttons use
intrinsic heights/1.4 line-height; ResizeObserver explicitly observes border-box
so padding-only safe-area changes update measured offsets. Browser115checks/
16journeys, flag-off24/1, seven aliases and E2E19PASS/5once-onlySKIP39.6s. E2E
public assertion was stale from pre-UI08 mascot and now covers actual stacked entry;
no runtime/timeout change. Protected patches restore base bytes exactly. Generic
UX154/30/977/85FAIL (earlier980warnings) and dependency41advisories remain; final
full/Git verification and implementation hash are recorded in this ADR and receipt.


**Final UI11 gate:**285files/6685tests PASS,Vitest344.71s,type/lint/migration
smoke/Vite2.97s/WorkerTS PASS. Final focused14files/255PASS6.34s. Four scan fixture
suites recovered without runtime/authority changes; unchanged Wrangler startup
then exposed expired update-check cache under full-gate TMPDIR. Logs isolate delay
before local D1; exact-env recovery32PASS3.77s/case1206ms,full suite32PASS2711ms.
No manual cache/dependency/timeout/config edit. Source160 and all99publicTakosan
build assets verify after full; remote gates remain skipped. Git checkpoint verified:
160 source records, 271 evidence payloads, 99 public assets and manifest match
480 unique Git blobs/worktree. Manifest55364bytes/SHA256
`42892dfeaaa814df6203eb470ecd1f35850dbd6d3d7af69ec5a4976eec9c61bc`.
Protected base-to-implementation diff empty; tree clean after implementation;
diff-check PASS. Following documentation checkpoint records the verified hash
without including its own hash. UI12 runtime not started.

## ADR-055 - Readable recipe journey and honest media states (UI12)

**Status:** Accepted before runtime, 2026-10-11 JST; local gates PASS, Git objects verified.
Base `f7a27c16ef460b19322d3a463dc74dc09fa48ade`, canonical vn-tak/Tako-san.

**Evidence:** Ten real local baseline captures across Home, discovery and all
three detail panels at320px, normal/computed text x2. Direct images show clipped
hero badges, overlapping quantity/availability text, overlapping tabs and nutrition
labels escaping their four-column cells even at normal text. Existing px-based
line heights fail after font enlargement. The216px missing hero dominates mobile;
Home row titles and card descriptions truncate. Media re-audit:500 local migrated
recipes,71 static,6 allowed legacy mappings,494 canonical mappings needing review
or correction; all500 local canonical media rows pending. This is not live state
or photo-license certification. A Vite optimizer conflict during audit required a
preview restart; no application or configuration fix is implied by that failure.

**Decision/scope:** Complete one coherent recipe presentation slice: explicit
kitchen RecipeCard variant for Home/discovery, shared RecipeMedia presentation,
recipe detail/state/panels and responsive discovery controls. Retain UI07 identity
and UI11 shell. Full titles, readable availability/time/servings, labels instead of
an unexplained percentage, compact neutral missing-photo treatment, intrinsic line
heights/controls and adaptive tab/nutrition grids. Existing default card variants
retain their rendering. Existing resolver and legacy media policy stay unchanged;
new media view consumes the resolved src/fallback only, updates state on load/error,
falls through permitted legacy to an HTML missing-photo panel, stops retries and
resets synchronously when title/src/fallback changes. No placeholder image request
is needed, no new raster or public asset. Local photos remain compatibility media,
not a claim of verified provenance. No source/license invention or AI food image.

Detail keeps all query/404/error branches, retry handlers, availability arithmetic,
shopping aggregation/mutation and cooking authority unchanged. JSX and scoped CSS
may change; domain declarations/callbacks must match base. No raw imageUrl reads,
new catalog mapping, canonical promotion, command/store/service/schema/guard or
payment/auth change. Short-height recipe overview is in normal flow; sticky filters
consume measured UI11 header/banner tokens. Reduced-motion CSS is scoped to the
new recipe/card surfaces; no new decorative animation is required.

**Sequence/acceptance:** Audit migrated route families/states and source media;
implement chosen slice; test media load/error/reset and retained Link/modifier
semantics; browser seven widths320..1440, computed x2 at320/768, short390x420 and
768x420, three panels, long content, no nutrition and media fallback stages. Exercise
keyboard tabs/Home/End, native card/back/filter/pagination, recipe loading/404/error
retry and inventory failure without stock writes. Verify other migrated families
and both Planner flags, one brand and UI11 nav/action/focus contract. Inventory JSON
must equal before/after read journeys. Capture failed/final evidence and fresh
interface guideline review; focused/type/lint/full pnpm check. Freeze source/public
assets/evidence; local implementation commit, Git-object verification, documentation
checkpoint with verified hash. No push/PR/deploy/remote writes. Owner/device/Safari/
native zoom/virtual keyboard/screen-reader/CWV/hosted/whole-product approval and
licensed catalog photography remain distinct follow-ups.

**UI12 local result:** Full286files/6702PASS352.41s,type/lint/migrations/buildPASS;
focused86,new17;browser218structuredcases/26main-off-statejourneys,applicableaxe/
overflow/brokenimages/pageerrors/recipeclipping0. Source374frozen,96page lifecycle
records/legacycard JSX unchanged;protected diffempty;public256copies+existingSW
build-IDtransform. Baseline777Gitblobs verified;10finalcomparisonclip0. Localmedia
500pending,24demandrecipes/8assets plan;genericUXFAIL157/31/989/86,41advisories.
Ownedpreviews stopped/sixportsclosed. No protected/remote change or release.
Implementation `03e16c78850b061784dc2e9a01323bd7e74b65f3`; source374/evidence349/public257/manifest match724uniqueGitblobs;39logreceipts/7rawgzip
match. Manifest71599bytes/SHA256
3c7ff61129ff0d14dd9e04c1053567b3e891d438821a7c118f3cb4716bb66e02.
Documentation checkpoint follows,does not name itself. UI13-local-media-review
only next,not started.

## ADR-056 - Local recipe media review board (UI13)

**Status:** Accepted before implementation, 2026-10-11 JST.
Base `5da802735c318c56505bed85a133b049728afb39`; exact base is recorded in round-13/PLAN.md before coding.

**Problem/evidence:** UI12 confirms500local canonical media rows pending. The24
observed discovery recipes contain4permitted local photo mappings and20missing
presentations. Eight local assets have hashes but no established per-image rights
receipt. Matching recipe-source metadata, a renderable URL or a hash does not
prove image provenance, subject approval or permission to promote media.

**Decision:** Build a standalone local review board from pinned UI12 demand plus
fresh read-only mapping verification. Preserve current resolver output separately
from proposed local candidates. Show eight original local assets and CSS card/hero
crop previews; do not create raster derivatives or fetch remote photos. Reuse UI07
vector/font/palette. Native search/filter/links/dialog, labelled notes, meaningful
unknown states, memory-only draft, explicit JSON export/import and keyboard focus.

A shared validator checks dataset identity, unique complete recipe records,
allowlisted local asset references, decision enums and required evidence fields for
an owner-reviewed claim. Human claims remain claims: structural validation never
grants catalog promotion or verifies licensing. Reject unknown/missing records and
unsafe local paths; imported notes are rendered as text. No backend/auth/store/
resolver/catalog/public-master/dependency/config edit. No push/PR/deploy/media write.

**Acceptance:** 24records/8asset hashes trace to pinned sources; fresh mapping and
current resolver match receipts. Board works at320..1440,textx2,shortscreens,keyboard
and accessible dialog; imported invalid drafts leave current draft intact. Export
roundtrip retains all notes/choices; no network/domain write or remote image load.
Meaningful validator tests, actual browser interactions, deterministic generation
check and local configured gates. Update state/board/handoff; implementation commit,
Git-object verification and following documentation checkpoint. Owner/photo/device/
production approval remains separate.

**UI13 local result:** Review board/generator/validator/readonly preview complete,
24 pending records/eight byte-verified originals, four permitted current photos.
Rights remain unknown, human evidence claims never authorize promotion. Resolved
text clipping, reverse Tab, late import races and 256 KB versus valid-export size
mismatch (3 MiB bound + full-size/oversize tests). PASS exit 0: 287 files / 6,737 tests, Vitest 357.58s; typecheck/full lint/local migration smoke/Vite 3.06s/Worker TypeScript PASS; remote gates skipped.
Final focused/browser/supplemental and integrity receipts in round-13. Generic UX
FAIL31 issues/1,006 warnings and 41 dependency advisories retained. Entire src/
protected/public source unchanged; no remote operation. Implementation:
`021220bbcb883360ba79b8101ff9586a67ebc4ae`. Git-object receipt follows; docs
checkpoint names verified implementation, not itself. UI14 ready only.

## ADR-057 - Defer the optional navigation motion engine (UI14)

**Status:** Accepted before runtime change, 2026-10-11 JST.
Base `f3a09f2a7beb548fbd4bc9ef8ae932a092dd3827`, canonical vn-tak/Tako-san.

**Evidence:** Fixed-timestamp production build entry is 463,601 raw / 128,900 gzip
bytes. Source map places full motion projection/drag features in the entry through
MotionProvider/helpers sharing one module and eager legacy navigation motion.span.
The kitchen shell has static indicators and does not use this engine. First local
Chromium/CDP smoke, CPU4/60ms/200KBps: 226,429–240,255 JS transfer bytes on these
three routes; no domain writes and inventory unchanged. Cold/warm repeated
baseline is now running; no field CWV claim. Offline catalog/domain modules and
public font cache policy are also observed, but protected in this packet.

**Decision:** One bounded delivery optimization: separate the lightweight
MotionConfig provider from motion helper/engine modules, and defer the optional
legacy navigation indicator until that branch is actually mounted. Preserve the
existing shared layoutId, classes and transition in the loaded indicator. While
loading or if importing fails, keep the same static active highlight; navigation
links/content remain immediate and never depend on animation success. Fence late
module receipts on unmount; share the import promise across active indicators.

App.tsx changes only the provider import source; name, ancestry, routes, guards,
callbacks and flag behavior must otherwise be byte-equivalent. Existing motion
module continues re-exporting MotionProvider for caller compatibility. Kitchen
navigation markup/selection authority is unchanged. No global CSS motion redesign,
new library/asset/font, public/cache/production config or services/stores change.

**Acceptance:** Same fixed build flags/timestamp, fixture and CDP conditions before
and after; repeated local measurements demonstrate initial JS transfer reduction.
Verify engine not requested on kitchen Home/discovery/detail, loads on actual
legacy indicator use, and static fallback survives import error/abandoned mount.
Normal/reduced motion and navigation/focus/recipe tabs/back/media/read-only flows
work; responsive/short/text x2/axe checks and configured gates. Source/build/map
receipts and protected proof, logged failures, local implementation commit,
sequential Git verification and documentation checkpoint. No hosted/device/photo
approval or production deployment follows from this local optimization.

**UI14 local result:** Exact production entry463601→336308raw; gzip6
129276→87619. Repeated cold route JS saves41650/41650/41652bytes (17.3–18.4%);
warm JS0, timings bounded lab only. No optional engine requested by kitchen routes.
PASS288files/6742tests/370.67s,type/lint/migrations/build;50settled snapshots/5journeys,
4actual legacy journeys,2baseline probes,short focus supplemental. Static links
survive delayed/rejected chunks. Reduced first-frame projection equals baseline;
no claim of zero spatial frames. Axe mid-fadecontrast remains a measured residual,
final stable snapshots clean. UI15 short-screen/readability next, not started.
396source frozen,protected/App/helpers/public proofPASS;four previewports closed.
Failures/helperUXFAIL/41dependency advisories archived. Implementation
`7ee28bf48974e8faf52f78caa2b9a5b979953768`; Git-object receipt follows.


## ADR-B03a-SYN-001 - Synthetic image test corpus (2026-10-12)

Accepted offline scope: `../backend-upgrade/b03a-synthetic/ADR-B03a-SYN-001.md`.
User-requested generated invoice/fridge samples supplement the original symbolic
fixtures with actual raster bytes, local Apple Vision text recognition and real
Chromium preprocessing. SYNTHETIC_IMAGE remains TEST_ONLY / NOT_CERTIFIED.
Unknown fields/duplicate occurrences/currency/split/source hashes are preserved;
fridge object recognition and live Qwen quality are not measured. No runtime,
provider activation, payment/auth/config/data authority or migration change.


## ADR-B03-PREP-001 - Bounded lossless receipt preparation (2026-10-12)

Accepted local implementation; see ../backend-upgrade/b03-preprocessing/ADR-B03-PREP-001.md.
JPEG0.82 reproduces loss of VN diacritics/glyphs on generated images; higher JPEG
quality still loses text. Receipt-only opt-in preserves supported originals below
2000px/512KiB, tries bounded PNG for other receipts and retains the previous JPEG
fallback. Default photo, camera, scan APIs/session/confirmation stay compatible.
No real-image/provider/device/release certificate; raw metadata retention remains
an explicit existing-fallback risk. No deployment or provider activation.


## ADR-FINAL-LOCAL-001 - Close remaining local security/compiler work (2026-10-12)

Accepted local implementation under the user's autonomous completion request.
See ../backend-upgrade/final-local-completion/ADR-FINAL-LOCAL-001.md.
Use supported setup-node6cache disable inputs in the two deploy jobs, and complete
a measured official Tailwind4migration removing braces. Preserve backend/payment/
auth/data/release gates. Browser/device/hosted and real/provider acceptance remain
explicitly independent; local findings are fixed without suppressions.

## Integrated release - 2026-10-12

User authorizes Brand PR66/backend merge and release. See
[ADR-INTEGRATED-RELEASE-002](../backend-upgrade/final-local-completion/ADR-INTEGRATED-RELEASE-002.md)
for exact-source first-strict-cutover recovery without legacy OTP rollback.

## ADR-CATALOG-CONTINUITY-003 - Unchanged complete D1 authority across application SHAs

Accepted for the authorized integrated release, 2026-10-12. Production deploy
38206476316 failed before any Worker upload because its per-SHA rollout guard would
require replacing the established500-recipe D1 authority with the static baseline.
The trusted workflow may preserve production d1->d1 only when protected complete
runtime evidence, active100% previous version/commit/binding/flags, ancestor source,
identical reviewed catalog kernel/dependency blobs and unchanged Zod resolution /
integrity all match. Source/catalog/canary drift keeps existing shadow/promotion
policy. No bypass input or protection change. Exact-main/CI/schema/Environment /
strict OTP recovery proofs remain required. See
../backend-upgrade/final-local-completion/ADR-CATALOG-CONTINUITY-003.md.

## ADR-ADMIN-001 - Separate admin session and RBAC authority for Admin Console V1

Accepted locally, 2026-10-12 (not deployed). Platform administration is a new
authority, independent of household roles and customer sessions: active
`admin_role_assignments` rows (migration 0042) are re-read on every request, and
the versioned code matrix `src/shared/admin.ts#ADMIN_PERMISSION_MATRIX` is the
only permission authority (deny by default; no DB copy that could drift). Admin
sessions live in `admin_sessions` with their own `__Host-takosan_admin_*`
cookies (SameSite=Strict, 8h absolute / 30 min idle) and a session-bound CSRF
token. Production serves nothing unless `ADMIN_CONSOLE_ENABLED=true` and
requires Cloudflare Access verification on every request; password login is
development/staging only. SUPER_ADMIN grants need four-eyes approval; there is
no HTTP bootstrap, only a local-only one-time CLI. Billing/AI/recipe screens are
read-only over existing authority; recipe editorial notes use a separate ledger
and never mutate `recipes`. See docs/admin/.

## ADR-ADMIN-002 - Admin Console as a separate Worker and database (supersedes parts of ADR-ADMIN-001)

Accepted locally, 2026-10-13 (not deployed). The 2026-10-12 review showed that
hosting the console inside the customer Worker caused an asset-layer bypass
(S2), customer-origin trust (S3), and blocked the customer release train via
migration 0042. The console is now its own Worker (`src/worker/admin-worker.ts`,
`wrangler.admin.jsonc`, `run_worker_first`) on a dedicated origin, with its own
D1 (`ADMIN_DB`, `migrations-admin/`). The customer Worker, configs, build and
migration ledger are restored to 186a9cf; 0042 is withdrawn. Admin code reads the
customer DB through a SELECT-only wrapper. Availability is an exact server-side
allow-list (no environment defaults); password login exists only in local builds
on loopback; staging/production require Cloudflare Access. SUPER_ADMIN changes are
four-eyes in both directions with a database minimum of two, and the first two
come from a one-time two-person operator bootstrap. See
docs/admin/remediation-r1/REPORT.md. Production integration still needs reviewed
admin migrate/deploy workflows, Access setup and an independent review.

## ADR-058 — Vietnamese family meals and explicit meal-habit preferences (2026-10-13)

The user authorizes implementation of the researched full-meal experience. Active
packet T22 supersedes T20's optional whole-week composition deferral. Add V2 plan
commands and metadata alongside strict V1 JSON. Build all selected slots on a
shared sequential inventory projection and commit plan, components and metadata
atomically. Regeneration retains locked component identities and refills roles;
V1 writers cannot discard the components of a family plan.

Vietnam-first is a product default: generated international main slots cap zero
unless the user explicitly chooses otherwise. Regional preferences are soft,
based on existing metadata, never inferred from titles or used to stereotype
flavor. Rice and Vietnamese cuisine repetition are acceptable. Lunch/dinner
family templates target main, vegetable/side, soup and staple; breakfast and
explicit quick/one-pot intent use their own templates. Missing roles/data remain
visible and hard restrictions stay fail closed.

0042 adds explicit member-scoped family preferences and updates T03 soft ranking
preferences only on an explicit save, preserving existing hard policies. It does
not import legacy diet strings. Saved recipes are user-private, authority-aware,
revision-fenced entries with tombstones and no global recipe inserts. Shopping
materialization shares only the selected demand/title snapshots with the household;
private plans stay private. Demand reconciliation preserves manual entries,
checked state and explicit quantity overrides. Checkbox state never consumes stock.
No payment/auth/provider/infrastructure change or remote release is authorized.

The implementation uses native inventory/ranking/profile/catalog snapshot witnesses
for both computation and atomic D1 writes; cache freshness alone cannot certify a
mutation. Hard time applies to the sum of all component prep/cook durations.
Unknown durations remain explicit. Personal manual locks retain identity. All
preserved international mains, including future locked dates, reserve their share
of the rolling seven-calendar-day allowance before Auto/Assisted generation.
Preserved choices above a newly lowered cap remain visible with an explicit
warning; no new international main may spend that allowance again. Non-staple
companions receive a soft repetition penalty across the planning horizon.
Only exact representable compatible quantities materialize into purchase rows.
Shopping command receipts retain the original response; explicit deletion dismisses
same-plan demand. Another household member's active projected plan returns409,
avoiding independent subtraction of the same stock for separate private plans.

Migration0042 must precede any deployment of this Worker: shopping, favorites and
family preferences use its additive tables independently of the planner flags.
Retain0042 during rollback. The current Worker rejects legacy regenerate/swap for
persisted family plans when composition is disabled, including wholly unplanned
family results, without adding a0042 dependency to ordinary legacyV1 writes.
Returning to a pre-T22 Worker after creating family plans is not a certified
rollback; it lacks these mutation guards. Paired flag-off on the current Worker
is the supported local rollback path, pending separate hosted rehearsal.
Purchase status transitions are enforced by both Worker and offline client: bought
and cannot-buy cannot both become true; switching clears the other state in the
same command without rewriting purchase quantity.

## ADR-059 - Quantity-aware manual family planning and scoped dish selection (2026-10-13)

Accepted under the user's continued comprehensive family-meal request. T23 extends
T22 without introducing another planner or inventory ledger. Current manual picker
cannot decide from recipe names alone: household servings, earlier allocated stock,
kept dishes and downstream effects determine whether a selection can be accepted.

Add POST /api/v2/meal-planning/drafts using the existing validated calendar intent,
feature gates, membership, idempotency and atomic planning witnesses. It creates
intentional empty manual compositions without running/discarding automatic search.
Manual request fingerprints include their mode, so one key cannot replay an auto
plan as a draft. Existing automatically generated fingerprints remain unchanged.
Selecting a dish locks its explicit identity; optional completion fills other roles.

Extend the existing picker with all-or-none plan/slot/revision context, an explicit
excluded component for swap, quantity-only/no-buy filtering and a pinned snapshot.
Reads and entering writes share chronological projected inventory and hard policy
checks, including affected later dishes. Corrective removal must remain possible
when existing companions are invalid. Inventory/profile/catalog/role/saved changes
invalidate pages and changes before a write reject the transaction.

Quantities expose required/covered/missing in trusted compatible units for the meal's
servings. Unknown or incompatible units remain null; fractions are preserved and
purchase rounding belongs to the explicit purchase edit. Planning never consumes
physical stock. Default strict family/V1 DTOs retain their prior keys; ingredient
assessments require includeAssessment=true on composition reads. Unscoped picker
responses/order stay compatible. The updated browser opts into assessments and
refreshes unassessed family seeds rather than treating absent data as zero shortage.

Recipe discovery accepts optional servings 1..20, scaling only ingredient demand
before availability/ranking. Omitted servings keep old behavior and response shape.
The selected count is part of pagination snapshots and preserved in recipe links.
Detail and cooking start use the same scaled recipe. Nutrition remains per-serving.
The shared recipe-to-meal dialog selects a real destination and explicitly adds or
replaces a chosen component. Without a current future plan it preserves recipe and
servings into manual calendar setup; no mutation occurs from opening a dialog.

Scoped ordering may prefer the member's chosen cuisine/regions before stock fit,
without relaxing hard restrictions or explicit filters. A fridge match cannot
force international food into a Vietnamese household's default meal. Regional
metadata remains the existing coarse catalog evidence; it is not an authenticity
claim. Read-only projection may reuse an exact prefix to limit repeated computation,
while every affected suffix and atomic witness remain authoritative.

No new migration, dependencies, remote operation or protected subsystem change.
0042 remains required from T22. Browser matrices must exercise intentional empty
calendar, exact quantity assessment, manual add versus swap, serving handoff and
selected shopping horizon through the actual app/Worker HTTP; synthetic fixtures
are not production or user-study evidence.

T23 review refinement: an explicitly locked manual main already classified by the
canonical RoleIndex as complete_meal selects the existing one-dish meal template
for that slot. Thus a chosen pho/bun meal does not force separate rice and soup,
while ordinary family dinners still fill four roles. No new title heuristic,
per-slot persistence or nutrition/allergy assertion is introduced. DTO completeness,
assisted completion and whole-week regeneration must use the same derived template;
replacing/removing that main restores the configured family/quick template. Surface
this choice as a one-dish meal rather than claiming four food groups are present.
T23 also permits measured fractional inventory input and versioned actual-quantity
corrections through existing commands. Increment sizes are UI affordances in the
selected unit, never inferred package mass; no command may invent a positive floor.

T23 quantity-editor refinement (2026-10-14): switching compatible measured units
converts the displayed amount using exact Quantity arithmetic. Pure unit changes
preserve the existing unit-only conversion command; an explicit correction is
compared against the baseline expressed in the selected unit and sends its amount.
Thus 1 kg -> g displays 1000 g, while a subsequent manual entry of 1 saves 1 g.
An incompatible dropdown selection does not erase the last measured unit context
or invent a package factor. Both unit changes and quantity corrections retain the
opened draft's version fence; untouched metadata retains its existing rebase path.

T23 chronology/revision refinement (2026-10-14): a mutation's expected revision
must match both the row that supplied its loaded calculation context and the
subsequent current-row check. A newer second read cannot authorize quantities,
slot times or constraints computed from an older first row. Genuinely absent
slots retain their existing 404 classification; a slot introduced during the
reads is a stale request. Transactional revision and input witnesses still guard
the final write.

Same-instant stock projection now follows the canonical normalized numeric slot
sequence, then stable slot identity, rather than lexical IDs (which placed 10
before 2). Service reads, stock/shopping projections and the optimized affected
suffix use this comparator. This intentionally corrects which equal-time meal
receives shared stock; no migration or persisted slot identity changes. UI mixed
boards and recipe destinations use date/time/numeric sequence with the plan's
scheduled instant and offset; elapsed same-day destinations are omitted. If all
slots elapsed, the exact recipe/servings handoff creates a manual calendar.

T23 continued-week refinement (2026-10-14): elapsed breakfast/dinner must not
freeze every remaining meal. V2 composition edits remain subject to the target
slot's scheduled instant and current server checks. Legacy V1 swap and whole-plan
regeneration retain their strict past-horizon rejection; history is not silently
regenerated. The board explains that future meals can still be edited individually.

Projection from a trusted current context skips elapsed instants, including meals
earlier today. Their projected allocations are not deducted again from actual
current stock. Legacy explicit projection scopes without a reference instant keep
the date fallback. Picker/assessment snapshots include elapsed slot identities so
a meal-time boundary invalidates quantities without invalidating every second.

Shared family shopping may recalculate remaining composed demand from current
stock when the only stale reasons are inventory, ranking history or elapsed time.
Profile, hard preference, catalog and catalog-authority changes still require
revalidation; all current snapshot/membership/revision/transaction fences remain.
Non-family composed plans permit time-only continuation, with stock/history
staleness still rejected. No stale freshness status is rewritten as fresh. The
legacy price/budget optimizer remains strict. Future shopping excludes elapsed
slots; a user action calculates demand, never consumes inventory. This policy
supports actual cooking during a planned week without discarding its later choices.

T23 shopping calendar refinement (2026-10-14): the trip's default start and date
input minimum use the saved plan offset and the later device/server checked instant,
consistently with future-slot eligibility. A device in a timezone already on the
next date must not silently exclude a still-future late meal in the plan's local
calendar. Missing or malformed offset/instant fails closed; no offset is guessed.
Shopping uses the trusted reference captured for its request, as other projections
do. A meal-time boundary during that request is not an inventory version change;
subsequent requests use their new reference and exclude meals that then elapsed.

## ADR-060 - Snapshot-bound review of unknown shared shopping demand (2026-10-14)

Accepted for T24 under the user's instruction to continue careful implementation
of practical household shopping. Unknown demand currently offers only source links;
ordinary manual entries cannot reconcile it because they carry no demand identity.
Reuse the shared purchase list, rather than introduce another planner or stock ledger.

Migration0043 adds source/demand-key review rows, monotonic review revisions and
immutable list-scoped command receipts. Reviews reference the durable source, not
the demand row replaced by reconciliation; receipts survive review/item deletion.
A persisted demand fingerprint includes source/plan/revision, trip dates, ingredient,
unit and exact attribution. It excludes update time so unchanged re-sharing retains
the decision. Changed plan revision, horizon or attribution requires review again.
User purchase intent and checked history remain preserved by existing reconciliation.

GET unresolvedItems remains additive and includes all unknown demands with an
explicit pending/purchased/skipped reviewState. New fields bind sourceId, demandKey,
snapshot, reviewRevision and optional existing purchaseItemId. A full selection
snapshot additionally binds review and generated purchase state, so a stale open
page cannot overwrite a concurrent quantity/check/decision edit. A purchased row
requires a matching current demand fingerprint and a live generated overridden item.
Legacy/manual entries never resolve demand through name or ingredient coincidence.

POST /shopping-list/demand-review accepts purchase(quantity,standard unit), skip
or reopen with the exact GET binding and Idempotency-Key. Current household members
can review the shared persisted list, including demand shared by another member;
this command does not load a private planner or certify current recipe coverage.
Replay checks the immutable receipt before current demand and returns the original
result without another write. Different payloads cannot reuse a key. Atomic batch
guards bind membership, demand, review revision and the complete purchase witness.
No request/client household ownership identifiers confer authority.

Purchase creates/reuses the stable generated item as an explicit override without
changing demand NULL, price, recipe, physical inventory or purchase checked state.
Skip is scoped to this exact shared trip snapshot; it removes an unchecked linked
purchase row only by explicit choice, and retains bought history. Reopen advances
the review tombstone and returns the demand to pending without discarding purchase
intent. Deleting a reviewed unknown purchase must not create the legacy same-plan
indefinite dismissal; absence of its live item makes the unknown demand pending.
Existing known-item dismissal semantics remain compatible.

The web uses clear Vietnamese actions, blank initial purchase amount, source meals,
separate pending/chosen/skipped presentation and visible reopen. Confirmation/skip
are online-only; cached device reads remain useful but cannot pretend to resolve a
snapshot. Uncertain attempts freeze request key and payload for an explicit retry.
A rejected stale snapshot requires reload and a new user action. No automatic
re-key, guessed package/bunch mass, outbox claim or stock import follows.

0043 must be applied before this Worker serves shopping traffic, independently of
planner flags. Preserve additive schema on rollback. Applied migrations, payment,
unrelated auth, dependencies and infrastructure stay outside T24. Local HTTP,
SQLite/D1 and browser validation are synthetic evidence, not production acceptance,
regional user research or retention proof. Remaining whole-week regeneration,
leftovers, shared prep, regional catalog provenance and vendor allocation gaps remain.

T24 final review refinements: a NULL aggregate may also result from known recipe
contributions that cannot be represented exactly in persisted shopping arithmetic.
Show the unknown total separately; only NULL source contributions say their own
amount is unknown. Shared-source navigation retains date/meal/title and opens the
canonical recipe independently of creator-private planner ownership. Links open
separately from a buying draft and are rendered as text during busy/uncertain/stale
recovery. Missing recipe IDs remain text. The contribution DTO has no serving
count; these links do not claim to preserve the planned recipe serving context.

Local workerd/D1 validation found that shopping DELETE meta.changes includes
cascaded generated-state/metadata rows. Accept a positive delete count rather than
exactly one, preserving zero-change conflict classification and membership guards.
Command receipts use normal INSERT and replay; UPDATE/DELETE triggers defend those
paths. Direct privileged SQL INSERT OR REPLACE is outside this application guarantee.

T24 rollback boundary: paired planner flags OFF on the current T24 Worker retain
shopping review commands and are covered locally. A binary rollback to T23 or an
older Worker after review purchases exist is not certified: the old DELETE path
can create a same-plan dismissal for unknown demand and the old UI has no review
or skip/reopen actions. Do not infer safe mixed-version shopping writes from the
expand-only schema. Keep 0043 on rollback and rehearse any earlier binary against
reviewed purchase/history fixtures before authorizing that release path.

## ADR-061 - Operational release support for family-meal schema tips (2026-10-14)

Accepted under the user's explicit instruction to release all T22-T24 changes.
Add bounded staging migration support for the exact 0041->0043 chain, retaining
current-main/exact-SHA CI, staging D1 identity, ledger/plan, bookmark, schema and
unchanged-data evidence. Production 0042/0043 retain the existing Environment gate
and immutable migration chain, and receive the same immediate current-main/CI
rechecks as other operational schema tips. Catalog/media verification treats 0042
and 0043 as post-media operational tips without permitting catalog/media drift.
No new runtime schema is added; no applied migration or payment/auth runtime is
changed. Catalog authority progression and strict release proof remain binding.

The first family schema release prepares an inactive recovery version from the
exact current candidate with both planner UI/server flags OFF before active
traffic. Its compiled flags, canonical D1 binding, source SHA and catalog flags
are certified; active assets are rebuilt and rechecked after that upload. Failure
recovery prefers this named compatible version over the pre-T22/pre-T24 binary,
keeping additive 0042/0043 schema and shopping review semantics. The unchanged
strict-OTP recovery retains priority when preparing an initial OTP cutover.

T22 changed the recipe-authority source to add current-content validation. Existing
unchanged-D1 continuity therefore does not apply. Use the existing explicit
shadow restart, then same-SHA canary 1 -> 5 -> 25 -> d1 progression with authority
proof at every step; retain the unchanged rollout policy and human Environment
gates. This temporary authority transition is part of the authorized release.

Production 0043 additionally certifies every family table/index/trigger/constraint
against the two reviewed migration files. The recovery receipt binds root HTML
and module bundle byte counts/SHA256 to the flags-OFF build; a used recovery must
fetch and match those exact served assets before recording success. Same-SHA
service-worker metadata alone cannot distinguish the ON and OFF UI builds.
Staging preserves exact aggregate counts and media diagnostics, not database byte
content or R2 availability; runtime catalog/media authority checks remain separate.

Hosted staging pre-health exposed D1's SQLite column limit: the103-column
aggregate baseline cannot execute under SQLITE_LIMIT_COLUMN100. Split the
unchanged aggregate set into two reviewed SELECTs (84and19columns) and require
complete successful result shapes before normalization. Saved pre-baselines retain
strict103-field validation. This is read-only count preservation across observations,
not a transactionally pinned snapshot or byte-content proof. Exact current-main/CI,
ledger/bookmark/schema gates and migration order remain unchanged.

## ADR-062 - Bounded family planner response and exact trusted-input reuse (2026-10-15)

Accepted for T26 under the user's production hang report and comprehensive fix
request. The existing synchronous deterministic planner repeatedly clones and
fingerprints the same immutable500-recipe snapshot and scores equivalent pools.
The selected-component cap does not reflect hidden pool work. Browser requests
also have no completion deadline, so a stalled response leaves the UI busy forever.

Retain the current architecture and persistence contracts. A derived branded
planning context may reuse already-validated frozen catalog, reference, inventory,
substitutions and evidence from an original server context, validating same-scope
ranking overrides. It cannot accept serialized/client contexts or change tenancy.
Request-local pool reuse must bind exact slot/date/instant/servings, projected lots,
role, exclusions, repetition context and family cuisine/template eligibility. Never
reuse quantity or safety witnesses across changed inputs. Move existing family
eligibility before bounded pool selection so ineligible dishes do not displace
eligible Vietnamese choices. T02/T03 checks, chronological consumption and final
DB/profile/catalog/revision fences remain mandatory. No schema or migration change.

Planner/profile requests receive a30-second browser deadline including full body
reads, abort normal transport and reject even a transport that ignores abort.
Uncertain create delivery retains its exact intent/key; recovery offers retry and
current-plan access. Late aborted responses cannot seed caches or clear identity.
The timeout does not certify a server rollback or imply a failed commit. Existing
revision-fenced edits must reload after uncertainty. This is local product repair;
production CPU exhaustion is not asserted without production runtime evidence.

T26 refinements: reserve full eligible recipe/simple-food pool evaluations before
scoring, plus selected-component rechecks, with a32768-unit generated-work limit.
Per-candidate weight is max(1,ceil(inventory lots/32),ceil(feedback events/128));
it is a deterministic safety bound, not a CPU-time certification. Locked
preservation still validates safety after generated work exhausts. Pool reuse never
crosses slots and binds full projected rows, eligible IDs and relevant exclusions.

Browser retry fingerprints include selection mode, validated intent and family
draft preferences; HTTP bodies and backend idempotency contracts are unchanged.
Changed family choices receive another key; unchanged uncertain requests retain
the existing key while the setup remains mounted. A timed-out profile PUT is
reconciled on explicit retry with a fresh GET and matching newer revision/content.
Conflicting content requires reload; the browser never blindly overwrites it.

# ADR-TAKOLIO-004: comprehensive visual polish without changing product contracts - 2026-10-16

**Status:** accepted for feature-branch implementation; review required.

## Context

The first Takolio migration establishes the identity contract and compact kitchen
shell, but browser review found two mobile presentation defects: missing recipe
media wraps into narrow letter columns and the fixed fridge add action can cover
the empty-state scan action. The 3D candidate also needs stronger semantic pose
separation and prop contact before it can be described as a polished illustration
set.

## Decision

Add one final, scoped Takolio visual layer for `[data-kitchen-density='compact']`
and entry/onboarding surfaces. It defines spacing, surface, typography, focus and
motion relationships using existing semantic tokens; it does not create a second
color authority. Empty and media states gain responsive layout rules while keeping
existing callbacks, routes and accessible names. The shell's measured action
reserve remains the source of truth. The empty fridge presents the existing add
action beside its scan action in document flow and hides the duplicate floating
control while that empty-state block is visible.

Refine the existing Blender candidate in its authoring source only: pose multiple
armature segments per state, position cooking/completed props against the body and
hands, use a local tangent frame for sucker placement, reduce redundant catchlights
and soften the chef-hat/skin highlight response. The six states remain transparent
static illustrations with the same contract URLs and SVG fallback. Native Blender
and GLB files stay local handoff files; no WebGL runtime or new dependency is added.

## Compatibility and limits

No route, API, session, auth, payment, Worker, database, migration, flag, domain,
persisted identifier, recipe authority or household behavior changes. Existing
Takolio/V3 assets remain additive and rollback is a feature-branch revert. The
result remains a 3D candidate until fresh screenshots, asset checks and independent
review confirm the visual result; premium concept fidelity and legal clearance are
not asserted.

## ADR-063 - Preserve readable primary text and wrap unknown-expiry stock (2026-10-24)

Status: accepted for isolated local continuation; owner/device review pending.

Current-source UI15 audit reproduces Home, discovery and recipe preparation CSS
opacity from 0 through 1 during the existing 200ms fade. Reduced motion already
keeps opacity1. Remove the fade class only from those three primary reading
containers; preserve all decorative, dialog, auth and payment animation contracts.
No replacement animation is needed for reading content.

Actual Week flags-OFF shopping import/replay exposes unknown-expiry stock. At
320x420/root text200, IngredientRow's enlarged image/gap and nonwrapping status
force document width343px. Allow the existing identity/title/status layout to
wrap within the row. Preserve status text, expiry truth, controls, callback,
quantity, mutation, idempotency, household and inventory authority unchanged.
Use intrinsic layout; no clipped status, smaller text or global overflow hiding.

The old UI15 navigation237px baseline does not reproduce. Current Argon compact
CSS already puts mobile navigation and fixed actions into document flow below
600px height; the static header scrolls away. Preserve this tradeoff, measure
keyboard reachability and report the loss of always-visible navigation on short
screens. Do not replace the shell or add measurement machinery. ADR058 is already
the family-meal decision; this continuation uses the next unused number063.

Bounded Chromium/local Worker fixtures and synthetic root-font scale do not
certify native zoom, devices, Safari, screen readers, owner usability or hosted
release. No backend, service, store, public asset, dependency or protected payment
change is authorized by this decision.

## ADR-064 - Scoped control contrast for placeholders and notification OFF state (2026-10-24)

Status: accepted for isolated local continuation; owner/device review pending.

C12 settled Chromium measurements found the existing muted placeholder on discovery,
saved recipes, family preferences and shopping inputs at approximately 2.41-2.54:1
against their surfaces. The notification OFF switch track measured 1.768:1 against
its white thumb. Existing solid green focus outlines meet the measured keyboard
focus requirement and remain unchanged.

Apply the existing semantic muted text color only to the affected placeholder
selectors under `.takosan-rebuild`, with full opacity. Apply the same muted color
only to enabled notification OFF switch tracks under `.takosan-rebuild`; checked,
disabled and unrelated switch primitives retain their current contracts. Do not
define the missing global border token or alter decorative separators, auth,
payment, Plus, backend, APIs, stores, assets, dependencies or production config.

Verify normal, focus, hover and reduced-motion states at 390px, 320px with root
text scale 2, and desktop; preserve 44px reachability, keyboard activation,
local preference reload behavior, zero domain writes and unchanged domain snapshots.
This bounded Chromium/root-font audit does not certify native zoom, devices,
Safari, screen readers, hosted behavior or production.

## ADR-065 - Scoped inset boundaries for measured kitchen controls (2026-10-24)

Status: accepted for isolated local continuation; owner/device review pending.

C13 measured 44 controls in four viewport/text configurations. The undefined
`--semantic-border-rgb` leaves their computed borders at 0px/none; adjacent fill
contrast is only about 1.00-1.06:1. Existing solid green focus outlines remain.
Defining the missing token globally would also change unmeasured decorative
surfaces, so this packet does not define it.

Add a 1px inset stroke using existing semantic muted text RGB only to the measured
kitchen search, discovery select/filter disclosure, planner locale/date/number,
and shopping form input/select selectors under `.takosan-rebuild`. These controls
have no existing box shadow. The inset stroke must preserve geometry, input and
select behavior, focus outline and all domain authority. Exclude native radios,
checkboxes, unrelated controls, auth, payment, Plus and decorative cards.

Verify stroke contrast against both fill and surrounding surface, normal/focus/
hover states, 44px reachability, horizontal bounds and baseline geometry at
320x568, 320x420 with root-font200, 390x844 and desktop1440x1000. Use the actual
isolated Worker fixture; no submitted domain writes. Chromium/root-font evidence
does not certify native zoom, physical devices, Safari, assistive technology,
owner acceptance or hosted production.

## ADR-066 - Lot-owned display category and immutable manual CREATE response (2026-10-24)

Status: accepted; locally implemented and verified at `820b0bd486aa17adc9a3cb3cba886b3ee7b62e3c`.
Full CLI15s suite, actual local D1, browser, independent review, protected scope
and recovery with authorized platform drift verified. Default timeout and audit
FAIL remain disclosed in the CAT01 report. No release authorization.
Active packet: `tasks/CAT01-display-category-authority.md`.

The bounded inventory audit confirms an unmapped spice item reads back as other:
current lot authority retains no display category. The inventory POST route also
checks mutable current projection state before native receipt replay, so a later
PATCH can cause false CREATE conflicts or falsely accept changed retry intent.
Category persistence and receipt-first CREATE replay share one acceptance gate;
the previously proposed CAT02 is included in CAT01 rather than left as an interim
idempotency regression.

Add optional lot `displayCategory`, backed by nullable `display_category` in
additive migration0044. Validate string/max30/noNUL at input and SQL boundaries;
retain empty-string compatibility. Omit the field for SQL NULL; explicit JSON null
is invalid. Effective category is canonical ingredient category, then lot-owned
displayCategory, then other. A user category never overrides canonical identity.
Never borrow category from mutable inventory_items after adoption/authority.
Preserve request intent independently from the effective compatibility projection.

No migration data backfill, receipt/event rewrite or invented historical intent.
Existing NULL lots retain catalog/other behavior until explicit metadata correction.
New adoption can capture current validated legacy category as its own fenced
transition, preserving truthful before even for an old unlinked backfill without
the field. Include category in full source/revision/poststate fences. Already
adopted lots cannot recapture projection category. Invalid historical values fail
closed without automatic repair. This nullable ceiling is deliberate.

Manual CREATE adds optional manualCreate requestFingerprint/projectionAfter to the
existing immutable fingerprint envelope, mirroring manualPatch; no new table.
Fingerprint validated original request, including category, expiryEstimated and
dataSource, before catalog/default derivation. Owned receipt lookup precedes
mutable row comparison, preserves tenancy/membership and replays the original
response after later stock/category changes. Changed intent conflicts. Historical
native receipts lacking original intent fail closed409 rather than inferring it
from current projection. Preserve non-native legacy idempotency. ManualPatch keeps
its original request fingerprint but stores effective projected category so strict
receipt decoding remains consistent. Scan category propagation is narrow; review
history/merge semantics remain a separate packet.

Retain all existing0028 v1 guards,0030 FEFO compatibility/mapping/version-offset
predicates, immutable receipts/events and household/quantity/revision boundaries.
Add shallow v1 category guards; recreate active0030 FEFO triggers only for optional
25th-field shape, category type/presence/prestate/preservation/poststate validation.
Require canonical reverse-diff proof and actual local D1 expression-depth testing.
Old24 snapshots remain decodable and unchanged; new field cannot be silently
dropped or changed by USE/DISCARD/OPEN/MOVE/FEFO. No-op receipts remain valid.

Apply0044 before the new Worker. Old writers remain valid for NULL lots but fail
closed if they drop a retained category; mixed-worker writes to categorized lots
are not certified. Application rollback keeps additive schema and needs separate
operator review. No production/remote migration/deployment authorization follows.
Before completion require populated upgrade/forgery/rollback tests, immutable retry
coverage, full local checks and actual Worker browser/readback evidence. Preserve
Argon work and all0024-0043 bytes. Scan manual-history and Week offline durability,
owner/device/hosted acceptance remain separately scoped.

## ADR-067 - Atomic accepted manual scan history and explicit presentation (2026-10-25)

Status: accepted for isolated local implementation. Active packet:
`tasks/SCAN01-manual-review-history.md`. CAT01 is verified at implementation
`820b0bd486aa17adc9a3cb3cba886b3ee7b62e3c`, documentation checkpoint `a4fa573a`.

Confirmed manual photo-review additions currently enter stock but are absent from
fresh scan history. Retain accepted manual lines in existing scan_items through
plain INSERT SELECT statements using the exact household/READY predicate and
existing atomic batch. Keep status last. Reuse reviewed expiry conversion and
SHA-256 over JSON [scanId, clientId-or-null, originalSubmissionIndex]; reserve
`scan_manual_` plus 64 lowercase hex digits for server-created manual history.
No migration, dependency, historical backfill or frontend rebuild.

Store reviewed name, quantity, unit, mapping, category, storage and explicit
KNOWN/ESTIMATED/UNKNOWN expiry independently of mutable stock. All OCR and price
columns remain NULL; legacy NOT NULL confidence is schema filler only. Keep
manual sourceId absent for stock evidence, receipt attribution and observations.
Do not invent OCR source links or change existing confirmedItemIds semantics.
The existing status-based replay contract remains: confirmed retries ignore
changed valid payloads and cannot repeat mutations. Stronger intent replay is
outside this task. Preserve existing native/legacy merge and receipt-lot rules.

GET may emit optional isManual:true only for confirmed reserved-namespace rows
with absent OCR/confidence/prices. Unknown legacy OCR remains unknown OCR.
Persisted manual rows retain sourceItemId membership/read-only behavior. Existing
photo/receipt reviews label them Nhap thu cong (localized UI text), suppress OCR
claims and use neutral history copy; no receipt manual-add affordance is added.
The namespace is a deliberate ceiling: an imported historical row intentionally
using it cannot be distinguished without a future schema field. Document this in
one ponytail comment; introduce a schema origin field before such imports.

Require baseline-failing real SQLite HTTP regression, both authority modes and
scan types, fresh UI reopen, actual transport/body/outbox replay, race/collision/
rollback/security/metadata tests, full local gates and actual Worker browser
screenshots at320 and desktop. No payment/auth/infrastructure changes. Preserve
Argon source, snapshots, existing ledgers/evidence and authorized platform drift.
No push, merge, deploy, remote migration or production authorization follows.


### ADR-067 verified local result - 2026-10-25 JST

SCAN01 implementation and bounded checks complete. Four runtime files; no schema
or dependency change. Full415/415files,9279/9279tests PASS with explicit CLI15s;
focused8files/178tests,lint,types,migrations,default/paired-ON builds PASS.
Audit remains FAIL(0low/3moderate/2high). Actual Worker-router browser4flows at
320/1440,8PNG,SQL/GET/read-only/replay PASS; synthetic Node SQLite,not native
D1/workerd/hosted. Failures and recovery platform drift remain disclosed.
See SCAN01 report and frozen evidence. WKD01/WKD02 require separate ADRs.

ADR-067 implementation verified at `a4e405508453908cd6f7b7b677f98156ccbdcdd7`;
post-implementation scope PASS. Verbatim logs preserve six trailing-blank warnings.

## ADR-068 - Durable local outbox acceptance and truthful pending stock (2026-10-25)

Status: accepted for isolated local WKD01 implementation. SCAN01 verified at
implementation a4e405508453908cd6f7b7b677f98156ccbdcdd7 and documentation
4d330940c328d70ca49384fa54792e95637a3dd5. User authorized sequential local work.
Active packet: tasks/WKD01-durable-offline-queue.md.

Preserve frigo_sync_outbox_v1, JSON record format, owner scope, operationId,
dedupeKey and exact body/header bytes. Strict load rejects unreadable, corrupt,
unowned or invalid records with OutboxPersistenceError, preserving original bytes;
only missing key means empty. Validate stored/new records without a schema layer.
Native localStorage.setItem success is the durable acceptance boundary. Do not
reclassify a successful write through post-write diagnostic readback. queueWrite
returns the accepted PendingOp, including an existing scoped dedupe receipt.

Emit/listeners never reject accepted writes. Diagnostic pendingCount/subscription
uses number|null; null means unavailable, never empty. Automatic retry consumes
rejection and emits diagnostics; manual retry shows a recoverable warning. Logout
warns conservatively on unknown pending data, retaining explicit discard/auth flow.
Unowned historical records are preserved and block mutation/replay; this explicitly
supersedes only the prior client-session test expecting their automatic deletion.
Explicit logout deletion remains authorized user behavior; auth source unchanged.

Flush separates network classification from durable removal. A successful replay
counts before removal; removal persistence failure throws and retains the op.
API finally reconciles accepted paths even when removal fails, without masking
the persistence error or crossing the private-session fence. Keep auth/409 retention,
permanent-error behavior and in-tab serialization. Failed owner rebind preserves
all source/target bytes and throws. No cross-tab transaction claim.

Delete Week shopping's optimistic stock addition; pending commands do not represent
imported stock. Keep numeric importedItemsCount compatibility as queued-line count
when pendingSync is true, with explicit pending-only message. Reconcile server
inventory after replay. No guessed repair of previously inflated caches.

Every enqueue caller must persist before cache projection. Post-acceptance cache
failure returns accepted pending result/ID rather than inviting another generated
command. Identity/session assertions remain outside/before final returns: never
swallow identity uncertainty as a harmless cache failure. Two distinct add calls
without the same supplied ID remain distinct actions. Cooking/shopping retain
strong body/path/owner receipt checks via returned receipt, avoiding post-acceptance
storage readback. Local-only scan partial enqueue remains an explicit ceiling.

No new storage service, dependency, migration/backfill, generic offline framework,
payment/auth/infrastructure change, push/merge/deploy/remote production operation.
Require baseline-failing regression, corruption/quota/reload/rebind/removal/session/
caller tests, actual Worker browser320/desktop with SQL readback, full local gates,
recovery/scope proof and state/report updates. WKD02 keyed swap receipts remain a
separate ADR and transaction contract.


### ADR-068 verified local result - 2026-10-25 JST

WKD01 bounded implementation verified: full416files/9319tests PASS, focused8/280, backend2/149, lint/types/migrations/default/paired-ON builds PASS.1184frozen source/test/config hashes unchanged. Audit remains FAIL(0low/3moderate/2high).32PNG over4viewport/flow cases prove exact queued request and stock2 pending/reconnect8 once; replay SQL/GET unchanged. Actual Worker-router/synthetic Node SQLite,not native D1/workerd/hosted/device certification. Review-found concurrent-shopping marker race fixed with RED/GREEN regression. Failed attempts and authorized recovery platform drift retained. See WKD01 report and evidence. No all-endpoint replay or cross-tab atomicity claim; WKD02 needs its own ADR.

ADR-068 implementation verified at `cc426b04baa84cb4bb3a861b0d606764675b4d20`; post-implementation scope PASS. Public evidence independently reviewed; ten verbatim-log EOF blank-line warnings retained, source/docs whitespace PASS.

## ADR-069 - Durable keyed Week swap receipts and explicit conflict recovery (2026-10-25)

Status: accepted for isolated local WKD02 implementation. User authorized sequential local work. Active packet: tasks/WKD02-week-swap-replay.md. WKD01 implementation cc426b04baa84cb4bb3a861b0d606764675b4d20, documentation2cde9235f5088b416fbe74935a7bcd801fa8c2ed, post-docs scope PASS. No WKD02 runtime/schema acceptance claimed before executable gates.

Observed swap ignores a supplied stable key and rewrites old A after later B. Add one immutable week_swap_receipts table in next unused migration0045. Identity UNIQUE(household_id,plan_id,meal_id,client_key); same key on a different target is independent. Auth supplies actor/household. Fingerprint is the normalized requested recipe token, never mutable catalog. Bounded key grammar/equality applies across all supplied commandId/idempotencyKey/header keys; keyless legacy writes and alternatives remain compatible. No old plan snapshot, plan-child FK or inferred receipt backfill. Household-lifetime FK/immutable INSERT/UPDATE/DELETE guards follow existing receipt conventions; additive migration must preserve populated rows and permit household cleanup.

For a keyed explicit swap, read owned relational plan without plan KV publication, then lookup receipt before target-slot/catalog validation. Match returns current owned plan plus idempotentReplay:true; changed fingerprint returns409 IDEMPOTENCY_CONFLICT. Missing/deleted plan remains404; receipt cannot recreate it. Catalog authority remains lazy for stored snapshots. Insert the receipt first in the exact existing D1 batch containing every legacy/dual plan statement. Pass one optional typed D1 prepared statement through existing persistence helpers. Never INSERT OR IGNORE/upsert a receipt or commit plan separately. After batch error reread exact receipt; winner match replays current state, mismatch409, absent503. Domain cache publishes only after winning commit. Replay/conflict makes zero relational/plan-cache writes; existing rl_swap/rl_week_w counters remain authorized middleware behavior.

Narrow client response-loss retention to explicit keyed swap fetch/body transport TypeError or uncancelled AbortError. Freeze exact body/header/key once; session and explicit cancellation fences win. Enqueue durably before optional cache projection under WKD01. Keep fetch catch separate from known-success/cache handling. HTTP/auth, SyntaxError, malformed success/application/cache failures never become pending transport success. Optional AbortSignal preserves three-argument callers. Accepted pending response exposes pendingSync. Direct/replayed response uses current plan, preserving B after replayA.

Retain precise swap409 conflict in outbox. A transient owned exact-op snapshot in existing API and existing sync notification exposes fixed safe banner copy. No new queue format/error bus. Existing ConfirmDialog explicitly offers reload and discard of this one request; cancel retains bytes. Recovery runs in existing flush mutex: authenticate, replay original; if the same precise409 and approved exact snapshot remain, fetch/validate/cache authoritative owned plan and refresh matching existing queries before permitting only that operation's durable removal. GET/cache/removal/session failure retains request. No global409/auth drop or silent queue discard. Missing plan remains visibly blocked; broader queue administration is outside scope.

One ponytail comment records the existing full-snapshot concurrency ceiling: receipts prevent duplicate keyed writes, not lost updates among distinct fresh commands; add shared revision/CAS across every Week writer in a separate packet. Existing single-tab localStorage mutex does not provide cross-tab transactions. Create/regenerate/slot/shopping/preferences commands, V2 composition, inventory/security/tenancy, PayOS/auth/infrastructure, applied0001-0044 bytes remain protected. No dependency, release configuration or frontend rebuild.

Require baseline-failing actual Hono+SQLite A/B/replay and service transport/body regressions; exact conflict/key/tenancy/retirement/slot replacement, atomic rollback/deterministic commit races, immutable/populated migration and local D1 apply; legacy/dual plus inventory-mode invariance; focused/full lint/types/tests/migrations/default and paired-ON builds; actual320/desktop browser offline/reload/reconnect/conflict recovery; private recovery and scope evidence plus independent review. No push/merge/deploy/remote migration/production operation.0045 must precede a future new Worker; retained schema and mixed-worker replay limits need separate operator release review. Device/Safari/screenreader/hosted/owner acceptance remains pending.


### ADR-069 verified local result - 2026-10-25 JST

WKD02 acceptance executed: full420files/9430tests PASS,backend6/114,client6/251,response-loss6cases;lint/types/migrations/default/actual paired-ON builds PASS. Local D1 preserves94tables/9920old rows,zero backfill,immutable attacks/rollback/cascades PASS. Browser4flows320/1440,44PNG including existing Playwright2tests.1233source hashes unchanged;independent static reviews no concrete unresolved finding. Baseline/intermediate/full-artifact-discovery/validator failures retained. Audit FAIL0low/3moderate/2high;26verbatim evidence whitespace warnings retained. See WKD02 report/evidence. Recovery precommit PASS_WITH_AUTHORIZED_PLATFORM_DRIFT;ten authorized .DS_Store deltas separately backed up. Keyed deduplication/current-plan replay/explicit exact409 recovery verified locally; no distinct-command CAS,cross-tab,hosted/device or production claim. Implementation checkpoint/scope binding follows separately.


ADR-069 implementation verified at `89d0ea243d08e98670a512ef797da4f64ac516f4`;implementation scope PASS:9112unchanged-parent/5782protected-main paths,44old migrations,54salvage,1233source hashes unchanged. Exact proof:`evidence/week-swap-replay/implementation-scope.json`. This documentation checkpoint binds that verified implementation;post-docs proof is generated after commit and kept locally. Remaining external acceptance/dependency and full-snapshot concurrency ceilings unchanged.


# ADR-070: bounded V2 release migration certification - 2026-10-25 JST

Status: release preparation authorized by the operator request to deploy production;
independent GitHub reviews and all release acceptance gates remain binding.

Current main has migration0043. The successful canonical staging receipt from run
39833771432 independently records the same43-entry ledger on2026-10-22; this is
historical evidence, not a fresh remote inspection. The inherited family migration
workflow is bound to the retired repository identity and its0041->0043 contract.
Do not rewrite that historical contract or broaden protected auth/payment paths.

Add a separate manual staging0043->0044->0045 adapter using the existing migration
runner and pinned staging D1 identity, with canonical Takolio repository ID, trusted
current-main/workflow SHA, hosted CI, fresh bookmark, exact ledger/plan and health
gates. Capture counts of all94pre-existing tables plus catalog/media diagnostics
in two bounded SELECTs; compare exact changed table/index/trigger SQL against the
source migration chain. Partial, unexpected or future ledgers fail closed. Retain
the protected production migration workflow; include0044/0045 in both immediate
main/CI fences and certify the exact V2 schema at0045. Add receipt objects to the
shared schema gate without exceeding D1's five-compound-SELECT limit. Accept
operational ready media at reviewed0045 only; unknown future tips stay rejected.

Migrations must precede the new Worker. Retain0044/0045 on code rollback; do not
replay or down-migrate them. Old workers cannot provide keyed swap deduplication
and may reject category-bearing inventory receipts: see WKD02/CAT01 compatibility
evidence. Prefer the current-candidate recovery validated by the domain release
flow. Mixed-worker and rollback acceptance remain operator release gates, not
claims established by local tests. No production deployment, remote D1 mutation,
review bypass, credential change or auth/payment modification is implied by this ADR.

Validation runtime: hosted Node22.23.3 stores embedded NUL bytes but truncates
TEXT results while reading `node:sqlite`. The unchanged CAT01 historical-invalid
category assertion then receives PERSISTENCE_FAILED instead of
INVALID_ADOPTION_SNAPSHOT. Reproduced with native SELECT and CAT01; Node24.16.0
preserves the complete string. Pin only the three full-test jobs (CI, Admin CI,
Deploy production local gates) to24.16.0 and retain a real SQLite round-trip
regression. No Worker runtime or input-validation change. Re-review and update
the schema-gate SQL fingerprint after the additive0045 read-only checks; retain
the existing exact fingerprint and mutation-negative assertions.

Admin release compatibility: the existing preflight freezes the reviewed domain
customer surface and the SQL matrix freezes the earlier43-migration baseline.
Both correctly reject this V2 candidate before review. Preserve those immutable
baselines and every historical R1/43 scenario. Create a separate immutable V2
source checkpoint covering the exact reviewed migration/workflow/schema bytes;
select it only when it is in HEAD ancestry. Keep main-history drift checks and
exact working-tree diffs. Extend the matrix with45-file fresh/incremental gates,
missing/future-ledger rejection and explicit old43-gate rollback rejection. Add
real temporary-Git regression cases for V2 selection, post-pin changes, normal
merge and parallel-main drift. This checkpoint remains a candidate for independent
PR review, not evidence that review or deployment occurred. Never select moving
HEAD/main as an automatic accepted baseline or disable the guard.

## ADR-071 - Receipt-compatible production recovery before V2 traffic (2026-10-25)

Status: authorized release correction; independent exact-head review and real
same-SHA staging acceptance remain required. Supersedes ADR-070's unverified
assumption that the domain adapter already prepares current-candidate recovery.

Reviewer reproduction against exact production source571f3c229696d6bc766de89f552a36f48ca92e58
shows a V2 category-bearing USE receipt replays on the candidate but fails with
CORRUPT_RECEIPT on that previous binary. The existing production adapter blindly
restores that binary. Additive0044/0045 retention alone does not make it safe.

Before normal candidate compilation/upload/activation, build and strictly upload
an inactive recovery version from the exact candidate source with both planner
and composition disabled in server and compiled UI. Derive its config from the
fresh audited candidate; change only those two feature flags and their two build
flags. Preserve security settings including STRICT_OTP_FAIL_CLOSED, complete
bindings/secrets, catalog, exposure, queue/cron/observability and all host fences.
Record source/config/build asset commitments and verify immutable uploaded metadata
before activation and recovery. Rebuild the ordinary candidate after recovery
upload, so its UI retains the audited normal feature state.

After any candidate activation intent, never automatically return to the old
binary. Recover only to the recorded compatible version. Retain owned host detach
and traffic/operational fences, reconcile interrupted activation by exact owned
version, verify a completed recovery idempotently, reject foreign deployments and
ambiguous mutation retries. Verify restored runtime, ledger0044/0045, original
infrastructure, candidate recipe authority, readiness/service worker and exact
flags-OFF HTML/module bytes. No data rollback, schema rewrite, payment/auth change,
protection bypass or acceptance attestation is implied. Stage rollback rehearsal
and final-head hosted checks remain release requirements.

ADR-071 staging scope: use the same compatible recovery preparation and verifier
for staging, preserving its Access transport and private restricted email policy.
A real staging rollback must exercise this named flags-OFF version, never the
pre-V2 binary. Keep the normal protected workflow and acceptance evidence gates.

ADR-071 rehearsal: every protected staging release now exercises compatible
recovery after initial host proof, retaining the exact OFF asset/runtime result.
Only after fresh exact-main CI, unchanged full recovery audit, owned deployment
and both immutable version metadata checks may it reactivate the already uploaded
normal candidate. Persist reactivation intent before POST; re-prove legacy and
hosts before finishing. Interrupted reactivation may reconcile only the recorded
recovery deployment or exact candidate; unrelated traffic still fails closed.
Infrastructure rehearsal does not attest Google/OTP/payment/user/device checks.

ADR-071 HTML evidence amendment (2026-10-25 JST): staging release40201806613
reached the exact same-source OFF recovery but failed byte verification because
publicDomainRouting adds OG/canonical/Twitter metadata to raw index.html. Domain
providers now commit the expected root HTML after that existing deterministic
transform, using the verified environment app origin. Live responses still require
exact byte count and SHA256, with unchanged module fingerprints. No normalization,
script stripping, analytics allowlist or runtime/security change is accepted.
Actual Worker/StaticAssets regressions cover staging and production and reject
unexpected metadata/scripts/modules. Local full suite425files/9515tests PASS;
real staging recovery/rehearsal remains unverified. Current staging OFF state must
be reconciled to its recorded same-source ON version before a new V2 release;
provider flag preservation must never be mistaken for enabling V2.

## ADR-072 - V3 lossless candidates before runtime promotion (2026-10-26 JST)

Status: accepted for isolated local candidate tooling; runtime publication blocked.

The approved 500-ID V1 release remains the runtime authority. V2 preserves 6,766
ingredient lines and 4,938 steps, but its provisional projection excludes 2,996
lines and retains four independently derived release blockers. Cooking start does
not persist a content version; completion resolves the current catalog. Composition
components retain recipe IDs; shopping has existing catalog-fingerprint fences.
See `recipe-intelligence-v3/audit/RECIPE_V3_CONSUMER_MAP.md` for path-level evidence.

Choose a versioned candidate sidecar using immutable V2 file references, exact
old/new editorial patches, V1/V2/content hashes and explicit review outcomes.
Reconstruct and validate the complete payload with the existing strict V2 schema;
never serve a partial sidecar to runtime consumers. Preserve every ingredient,
quantity, step, nutrition state and provisional identity. Editorial edits cannot
change identities, quantities, shopping roles, nutrition roles or servings.
Evidence-backed structural/quantity changes need a separately reviewed compiler
extension and consistency tests. Candidate compilation confers no human approval.

Alternative: promote a full versioned RuntimeRecipe now. Rejected because source,
ingredient and nutrition evidence and historical snapshot compatibility are not
established. An immediate D1 content-version table would add an unused authority.
No migration is needed for review artifacts. No recipe API, planner, shopping,
cooking, inventory, offline, payment, auth, Admin or release-workflow change is
part of this checkpoint. Existing consumers continue to read their current source.

Promotion prerequisites: reviewed ingredient transformations and nutrition,
URL-specific claim evidence, preserved hard restrictions, explicit plan/cooking
version pinning with old-snapshot readers, deterministic final projection,
independent review, same-source staging and operator release approval. Rollback of
this tooling is branch/code rollback; no user data is written or restored.

## ADR-073 - V3 validation branches and bounded dependency patches (2026-10-28 JST)

Status: accepted for validation-only CI and compatible dependency patches;
production release remains blocked by ADR-072 and the release packet.

The V3 stack has twelve independent Draft PRs. Only its first PR targets main,
so the existing CI filters leave later implementation heads without hosted
validation. Add a dedicated Recipe V3 CI workflow for `codex/recipe-v3-**`
pushes, reusing the original CI steps and read-only permissions; add the same
push filter to Admin CI. Preserve original customer ci.yml byte-for-byte because
Admin preflight pins it. An initial direct edit correctly failed that guard;
restoring the file and adding a dedicated workflow resolves the conflict without
changing preflight, its baseline or history fences. Keep independent review units,
existing main/PR triggers, pinned actions, complete checks and Environment
protections. Branch CI cannot substitute for protected exact-main release CI,
independent review or staging. Deployment/migration workflows remain unchanged.

The current dependency audit reports five high and five moderate advisories.
Advance Hono within major4 from4.13.7 to locked4.13.13 (manifest floor4.13.11),
and override only miniflare's Undici edge from7.29.1 to7.30.1. Retain Wrangler,
Miniflare, workerd and every unrelated dependency byte. The override is limited
to the installed development-tool dependency until its upstream manifest uses
a patched compatible Undici; remove it after that graph is verified. No new
runtime package, auth/payment source change, catalog data or migration is added.

The observed remaining audit finding is Zod3.25.76, GHSA-mrhx-c7xc-m3w5.
A bounded reproduction confirms max(2) still parses all1,000 input elements.
Upstream's first patched version is4.6.6. Switching imports to zod/v3 under a
new package version would retain the affected parser and is not remediation.
A major upgrade affects protected PayOS's one-argument z.record call and
validation error contracts. It also invalidates the established release
continuity proof, which binds Zod version/integrity. This checkpoint neither
changes those protected consumers nor waives the advisory/continuity gate.
A reviewed migration preserving those contracts and fresh catalog certification
is required before release. No audit suppression or protection bypass is added.

Rollback of these patches is a normal reviewed code/lockfile rollback; it does
not alter database or user state and restores the prior dependency advisories.

## ADR-074 - Authorized Zod 4 security compatibility migration (2026-10-29 JST)

Status: accepted implementation scope; local full gate PASS (429files/9597tests); audit PASS (0 vulnerabilities); independent technical review found no remaining concrete issues. Hosted, human and operator approval are separate.
The owner explicitly approved the Zod migration exception, including the two
PayOS/billing records, contract tests and fresh local catalog certification.
This supersedes the pending-exception statements at the prior checkpoint.

Problem: Zod3.25.76 is affected by GHSA-mrhx-c7xc-m3w5; an array maximum still
traverses every invalid element. The patched parser requires >=4.6.6; importing
zod/v3 under an upgraded package would retain the vulnerable implementation.

Decision: migrate root Zod to the patched 4.6.7 parser. Limit protected changes
to necessary schema/type/error compatibility. Preserve HTTP status/envelopes,
custom validation messages, signed payment verification, prices, grants, tenant
and session authority. Update the bounded OpenAPI exporter with explicit
unsupported-node/check rejection and runtime refinement/transform markers.
No payment business behavior, production infrastructure or remote data changes.

Compatibility findings: Zod4 defaults skip nested parsing and its datetime grammar
rejects previously valid colonless offsets/minute precision. Use prefault for
recipe/family provenance; shared UTC/offset schemas retain the old timestamp
grammar and bytes, with all caller calendar/finite/offset checks intact. Existing
stored inventory lots remain readable and command replay retains exact bytes.
Technical reviewer probed 1,170 datetime combinations against Zod3 and found
parity; regression coverage includes actual persisted CREATE/CORRECT/read/replay.

The candidate audit previously required every pinned file to match b49f3e6c
byte-for-byte. Permit only the single exact string-key record substitution in
refresh/release.ts; every other byte/path remains pinned. Negative self-checks
reject extra drift, other paths and duplicate baseline markers. The generated
baseline truthfully records matchesBaseCommit=false, ADR-074 and both hashes.
This candidate-audit compatibility exception does not change the production
D1 continuity fence, release eligibility or food-content approval requirements.

Verification: compiler and full repository gates; focused invalid-request,
payment/auth, OpenAPI and oversized-array regressions; fresh dependency audit;
recompile current catalog, byte-compare seeds and verify candidate artifacts.
Keep the existing production catalog continuity dependency fence unchanged:
local recertification alone cannot authorize unchanged-D1 continuity across the
parser upgrade. Normal review, fresh staging/certification and Environment
approval remain required. Rollback is a reviewed dependency/code revert; no
schema or content migration is introduced by this change.

## ADR-075 - Immutable cooking content and durable replay (2026-10-29 JST)

Status: accepted implementation scope; publication and deployment gates remain.
Supersedes ADR-072's no-runtime-change scope for cooking compatibility only.

Cooking completion currently loads the latest recipe before replaying its receipt.
A catalog update can change inferred units, ingredients or steps after a person
starts cooking; a removed catalog entry can also prevent a committed retry.

Add migration0046: immutable server-owned RuntimeRecipe content keyed by the
existing single-recipe SHA256, independent of mutable recipe rows. Detail/start
capture the trusted, unscaled, pre-media content. Detail metadata carries its
fingerprint separately from Recipe; serving scaling cannot change that identity.
The cooking store freezes it with the command and offline queue body. Completion
loads that exact archive or captures an exact current match, never client content.
Cooked receipts add a nullable version reference; legacy NULL means unknown, not
an inferred V3 version. Replay precedes catalog resolution and compares the version,
servings and deductions using the durable receipt's units. Inventory transactions,
tenancy, FEFO and Week behavior remain unchanged.

Unversioned new commands remain compatible only with the fixed V1 static/full500
fingerprints. A future catalog must reject them with RECIPE_VERSION_REQUIRED;
old queued bodies are never rewritten. Legacy receipts replay by stable recipe ID;
a historical slug is accepted only when independently recoverable from the static
baseline or immutable archive. Unknown legacy aliases fail closed.

Archived content is evaluated against current household policies using only its
own ingredient/time facts (the existing static restriction path). Current mutable
D1 classifications/nutrition are not evidence for historical content. This may
reject time/nutrition/safety-constrained cooking when archived evidence is unknown;
never fill those facts from a different version. Versioned restriction evidence is
a separate prerequisite for relaxing that conservative behavior.

Migration is additive; old Workers ignore the nullable receipt field and archive.
Rollback keeps archive and receipts; no down-migration or user-data restoration.
Deploy only after0046, exact schema/ledger verification and normal independent
review/staging/production gates. This does not publish candidates or certify the
500 recipes, planner/composition compatibility, nutrition or food safety.

0046 review clarification: archive existence never grants a household access.
Persist `(household_id, fingerprint)` only after that household resolves the exact
version through its allowed authority snapshot. Historical detail/completion may
reuse this grant, including during catalog failure; other households must resolve
an exact current match. The server derives household identity from the session.
Store a nullable raw command fingerprint on new receipts so missing-unit retries
remain exact even with repeated ingredient IDs and mixed explicit units. Existing
receipts with no raw fingerprint use archived/static baseline units, or explicit
units; ambiguous legacy omissions fail closed instead of guessing from deduction
order. Receipt command/version references are immutable.

The foundation retains V1 catalog bytes. A V1 Worker rollback is compatible only
before any changed content is served. Future content promotion requires a verified
version-aware recovery Worker and a constrained rollback target: old Workers strip
the new request field and cannot safely interpret changed-catalog offline commands.
Keeping the archive alone does not establish backward compatibility after promotion.

## ADR-076 - Retain selected recipe content in saved compositions (2026-10-30 JST)

Status: accepted implementation scope; publication and release gates remain.
Builds on ADR-075; no candidate promotion or evidence waiver.

Stored composition components retain only recipe_id. DTO reads resolve current
content, so an unchanged saved component can display/cook a different recipe
following a catalog change. Add migration0047 with a nullable recipe content
fingerprint referencing the immutable0046 archive. Non-NULL must name the same
recipe and is forbidden for simple_food. Legacy NULL remains explicitly unknown;
never backfill it from today's catalog. Pins are server-issued from the allowed
unscaled authority snapshot, with household grants; clients still submit intent
identities only. Every persistence writer, including direct family generation,
retains pins; edits to role/order/lock and locked regeneration preserve existing
pin/NULL. Explicit dish replacement can select current content only while the
plan authority remains valid. After authority changes, remove incompatible locked
components explicitly, then regenerate; picker/swap retain their authority guard.
A pin does not certify versioned nutrition/classification/role evidence.

Archive/pin issuance must retain existing authority-current and transaction CAS
witnesses. Orphan public content/grants after a failed CAS do not change a saved
plan. Reads may use household-authorized archived display content. New shopping,
assessment,composition and regeneration mutations keep current catalog/evidence
freshness fences; mismatched historical pins cannot borrow current facts. Locked
legacy/historical components require explicit compatible revalidation rather than
silent repinning. V1 result snapshots retain their existing authority fence; this
slice alone does not complete V1 version pins or catalog publication.

New clients opt into pinned composition DTO metadata with the safelisted
`Accept: application/json; recipe-content=1` header on V1 composition and V2 family
requests. Without that capability, every response explicitly omits the added
contentFingerprint field so old strict schemas still parse; pinned recipes are
not cookable through an unversioned old-client link. Mutations still complete
with a compatible response. New clients pass known pins in detail/cook links and
cache keys. A requested pinned version must match the active cooking
run. Offline static fallback is valid only when its computed hash matches; never
substitute current content for a requested archive. Missing legacy metadata stays
unknown. All500 identities,tenancy,inventory commands and Week compatibility remain.

Apply0047 before this Worker. Migration validation must preserve populated legacy
rows,FK/integrity and existing0046 receipt/archive objects; no down-migration.
A Worker predating saved pins can delete/reinsert rows without them. Once any
non-NULL pins exist, such a Worker must not serve mutations, even before catalog
promotion. Recovery uses a certified version-aware Worker with paired flags OFF,
retains0046/0047 and separately proves actual hosted OFF/recovery behavior.
Normal independent review,exact-main CI,same-source hosted certification and
Environment approval remain mandatory. No external approval is fabricated.

## ADR-077 - Content identity for standalone V1 meal selections (2026-10-30 JST)

Status: accepted implementation scope; publication and release gates remain.

V1 already stores title, instructions, requirements and shopping snapshots, but
its read-time composition projection resolves the mutable recipe ID. Add an
optional nullable contentFingerprint to the strict planned-meal contract and
stored result JSON. No migration or inferred legacy backfill. New standalone
recipe selections capture trusted unscaled authority content and household access
through0046. Family variants retain NULL: they are not RuntimeRecipe objects.
Family/composed anchors inherit the matching persisted component pin, including
legacy NULL. Standalone pins attest the exact existing authority snapshot, including its
existing cache semantics; no claim of a new atomic catalog-current check. Existing
authority, tenancy, revision and composition/family transaction fences remain;
a pin identifies the selected snapshot, not live catalog or culinary approval.

V1 generate/replay/read/current/regenerate/swap and underlying family plan DTOs
negotiate the same recipe-content=1 Accept capability. Old strict clients receive
no new field. Projection into an unedited V1 composition propagates the known pin;
archive lookup includes these projections, so historical display never substitutes
current content and current-fact assessment/shopping stay fenced. Standalone V1
regeneration explicitly reselects current content; stale pinned locks are dropped
rather than silently retaining a different recipe under the old selection. Swap
preserves unknown or known pins for unchanged selections. Existing V1 UI already
renders stored instructions; no new cooking/detail navigation is introduced.

Once pinned JSON is persisted, a pre-077 strict Worker cannot decode those rows.
Recovery therefore requires this same-source version-aware flags-OFF Worker,
retaining0046/0047 and all opaque plan data. Older binary rollback is unsupported.
Hosted OFF/recovery, independent review and normal protected deployment remain
required. This slice neither publishes V3 candidates nor waives evidence gates.

## ADR-078: retain recipe content identity in shared shopping demand

Date: 2026-10-30. Status: accepted implementation decision; no publication or
human culinary approval.

Problem: saved V1/composed selections retain immutable content, but materialized
shopping contribution JSON drops that identity. An unchanged recipe ID/title or
quantity therefore cannot identify which content produced shared demand.

Decision: extend the existing strict ShoppingContributionSchema with an optional
nullable contentFingerprint. New trusted projected recipe contributions copy the
component pin; simple foods, family variants and unknown legacy selections keep
NULL. Existing contribution JSON is sufficient; no schema migration or backfill.
No content capture from untrusted shopping input. No recalculation on reads.

The existing raw contribution witness already binds demand review fingerprints
and atomic guards. A changed pin requires review again while chosen purchase
amounts/history survive. Existing receipt-first share/review replay remains first;
current historical-content mismatches still reject a new shopping calculation.

Compatibility: shopping GET uses existing recipe-content=1 Accept negotiation.
Capable clients receive pins in both generated items and unresolved demand; old
strict clients receive the previous contribution shape. The new web client opts
in and preserves pins in private offline caches. Legacy missing pins stay unknown.
A pre-078 strict Worker/client cannot parse pinned JSON/cache. Recovery must use
the same-source version-aware Worker/client with paired flags OFF, retaining
0046/0047 and shopping data. Never erase history to enable an older binary.

Validation: real Worker share/persistence/legacy negotiation, historical mismatch
and replay preservation, changed-pin review with stale command rejection, private
client server/offline cache, existing shopping race/tenancy/quantity regressions.
Hosted same-source recovery and approved V3 publication remain separate gates.

## ADR-079 - Offline validation of version-bound review records

Date: 2026-10-31 JST. Status: accepted local tooling; publication remains blocked.

Problem: the owner reports professional review complete, but the queue has no
machine-checkable decision record. Historical research packets remain immutable
and cannot be rewritten as human approvals.

Decision: accept a separate review JSON file bound to the exact candidate-file
SHA256 and per-recipe content fingerprint. Require reviewer identity, UTC decision
time, a hashed local decision record, and evidence/rationale for every required
review action. Reject duplicate/unknown recipes, stale identities, missing actions,
future timestamps, changed/missing evidence and evidence paths escaping the repo.
An APPROVE decision cannot leave an action OPEN. Partial records remain useful;
the CLI exits nonzero until all 500 approval decisions are recorded.

This validates record integrity and completeness, not reviewer identity,
independence, expertise, claim correctness or evidence sufficiency. Those require
independent review of the actual records. No human approval is generated; no
candidate, historical packet, release gate, runtime authority or database changes.
The four existing data gates and protected deployment procedure remain required.
Rollback is removal of this offline tool; no migrations or user-data effects.

## ADR-080 - Quarantine contradictory ingredient identities in V3 candidates

Date: 2026-10-31 JST. Status: accepted candidate-only implementation scope;
independent technical review and all publication gates remain required.

The shared BEEF_SIRLOIN entry combines generic Vietnamese beef, an English
sirloin label and a shank alias. Twelve V2 lines use this ID for differing or
unspecified cuts. Existing-canonical status therefore overstates identity
certainty. The source names and registry bytes are sufficient evidence of that
contradiction, not evidence for twelve replacement identities.

Extend compiler version2 only to coordinated identity demotion: clear an existing
non-null canonicalIngredientId, mark reconciliation ambiguous, and replace its
reason. Require all three exact old/new edits together, a source with no review
claim, and the existing recipe-specific evidence references. Reject assignment of
any replacement ID, promotion, incomplete demotion or unrelated structural edits.
Keep source names, quantities, roles, nutrition, positions and steps intact.
The immutable V2 file retains the original ID and exact reconstruction witness.

Candidates remain NEEDS_REVIEW with no runtime authority. A demoted line cannot
project through runtimeIngredientFromSource; catalog assertions and release gates
continue to block unresolved identities. No source registry, V1/V2, public API,
consumer, SQL or production change. Compiler version metadata advances for all
500 candidates; only the twelve identified content records change.

Validation requires rejection tests for partial demotion, ID substitution and
promotion; exact reversal to V2; all500 recompilations; unchanged quantities,
roles/nutrition and488 unaffected payloads; preserved runtime fingerprint.
Rollback is reverting the candidate/tooling slice, with no user-data effect.

---

---

---

### ADR-075 addendum -0046 release-tool checkpoint (2026-10-31 JST)

The Admin guard/matrix still selected45 after cooking added0046. Bind the frozen
680502cc7aa64a4d11abca1ae0625ee9f5166d66 candidate; retain all original/V2
ancestry, parallel-main and later-change fences. Exercise45 independently, then46
fresh/populated upgrades, immutable content/receipts and strict45 rollback refusal.
This is SQL-only certification; runtime recovery requires separate evidence.
No schema/runtime/workflow change. Local full check431files/9665tests and real
D1 matrix38/38 PASS exit0; exact commands/limits in22_COOKING_FOUNDATION_VALIDATION.md.
PR49 must retain this coverage alongside its immutable47 checkpoint.


## ADR-081 - Retain compatible family recovery at reviewed schema tips

Date: 2026-10-31 JST. Status: accepted release defect correction under the
owner's existing recipe production authorization; normal review and CI required.

The Deploy workflow selects family recovery only at0043. At0046/0047 it can
therefore fall back to a historical Worker that cannot preserve cooking receipts,
saved pins or shopping JSON. Domain Release already prepares compatible recovery
unconditionally; the retained Deploy workflow must enforce the same safety rule.

Extend only the supported-tip predicate to the reviewed0043-0047 migrations.
Keep exact-source/D1/flags/asset/authority checks and existing OTP precedence.
Unknown tips remain unsupported until reviewed. No workflow/config/schema,
authentication, payment, runtime catalog or user-data change. Recovery still
requires real same-source hosted proof; local tests do not certify deployment.

Validate every supported tip, older/malformed/unknown tips, exact0047 recovery
certification and existing drift/asset/deployment regressions. Rollback is a
normal reviewed code revert before release; never erase pins or receipts.

## ADR-082 - Audited domain release uses the existing catalog rollout gates

Status: accepted implementation scope; hosted release evidence remains required.

The domain release preserves live Takolio routing, runtime bindings, queues and
operational settings, but can only retain the current catalog mode. Retaining
production D1 across the Zod upgrade correctly fails the dependency continuity
fence. The older Deploy workflow supports shadow/canary but uses the legacy
committed domain configuration. Neither path currently supports a safe fresh
rollout with the audited live configuration.

Add explicit production domain inputs for preserve/shadow/canary-1/canary-5/
canary-25/d1 and rollback confirmation. Default preserve retains the continuity
fence. Prepare the unchanged audited config first, then change only the three
catalog vars after the existing validateRecipeCatalogTransition accepts the
live authority and exact target SHA. Preserve current-source/ancestor checks,
ordered promotions, full fingerprint/readiness checks, fresh staging acceptance,
production certification, normal Environment review and observation. Compatible
recovery keeps the selected catalog stage and disables both planner flags.

This supersedes the blanket production hold in ADR-073 only for a separately
certified release of the security/saved-content foundation retaining V1 catalog
content. It does not authorize V3 publication, waive any of the four data gates,
create culinary approval or mark the 500-recipe program complete. Migrations0046
then0047 and same-source recovery remain required. No auth/payment/business,
DNS, queue, database identity or recipe content change belongs to this adapter.
Rollback retains user data/schema and uses the recorded same-source recovery.


## ADR-083 - Bind staging saved-content migration to the current repository tip

Status: accepted narrow release defect correction under existing operator
authorization; protected review and hosted release proof remain required.

Current main contains0047. The generic migration gate correctly rejects0046
as a candidate because it is not the repository tip. Requiring an existing0046
ledger for the0047 dispatch therefore strands staging at0045. Set only the0047
contract to preTip0045 and ordered chain[0046,0047], matching production's existing
chain. Keep generic candidate validation and all hashes, exact-main/CI, identity,
bookmark, aggregate, plan and schema gates. Complete0047 may certify; partial0046
must stop for reconciliation. Historical0046 contract remains available only at
a repository whose immutable tip is0046. Applied SQL remains unchanged.

Regression rehearses apply from0045 and certification at0047, with missing,
reordered, extra and partial-ledger rejection. Rollback retains additive schema,
archives, saved pins and receipts, using the same-source flags-OFF recovery; never
restore old user data automatically. This does not authorize V3 publication.
