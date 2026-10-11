# Backend supporting packets B01-B08

Date 2026-10-11 JST. Base `652e0d7632745e9b77cda4b5b3caac83a3ec1015`, repository `vn-tak/Tako-san`, ID1385308553. Đây là implementation scope/acceptance; commands chưa chạy bởi các packets này. Actual B00 checks được ghi riêng trong baseline.

## Shared constraints

Mỗi packet pin main/base/head, đọc canonical rules/spec/ADR/source/callers/tests. Coordinator cập nhật state/board/handoff và cấp ownership shared paths. Append-only migrations được cấp số khi integration, không dự kiến cố định0040. Giữ D1 raw SQL/Zod/current services, auth/CSRF/tenancy/command ledger/Week compatibility; không tạo authority thứ hai. Không sửa applied migrations, T19/T20/T21 recovery, bindings/toolchain/provider flags, protected PayOS hoặc business scoring ngoài declared scope.

Local completion cần lint/typecheck/full tests/local migrations/build và meaningful packet-specific adversarial checks trên final head. Node>=22.13 (Node24 verified), frozen lockfile, SQLite CLI. No remote flags, paid providers hay production mutation. Runtime/data rollout dùng checklist riêng; local code complete khác certification. New flags OFF. Rollback phải giữ durable history/expanded schema; pure docs/tests rollback dừng dùng candidate artifact.

## B01b - Email lifecycle

Owner Backend/QA; dependencies B00 + draft delivery DTO cho adapter checkpoint A1; B01a implementation trước E2E. A1 đi trước B01a issuance wiring để chặn native ambiguous exception fall-through Resend, giải dependency cycle. Owned `src/worker/services/email.ts`, email types/helper modules và corresponding privacy/lifecycle tests; auth route integration chỉ coordinator cấp sau B01a. Forbidden billing/catalog/AI/toolchain/workflows/migrations; không tự thêm provider callback route.

1. Define sanitized states accepted/delivered/bounced/delivery_unknown và evidence provenance. `messageId`/send true chỉ accepted. Native provider exception/timeout có thể đã send; conservative unknown.
2. Add bounded provider deadlines và retry decision policy; blind fallback khi outcome ambiguous không được phép. OTP challenge lifecycle không active từ unknown acceptance thiếu issuance protocol evidence.
3. Reuse existing email adapters; no secrets/email/OTP/body/raw response logs. Nếu needs delivery callbacks/status, ADR và coordinator scope riêng; verify signature/auth, replay/out-of-order trước transition.
4. Prepare controlled test inbox runbook: expiry/resend/recovery, sanitized IDs/timestamps/evidence, bounce failure; actual inbox sends chỉ operator/QA task có recipient/domain inputs.

Acceptance: mocks cover accepted/rejected/timeout-possibly-sent/bounce/out-of-order; exactly defined retry outcome, no duplicate blind send, privacy log capture clean. Delivery certification pending real controlled inbox evidence. Rollback retains lifecycle records và routing về provider certified, unknown states reconcile trước resend.

## B01c - Auth/tenant adversarial matrix

Owner Security/QA, B00 route map dependency. Owned new integration tests/fixtures và threat matrix; runtime auth/tenancy/route fixes chỉ sau reproduce + coordinator scope. Forbidden billing/provider/catalog authority/deploy/schema changes.

1. Matrix route method/path/cookie/guest/expected-owner/CSRF/household membership, include legacy `/week`, recipe detail/recommendations/notifications and native lots.
2. Exercise two accounts/two households, two members one household, revoked session/membership, deleted default household, guest migration, forged body IDs và stale owner headers.
3. Record current family roles; T20 MealRole is dish role, not family RBAC. New family collaboration belongs later product wave.
4. Reproduce foreign-access or revoke gap using SQLite-backed app; minimally fix declared path preserving guest/Week compatibility; snapshots expected error status/codes.

Acceptance: zero verified foreign reads/writes across matrix; cross-origin unsafe cookie/bootstrap blocked; revoked session/membership behavior matches reviewed policy; no auth-secret fail-open or raw-token logs. Google/device/inbox real certification remains separate. Commands selected from auth-hardening/frontend UI integration/current route suites plus new adversarial test; full local gates. Rollback cannot restore reproduced security bypass; named hardened artifact/fail-closed handling required for release.

## B02 - Billing design and reconciliation

