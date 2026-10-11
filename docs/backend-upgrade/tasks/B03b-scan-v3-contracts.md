# B03b - Scan V3 contracts va compatibility adapters

Ngay: 2026-10-11 JST. Owner: AI/domain. Trang thai packet: READY_FOR_OFFLINE_CONTRACT_IMPLEMENTATION. B03b khong cap quyen provider enablement, migration hay production cutover.

## Authority va phu thuoc

- Repository vn-tak/Tako-san, ID 1385308553; base SHA 652e0d7632745e9b77cda4b5b3caac83a3ec1015. Ghi exact implementation head/diff; coordinator pin lai neu main da doi.
- Dependencies: B00 canonical map; ADR ve contract negotiation/provenance/compatibility truoc code wiring; B03a evaluator contract duoc review truoc quality certification.
- Tai su dung existing scan routes, quota ledger, queue fencing, task runtime va inventory confirmation. Khong tao scan pipeline, inventory writer hoac ingredient authority song song.
- Phase dau chi pure candidate contracts + adapters + tests. Runtime v1 cung existing tests giu nguyen cho den checkpoint integration duoc giao ro.

## OWNED_PATHS - checkpoint B1

1. packages/ai/src/scan-contract-v3.ts va scan-compatibility-v3.ts, candidate pure functions khong tu inject runtime.
2. tests/unit/scan-contract-v3.test.ts, scan-compatibility-v3.test.ts; non-PII synthetic contract fixtures duoc B03a owner/coordinator chot.
3. Contract ADR/design/error table va packet duoi docs/backend-upgrade/tasks.
4. Public export wiring packages/ai/src/index.ts chi khi coordinator giao, vi shared path voi B04.

CURRENT_STATE.md, TASK_BOARD.md, HANDOFF.md va DECISIONS.md do coordinator cap nhat khi gom checkpoint; B03b cung cap noi dung/diff cho cac file shared.

## FORBIDDEN_PATHS - checkpoint B1

- Existing schemas.ts, router.ts, task-runtime.ts, providers, prompts va quality-gate.ts; routes/scans.ts, services/scan-queue.ts, scan-quota.ts, validation/schemas.ts; src/web va packages/db/domain inventory.
- src/worker/index.ts CORS va shared Env/config; wrangler.jsonc; package.json/lockfile; migrations (ca moi va applied); .github/workflows; billing/auth/PayOS/secrets.
- T19/T20/T21 authority/recovery artifacts, recipe catalog manifest/read authority, applied 0039 va production evidence.
- Provider flags/allowlists, AI_QWEN_ONLY gate, model/timeout/budget changes va deployment phai nam task release/runtime rieng.

Checkpoint B2/B3 muon sua protected shared paths phai coordinator cap ownership explicit sau ADR, khong tu mo scope.

## Contract candidate

- Envelope schemaVersion:3, task discriminator receipt_ocr | label_ocr | fridge_image_analysis, document/source ID va ordered line occurrence IDs/sourcePosition. DTO label doc lap, khong muon receipt DTO.
- Field evidence union known(value,basis,evidence) | unknown(reason); khong default unknown quantity/unit/date/price/merchant/confidence thanh plausible values. Reason taxonomy bounded va privacy-safe; model confidence khong la human confirmed evidence.
- Quantity tach amount, unit, purchase/package basis va source text. Strict physical conversion g/kg va ml/l; pack/count/culinary measures khong convert sang mass neu thieu evidence.
- Money {amountMinor,currency:VND|JPY}; amountMinor safe integer nonnegative, VND/JPY zero decimal places explicit; unknown currency giu unknown. Khong FX; khong gang field JPY vao *_vnd.
- Receipt total, line total, unit price, tax/discount va quantity basis tach rieng; khong tu ep quantity x price = total khi receipt thieu basis/evidence. Hai line mua that giong nhau van la hai occurrences.
- Status phan biet SCHEMA_VALID/DRAFT/USABLE/CONFIRMABLE; khong xem schema pass la usable/inventory safe. Incomplete draft co the hop schema nhung confirmation phai co positive quantity + supported unit tu evidenced extraction hoac explicit user review.
- Canonical ID proposal tham chieu existing certified ingredient authority; unknown/ambiguous abstain. Khong promote ING_ENR IDs qua similarity ten.

## ADR va API compatibility

Du kien giu URLs /api/v1/scans/fridge, /receipt, /:id, /:id/confirm. Opt-in header X-Scan-Contract-Version:3; absent giu v1, unsupported version reject voi documented stable error/status. Chot error table trong ADR, khong tu chon schema negotiation qua JSON field co the bypass policy.

Adapter v3->v1 chi xuat field bieu dat trung thuc: known VND vao *_vnd; JPY khong map; unknown khong map thanh 0/1/piece. Neu payload khong du v1 strict schema, tra typed incompatibility/draft branch da cong bo; khong silently mutate existing v1 success shape hoac bo validation. Human-confirmed field ghi basis/review provenance, khong thay doi original OCR evidence.

Old/new request/job/result envelopes phai typed va versioned; legacy messages/results without version duoc classify v1. Unsupported version fail closed. Readers trien khai truoc writers; pending jobs/results hai versions doc duoc khi rollout/rollback. Schema storage design va new migration la task integration sau, khong cap so 0040 truoc coordinator.

CORS header change nam src/worker/index.ts do coordinator thuc hien B2 cung contract tests. Candidate B1 khong sua CORS/runtime. Client review UI phai hieu incomplete draft va manual quantity/unit truoc bat writers V3.

