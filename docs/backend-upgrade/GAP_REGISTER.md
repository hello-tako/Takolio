# B00 - Gap register

Source pin `652e0d7632745e9b77cda4b5b3caac83a3ec1015`. `SOURCE_VERIFIED` là quan sát code/candidate, không chứng minh exploitation hay production corruption. TARGET là điều kiện triển khai, không số đo đã đạt.

| ID / mức ưu tiên | Evidence hiện tại | Hệ quả cần xử lý | Owner / acceptance |
| --- | --- | --- | --- |
| SEC-01 / P1 | `auth.ts:430,442,444` và `:800,812,814`: đọc attempts trước HMAC rồi tăng failure | Concurrent candidates có thể được so nhiều hơn counter limit | B01a: atomic reserve-before-verify; đo comparison admissions 100-1000 concurrent requests; fifth admitted ticket vẫn finalize |
| SEC-02 / P1 | Resend KV `auth.ts:561-580` fail-open; register/login-unverified/forgot issue riêng | Không có strict cooldown chung và generation authority | B01a: D1 account/purpose scope, 60s TARGET cooldown, invalidation+generation+receipt atomic, resend không reset abuse budget |
| SEC-03 / P1 | OTP consume `:469` trước activation/session; reset consume `:831` trước batch/session | Crash có thể consume mà chưa hoàn tất effects; batch zero-update không tự rollback | B01a: guarded effects và consume cùng transaction; constraint/fence rollback tests; registration pre-issue mutations cũng phải được guard |
| SEC-04 / P1 | auth middleware session membership chưa recheck; tenancy có default-household auto-link; legacy notification/detail/recommendation paths khác native lot readers | Revoke membership có thể có path semantics không đồng nhất | B01c: reproduce route matrix 2 users/2 households/guest/revoke; zero foreign access; không gọi đây là production breach trước test |
| SEC-05 / P2 | Turnstile server policy hiện register, không bao phủ login/reset/resend | Anti-bot scope không tương đương strict account budget | B01c: document policy/false-positive/cost; strict OTP không phụ thuộc Turnstile hay KV availability |
| MAIL-01 / P1 | `email.ts`: send acceptance; ready deliveryVerified false; native timeout ambiguous | Accepted chưa đủ delivered; blind fallback có thể gửi trùng | B01b: accepted/delivered/bounced/unknown lifecycle, sanitized receipt, bounded deadline; controlled inbox proof trước release |
| BILL-01 / P1 design | HMAC, amount/currency/reference dedupe, transactional grants đã có; creation chưa có server key | Retry checkout/crash remote call cần policy reconciliation | B02a design: original offer replay, one durable intent, no blind remote retry; PayOS protected, no code edits in B00 |
| BILL-02 / P2 design | ADR-029 chấp nhận error->failed và reject late payment; `refunded` enum không chứng minh refund thật | Không gọi accepted policy là bug; refund entitlement semantics chưa chốt | B02a ADR trước policy change; B02b riêng, operator-only, optional |
| AI-01 / P1 | `schemas.ts` positive quantity/unit, `_vnd`; label task routed qua receipt | UNKNOWN và JPY không biểu đạt đúng bằng DTO hiện tại | B03b: versioned task DTO, unknown reasons/evidence, Money currency; no v1 coercion |
| AI-02 / P1 | `scans.ts:471,477` quantity/default unit hydration | V3 UNKNOWN có thể bị default thành inventory quantity | B03b: versioned reader branch; confirmation requires reviewed known quantity+unit; client readiness trước writers |
| AI-03 / P1 | Quality-gate dedupe theo name/qty/unit/prices; piece-price heuristic | Có thể mất hai dòng mua thật giống nhau hoặc misclassify basis/tax | B03a/B03b: source occurrence identity, duplicate extraction evidence, retain genuine multiplicity |
| AI-04 / P1 | Queue Promise.race deadline không propagate abort; runtime budget mới mỗi delivery | Provider work có thể tiếp tục; redelivery có thể reset call/spend ceiling | B04b: abort propagation/fenced publish, durable cumulative job admission, no refund on unknown crash cost |
| AI-05 / P1 dependency | Golden6 symbolic fixture URLs; ai-eval live cũng chỉ inspection | Không có quality certificate hoặc usable paid runner | B03a: licensed assets + independent labels + heldout split + pilot variance; không gọi fixture inspection live benchmark |
| DATA-01 / P1 dependency | V2 candidate 500/6766 lines; 2996 excluded; 3029 review rows;1395 provisional concepts;1072 unique URLs content verified0 | Source-to-authority review chưa đủ | B05a/b: immutable decisions/pilot; 0 provisional promotion, complete line coverage |
| DATA-02 / P1 release gate | Nutrition1publishable/288blocked/211null;4blockers; finalRuntimeFingerprint null | V2 chưa release eligible | B05c-e: evidence/model/consumer certificate trước cutover; không sửa tay gate hoặc replay0039 |
| FLOW-01 / P1 target | Existing lot ledger/FEFO/revisions/planner services đủ nền móng | Whole-week cross-consumer matrix còn cần certification riêng | B06: 3modes x2stocks x2households, partial purchase/cook/races; no scoring redesign |
| API-01 / P2 | Legacy `/week` và modern meal-planning cùng tồn tại; large adapters | Contract drift dễ xảy ra khi extraction | B07: one vertical slice, status/header/body snapshots, current invariant suites |
| OPS-01 / P1 evidence | Latest deploy receipt/public readiness đúngSHA; current direct CF vars/version/log/SLO unverified | Hosted success không đủ feature-specific release proof | Release operator: observed flags/schema/version, measured baseline, controlled journeys trước cutover |
| OPS-02 / P2 | `DEPLOYMENT.md` prose nói staging auto-deploy; workflow dispatch-only; top Google responsive docs còn pending historical | Source documentation stale so với merge/deploy và trigger | B00 checkpoint + PR triage; giữ lịch sử, source workflow là trigger authority |
| OPS-03 / P2 | Branch protection validate strict/admin on nhưng required PR approvals0; production reviewer1, self-review allowed/admin bypass | Proposed independent review chưa enforced toàn bộ | B08b/release: independent reviewer evidence; thay settings/workflow ở task riêng, không mutate B00 |
| OPS-05 / P2 harness | Full local suite initial1timeout/6743PASS; focused same failure, CI/metrics-only still~57s; real-registry update cache gives32/32PASS | Ancillary Wrangler update lookup makes local command exceed5s; preserve failure/rerun evidence | B08: hermetic local CLI harness, no timeout waiver; B00 final full rerun recorded separately |
| OPS-04 / audit-dependent | Lockfile fresh dependency audit được ghi trong local validation | Runtime/tooling vulnerabilities cần triage đúng exposure | B08b: no unreviewed high/critical runtime release; tooling remediation riêng, không wholesale upgrades ở B00 |

## Evidence còn thiếu trước các gates phụ thuộc

| Gate | Evidence cần | Có thể tiến offline |
| --- | --- | --- |
| Core release | Current CF version/vars; email inbox/status; strict OTP D1 staging atomicity; tenant adversarial tests; hardened rollback artifact | B01 services/tests/ADRs |
| AI quality/release | Licensed originals, labels, provider availability/privacy/pricing, capped budget, powered heldout, V3 client review | Contracts, evaluator, mocks, provider interfaces flags OFF |
| V2 data authority | Reviewer decisions, URL/content/nutrition evidence, final fingerprint, all consumers, clone rehearsal | Review schema, pilot tools, additive migration proposal |
| SLO/canary | Measured denominator/window/sample/thresholds, logs and load/chaos outcomes | Privacy-safe telemetry design and fixture load harness |

Không đổi `TARGET` thành `VERIFIED` chỉ vì một packet đã được viết.