Owner Billing/backend. B00 permits audit/design only; canonical `AGENTS.md` and rule7 protect PayOS. Future B02 edits need explicit billing task scope and accepted ADR. Existing HMAC/amount/currency/reference uniqueness/grant transaction and replay suite retained. Existing ADR-029 error->failed+late rejection is accepted policy.

Design deliverables: checkout retry/idempotency lifecycle; scope(user,key,fingerprint,original offer), key generation/retention/expired-key behavior; durable intent states and remote-uncertain reconcile; sanitized operator record/runbook. Same key/body replays original price/plan offer even price changed; key/body conflict409; explicit new checkout gets new key; retry retains key. One durable intent; no blind PayOS create retry after lost response/crash. Exactly-once provider call cannot be claimed without provider guarantee.

Proposed implementation owned paths after scope: billing route/service/repository + `src/web/services/billing.ts` retry-key handling and exact related tests. Payment UI redesign, auth/catalog/toolchain remain forbidden. Additive storage requires coordinator sequence/rehearsal. Client may preserve a bounded key/checkout-generation lifecycle without storing sensitive payment payload.

Acceptance design/testing: duplicate/reordered/concurrent/reference-reuse/mismatch/expired/failed/fault-between-grant scenarios produce at most one valid grant; ambiguous remote state creates reconcile record; no invented success/refund. B02b optional operator refund ledger follows full/partial/entitlement policy, idempotent authority and audit. Rollback retains durable payments/grants/reconcile history, no reset/replay of grants.

## B04 - Provider runtime and queue budget

Owner AI/backend; dependencies B03b reviewed task DTOs, B03a evaluator before quality certificate. B04a owned provider interface/adapters/current task-runtime policy + tests. B04b owned scan-queue cancellation/job-budget service + tests after coordinator integration; shared Env/config/queue schemas/migrations assigned separately. Forbidden catalog/billing/auth/toolchain/client writer/cutover changes.

1. Inject provider into existing governed runtime; bounded taxonomy/repair/retries preserved. Qwen baseline; candidate adapters OFF, eligibility model ID/vision limits/privacy/pricing reviewed before paid benchmark. Production allowlist gate change belongs release PR.
2. Version task/job/message/result envelopes; old/new readers before writers. Route deadline propagates AbortSignal to adapter where supported; timeout fences publish even if provider cannot abort.
3. Durable per-job call/token/spend admissions encompass primary/repair/retry/shadow and queue redeliveries. Reserve before call, conservative unknown charge after crash/timeout, no unjustified refund. Keep scan quota ledger separate from provider-spend budget.
4. Cancellation CAS invalidates current lease; stale completion cannot publish or write. Existing fenced leases/DLQ remain; idempotent redrive runbook. Shadow has separate spend budget and no inventory writes/user quota charges.

Acceptance: mocked outage/invalid response/schema failure/multidelivery/crash-after-admission/stale-lease/cancel interleavings prove cumulative bound and no duplicate settlement. Old/new pending jobs readable after rollback; exact UNKNOWN/JPY/tasks; no loosened schema. Run existing ai-runtime-governance.test.ts, scan-queue/fencing/quota tests plus new job-budget tests and full gates. Rollback candidate OFF restores Qwen routing with version-compatible readers; no queue purge or budget reset.

## B05b-e - Review pilot to data certificate

Owner Data/domain/QA. B05a schema/source-proof is prerequisite. Applied/certified source remains immutable. No runtime authority from classifier/name similarity/partial pilot. Owned review artifacts and pure audit tools first; new migration/hydration/consumers receive separate coordinator ownership at later checkpoints.

B05b selects40concepts/60transformations/20URLs across ambiguity/unit/package/process/nutrition classes, with real assigned reviewers. Measure minutes/item, disagreement/rework, evidence reuse and license/content verification. Partial accepted decisions remain offline; no fabricated reviewer/date/citation or partial promotion. Pilot output sets full review staffing/schedule.

B05c append schema only when reviewed model stable; local D1 clone/replay/FK/quick_check, immutable release-bound IDs and source hashes, shadow read/dual comparison. B05d consumer adapters cover planner/composer restrictions, shopping demand, cooking/FEFO, servings/scaling, nutrition null/blocked, recipe detail, persisted plans/favorites/locks/media. Unknown quantity demand cannot become zero; restriction identity cannot disappear; process quantity cannot become edible consumption.

