# Backend waves - Release checklist

B00 chỉ lập checklist; production approval và mutation không được thực hiện. Source pin `652e0d7632745e9b77cda4b5b3caac83a3ec1015`.

## Trạng thái độc lập

`CODE_COMPLETE -> PR_REVIEWED -> STAGING_CERTIFIED -> PRODUCTION_APPROVED -> PRODUCTION_VERIFIED`.
AI thêm `QUALITY_CERTIFIED`; Ingredient V2 thêm `DATA_CERTIFIED`. Local PASS hoặc hosted CI không tự chuyển sang production verified.

## PR / offline

- [ ] Pin repo ID, current main/base/head, lockfile và owned/forbidden paths; rebase dependencies trước final tests.
- [ ] ADR ghi mọi semantic changes, policy/key retention/contract negotiation; migrations append-only và coordinator cấp số theo main hiện tại.
- [ ] Flags/providers/writers candidate OFF; readers hiểu old/new schema/messages trước writers; no sensitive logs/fixtures.
- [ ] Lint/typecheck/full tests/local migration/build và packet gates đúng final head; failures/audit exceptions có owner, expiry và rationale.
- [ ] Independent reviewer xem source/SQL/fault tests/security/rollback; CI validate đúng final head. B00 observed required PR approval count là0; đây là acceptance target bổ sung, không phải settings hiện hành.

## Staging / certification

- [ ] Resource isolation, test credentials/data riêng, migrations replay/FK/quick_check và clone rollback rehearsal.
- [ ] OTP true admission bound/multi-client/D1 atomicity/unknown-account parity; last admitted ticket finalize; no budget refund after crash; hardened rollback artifact hoặc tested fail-closed fallback.
- [ ] Email controlled inbox và safe lifecycle proof; unknown delivery không tự blind fallback/resend.
- [ ] Billing protected scope + accepted policy, replay/mismatch/late/crash tests; remote ambiguity có reconciliation; no duplicate entitlement.
- [ ] Scan V3 contract/client review/confirmation; UNKNOWN/JPY/multiplicity, cancellation/stale lease, durable job budget; old/new queue messages and rollback readers.
- [ ] AI licensed goldset/independent labels/heldout/powered per-slice results; baseline/candidate same budget; explicit spend cap; shadow0inventory writes.
- [ ] V2 reviewed identity/units/source/nutrition, release fingerprint derived, full consumer authority matrix; no provisional promotion/zero-demand coercion.
- [ ] Whole-week Manual/Assisted/Auto, restrictions/locks/revisions, 2households, stock/shopping/cooking races, no negative unpermitted stock/double deduction.
- [ ] Telemetry privacy capture and measured error/latency/queue/cost baseline; thresholds, sample sizes, stop rules fixed trước canary; load/chaos and post-smoke defined.

## Production preflight / operator gate

- [ ] Explicit release task/authorization, current main exactSHA và fresh exact-head CI; trusted dispatch workflow, independent approval evidence.
- [ ] Record current Worker version/deployment/bindings/vars, UI build flags, schema ledger/checksums, catalog release/fingerprint và inventory adoption authority. Static config alone insufficient.
- [ ] Review settings drift: branch validate strict/admin enforced; production required reviewer1 nhưng self-review allowed/admin bypass; deployment branch restriction absent ở B00. Không tự thay settings để làm checklist green.
- [ ] Approved environment/budget/provider/feature flag pair; tested previous compatible artifact and rollback command/provenance; no production Time Travel/reapply0039/recovery replay.
- [ ] Migration expand-first rehearsal; live user writes/IDs/events remain readable after rollback; no queue purge/grant replay/destructive data reset.

## Post-deploy / stop

- [ ] Current runtime SHA/version/flags/assets/schema/authority match manifest; feature-specific safe smoke và metrics đúng window/sample size.
- [ ] Immutable release receipt includes run IDs, timestamps, digests, independent review/approval and measured outcomes; R2 bytes/inbox journeys recorded where needed.
- [ ] Stop immediately on verified tenant breach, strict quota breach, duplicate entitlement/stock deduction, shadow write hoặc provenance drift; execute named tested rollback/fail-closed procedure.
- [ ] Candidate provider OFF can restore Qwen routing without unreadable V3 jobs/results; catalog authority rollback preserves snapshots/IDs/events. OTP rollback cannot reopen unsafe candidate comparison path.

## Latest B00 evidence

Run38103079308 receipt ghi D1/cutover true/canary0, MealCompositionV2 true, Worker versioneee43e96 và sourceSHA652e; schema39, catalog500/fingerprint exact. Public ready subsequently trả đúngSHA/D1 nhưng deliveryVerified false. Receipt Worker ID là observed tại02:00:09Z; current direct Cloudflare query chưa thực hiện. Current release already reached D1; checklist không phải lệnh chạy lại T20 canary sequence.
