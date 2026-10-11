# Current backend program checkpoint - 2026-10-12 JST

Implementation `7ef2f8407d3a6a958c78146db3b5c9a9f0990b78` is locally verified: full 309 files / 7463 tests,
lint/typecheck/migrations/build PASS. B01c, offline ScanV3/scorer, provider control/
cancellation, dormant budgets, ingredient pilot, closed-loop fixes, Week extraction/
OpenAPI and telemetry/security candidate are delivered within their recorded scope.
The masterplan is not release-complete: security findings/errors, real data/human
reviews, inbox/staging/SLO/token/pricing/retention and protected billing gates remain.
See [aggregate result](../program-20261011/RESULT.md) and its next-action sequence. Historical plans and
checkpoint evidence follow unchanged; current status takes precedence.

---

# Current B01a A2 local checkpoint - 2026-10-11 JST

All OTP route/client/cleanup integration is locally verified on `dcc0e1a74d2f5e3b67e13ecbb241bc04c8fafdde`.
Final full 293 files/7037 tests and focused 454 PASS; required local gates
PASS except dependency audit findings retained for B08. Guest transfer stays 409 deferred.
Hosted 0040 release/preflight, hardened rollback, staging D1 and inbox proof remain open;
next local scope is B01c. See [A2 result](../b01a-a2/RESULT.md).
Historical plan/source risks/checkpoints follow unchanged.

---

# Backend upgrade - Current packet status

B01a: `A1_DORMANT_LOCAL_VERIFIED` on `0649324a729b57019df61da6bceec40cd9ba1135`; A2 ready for bounded route/client
integration after final contract/ownership review. B01b A1 local verification retained;
strict issuance/inbox certification remains dependent. B00baseline unchanged.
Result: [B01a A1](../b01a/RESULT.md). Final local full 291 files / 6908 tests PASS.
All other packet statuses remain as recorded. Historical task table follows.

---

# Backend upgrade - Task index

Base `652e0d7632745e9b77cda4b5b3caac83a3ec1015`, repository ID `1385308553`. Status của packet là khả năng bắt đầu work, không completion. B00 là docs-only baseline; email adapter B01b A1 đã được triển khai và kiểm chứng local riêng, các packets khác chưa triển khai runtime.

| Packet | Status / dependency | Artifact / owner |
| --- | --- | --- |
| B00 | BASELINE_CHECKPOINT; actual checks trong manifest | [Baseline](../README.md), coordinator |
| B01a | READY_OFFLINE; policy ADR draft trước integration | [Strict OTP](B01a-strict-otp.md), Security |
| B01b | A1_LOCAL_VERIFIED; strict issuance/inbox E2E sau B01a/operator inputs | [Email adapter A1](B01b-email-adapter.md), Backend/QA |
| B01c | READY_OFFLINE; current route policy, reproduce trước fixes | [Supporting packets](BACKLOG_PACKETS.md#b01c---authtenant-adversarial-matrix), Security/QA |
| B02a/b | DESIGN_ONLY / protected billing scope; refund optional | [Supporting packets](BACKLOG_PACKETS.md#b02---billing-design-and-reconciliation), Billing |
| B03a | A1 READY_OFFLINE; A2/A3 licensed data/labels/budget pending | [Dataset/evaluator](B03a-golden-dataset.md), AI QA |
| B03b | B1 READY_OFFLINE; B2 reader/writer/client ownership+ADR | [Scan V3 contracts](B03b-scan-v3-contracts.md), AI/domain |
| B04a/b | DEPENDENT B03b; providers/shadow flags OFF | [Supporting packets](BACKLOG_PACKETS.md#b04---provider-runtime-and-queue-budget), AI/backend |
| B05a | C1/C2 READY_OFFLINE; source candidate unchanged | [Review contracts](B05a-ingredient-review.md), Data/domain |
| B05b-e | DEPENDENT review model/pilot/evidence/consumer proof | [Supporting packets](BACKLOG_PACKETS.md#b05b-e---review-pilot-to-data-certificate), Data/QA |
| B06a/b | READY_OFFLINE current certified authority | [Supporting packets](BACKLOG_PACKETS.md#b06---whole-week-and-stockshopping-consistency), Planner/Inventory QA |
| B07a/b | DEPENDENT stable selected slice; no broad refactor | [Supporting packets](BACKLOG_PACKETS.md#b07---api-contract-and-one-route-extraction), Architecture |
| B08a | READY_DESIGN; measured thresholds before release | [Supporting packets](BACKLOG_PACKETS.md#b08---telemetry-security-and-toolchain), Platform |
| B08b/c | Audit triage before upgrade; toolchain after core stable | [Supporting packets](BACKLOG_PACKETS.md#b08---telemetry-security-and-toolchain), Platform/security |
| R01+ | NOT_STARTED; explicit operator release task and gates | [Release checklist](../RELEASE_CHECKLIST.md), operator |

## Quy tắc phối hợp

Một coordinator và tối đa hai implementation lanes. Shared ownership: `src/worker/index.ts`, types/config/validation, `packages/ai/src/index.ts`, `wrangler.jsonc`, package/lockfile, migrations, workflows và authority contracts. Coordinator phân sequence và integration; mỗi agent chỉ ghi owned paths. State/board/handoff shared do coordinator tổng hợp.

Policy mới là draft ADR đến review/integration. Không cần xin tất cả operator/data inputs để làm pure contracts/tests. Không tự đọc credentials hoặc dùng remote production để vượt dependency. Pin lại current main trước task; giữ exact base/head/checks, privacy-safe logs và rollback. Mọi proposed command trong packet phải được cập nhật thành actual result khi execution.

B00 không cấp quyền PayOS edits, provider spending, source ingestion, deployment, remote migration hay GitHub merge/settings mutations. Những bước đó nằm ở scope task/gate tương ứng; tiếp tục mọi offline work được giao có thể làm được.