B05e derive reviewed projection/fingerprint using existing implementation, all500recipe gate or separately reviewed subset ADR; complete source-line coverage/exclusions, no provisional promotions/unevidenced conversion. Record DATA_CERTIFIED only after real review/evidence/consumer/clone gates. Current four blockers stay expected red until cleared by real inputs. No import/recovery/reapply0039/remote TimeTravel. Rollback authority to certified old immutable release while retaining schema/IDs/new live events; rollback must understand new history.

## B06 - Whole-week and stock/shopping consistency

Owner Planner/Inventory QA. B00 dependency; current certified authority first, V2 consumer PR separate. Owned current meal-planning/week/inventory/shopping/cooking regression tests and minimal reproduced fixes; coordinator assigns route/service files per bug. Forbidden scoring redesign, catalog cutover, AI/auth/billing/toolchain changes.

B06a matrix3modes x2stockstates x2households,7days; Manual/Assisted/Auto, restrictions, repeat rules, locks/components, nutrition/price unknown, pantry/freezer/fridge, revisions and simultaneous same-household users. Preserve legacy `/week` and paired modern planner flags semantics. B06b shopping demand->consolidate->pack rounding->partial purchase/substitution->import->cook->correct, source/release snapshots and FEFO evidence; concurrent replay/response loss cannot double deduct/import.

Acceptance: stale revisions409, same command replay receipt, zero negative unpermitted stock/double deduction, locks/restrictions intact and unknown fields truthful. Physical/package conversion only evidence-supported; no import of unpurchased amount. Query/index improvements need measured before/after outcomes and household+revision+release cache invalidation. Full integration suites plus deterministic race/fault tests/local gates. Runtime rollback retains revisions/ledger/snapshots with paired UI/server flags and compatible readers.

## B07 - API contract and one route extraction

Owner Architecture/backend; B00 map + stable slice dependency. Choose legacy week read serialization after B06 or scan result hydration after B03b stability; one vertical slice per PR. Owned selected adapter/application/repository/types and focused contract snapshots. Forbidden broad auth+scan refactor, scoring/schema/provider/catalog/billing/deploy/toolchain changes.

Zod source contracts, status/header/error/success/body serialization snapshots, idempotency/pagination semantics and generated consumer proposal. New generator dependency requires ADR/coordinator review. Prioritize typed Env AI/D1 row/queue/HTTP boundaries; no blanket any removal without caller evidence. Pure refactor preserves deterministic contract fields; timestamps/request IDs verified structurally, not forced equal between calls.

Acceptance: same route output and business outcomes/invariant suites, no N+1 growth, worker-only refactor yields same web assets under same build inputs. Contract generation deterministic if added. Rollback old compatible adapter without state/schema divergence; Scan V3 semantic changes stay separate versioned contract gate.

## B08 - Telemetry, security and toolchain

Owner Platform/security; B00 audit evidence. B08a minimal telemetry begins with core, full dashboards/SLO after measured baseline. Owned observability helper/tests/report design; route integrations/shared index/type config coordinator-scoped. Forbidden raw payload logs, payment/auth business logic, provider/data cutover.

Metric route template/status/error class/request/job opaque correlation, provider/model/task, latency, queue wait/age/attempt/DLQ, quota/payment states and cost. Never raw IDs in paths, cookies/OTP/emails/images/receipt/model/payment data. Hashing plain email insufficient privacy. Add denominator/window/sample/exclusions/retention/access; measure7days where traffic sufficient, synthetic baseline separate. Set numerical latency/error/cost/stop thresholds before canary, not invented by B00.

B08b triages fresh runtime/tooling audit and introduces SAST/secrets/workflow-permission/SBOM policy in separate coordinator-owned workflow PR with independent review/least privilege. New high/critical runtime risks block release absent reviewed remediation/exception owner+expiry. Preserve exact-main/CI/environment approval; branch/settings updates are separately scoped mutations.

B08c1 Wrangler3->4 feasibility/upgrade separate PR after core stable; B08c2 compatibility-date separate later. Owned package/lock/wrangler/tooling scripts only with coordinator scope; audit local/remote migration semantics, assets/queues/email/AI/deploy preflight on staging. No catalog repair/provider cutover bundled.

Acceptance: privacy capture clean, baseline and dashboard show failures, fixture load/chaos for D1/KV/provider/email outage/duplicate queue/interrupted release have correct bounded effects. Upgrade keeps bindings and all existing deployment invariants; mocked CLI remote behavior+local migration+staging certificate before production. Rollback named reviewed artifact/version with compatible schema/bindings. B08 does not bypass unsafe toolchain findings by disabling audit.