Idempotency request fingerprint va durable receipt phai bind task + contract version + image/body. Cung key/anh nhung version/task khac tra 409 CONTRACT_IDEMPOTENCY_CONFLICT (ADR target), khong replay DTO version khac. Persist task/schema version trong job/result/receipt truoc enqueue; absent header normalize v1. Tests bao gom cross-version/cross-task replay va response-loss retry.

## Checkpoints

### B1 - Pure contracts, ADR, compatibility tests

- Read actual caller/serialization/persistence boundaries, produce typed task DTOs va known/unknown adapters.
- Meaningful tests prove unknown preservation, JPY/VND separation, line multiplicity, positive known quantity/unit validation, unsafe projection rejection.
- Existing v1 schema/payload snapshots va failure taxonomy khong thay doi. Candidate chua runtime authority/producer.
- Deliver CODE_COMPLETE_CONTRACT_CANDIDATE khi focused/full local gates pass; chua STAGING_CERTIFIED/PRODUCTION_APPROVED.

### B2 - Coordinated reader/writer/client integration

- Chi bat dau sau reviewed ADR va coordinator giao owned paths cho schema/runtime/route/queue/DTO/client/CORS.
- Expand-only persistence; khong rewrite migrations 0001-0039. Coordinator cap migration sequence neu can. Legacy readers/writers va rollback phai co proof.
- V3 incomplete draft tuyet doi khong di vao existing scans.ts quantity fallback `submitted ?? persisted ?? 1` hoac unit fallback canonical default/piece; enforce version-aware reviewed confirmation boundary.
- Confirmation giu household/scan item source proof, idempotency, atomic status transition va T09/T11 inventory lot commands. Khong AI/adapter/shadow tu ghi inventory.
- Consumer/request header tests + client review tests + old/new queue/result compatibility; invalid schema version reject; versioned error table stable.

### B3 - Certification handoff

- B03a reviewed dataset+scoring; B04 runtime job budget/cancellation; client readiness va separate reviewed release packet.
- Flags OFF den khi reader/writer/client/storage/rollback certified; khong paid provider benchmarking/deploy o B03b.

## Acceptance/test cases

1. Absent quantity/unit/price/date/merchant/confidence remain unknown after parse/serialize/persist candidate; no default estimates and no false numeric success.
2. Currency unknown remains unknown; JPY amount cannot populate VND fields; safe integer/minor-unit failures reject; receipt tax/discount/package basis khong fabricated.
3. Label task khong yeu cau receipt merchant/totals; fridge khong suy quantity chi tu ten/anh.
4. Legitimate identical purchase lines keep occurrence/order/aggregate quantity+amount; same-source duplicate extraction only removed with evidence. OCR quality dedupe hien tai khong du lam rule V3.
5. v1-compatible known payload output preserves existing fields/errors; incompatible v3 payload cannot pass legacy strict confirm schema via quantity/unit fallback.
6. Unknown ingredient identity retains raw text and abstains; no provisional promotion, no invented allergen safety.
7. Unsupported/malformed envelope/task/version reject; known evidence/value inconsistency reject; privacy-safe errors/logs exclude raw OCR/image/PII.
8. Integration: household isolation, ready->confirmed concurrency, duplicate response-loss replay, missing quantity/unit explicit manual review, cancelled/stale job cannot publish/write, no double quota settlement.
9. Integration: legacy/new pending jobs and persisted results remain readable after deployment/rollback; schema readers precede writers.

## Proposed commands - chua chay trong B00

```sh
pnpm vitest run tests/unit/scan-contract-v3.test.ts tests/unit/scan-compatibility-v3.test.ts tests/unit/scans.test.ts tests/unit/receipt-scan.test.ts tests/unit/scan-route-errors.test.ts
pnpm vitest run tests/integration/scan-response-loss.test.ts tests/integration/scan-queue-fencing.test.ts tests/integration/scan-async-quota-lifecycle.test.ts tests/integration/inventory-closed-loop-routes.test.ts
pnpm lint
pnpm typecheck
pnpm test
pnpm check:migrations
pnpm build
git diff --check
```

Node >=22.13/sqlite3; frozen lockfile. B2 changed storage requires local D1 schema apply/gates va clone rehearsal theo separately scoped packet. UI changes require actual app/browser interactions. Ghi exact commands/counts/failures; proposed commands khong phai executed evidence.

## Baseline blockers va budget

- schemas.ts v1 requires positive estimated_quantity va StandardUnit; price fields chi *_vnd. label_ocr dang receipt path.
- scans.ts quantity/unit compatibility fallback co the invent when V3 draft missing; can version-aware block truoc confirmation.
- quality-gate.ts receiptDuplicateKey content-only dedupe va arithmetic filter; can occurrence/basis-aware decision.
- Queue Promise.race 75s khong propagate abort; runtime ceilings hien per invocation, reset khi queue retries. B04b phai durable per-job admissions va cancellation CAS, giu existing fencing/quota.
- Candidate contracts khong can paid budget. Provider validation chi khi owner chot capped spend/calls/tokens/stop policy; B03b khong cap quyen budget spends.
- Missing inputs cho B2/B3: ADR final negotiation/storage/error choices, explicit shared-path ownership, migration sequence, old/new reader certificate, compatible client, licensed heldout corpus va approved benchmark budget.

## Completion va rollback

B1 done = reviewed ADR + pure contract/adapter tests + executed local checks va diff evidence. Khong claim full V3 path complete tu B1. Pure candidate rollback la ngung export/use; B2/B3 runtime rollback phai doc duoc existing v3 jobs/results va khong rewrite inventory history. Coordinator ghi exact status/head/checks va smallest next action trong state/board/handoff.
