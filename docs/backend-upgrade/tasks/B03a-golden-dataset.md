# B03a - Golden dataset va evaluator Scan V3

Ngay: 2026-10-11 JST. Owner: AI Evaluation / QA. Trang thai packet: READY_FOR_OFFLINE_IMPLEMENTATION; khong phai DATASET_CERTIFIED hay PROVIDER_CERTIFIED.

## Authority va pham vi

- Repository: vn-tak/Tako-san, repository ID 1385308553.
- Base SHA: 652e0d7632745e9b77cda4b5b3caac83a3ec1015. Truoc implementation ghi branch/head thuc te va diff voi base. Neu main da doi, coordinator pin lai; khong dua vao remote label hoac checkout legacy.
- Phu thuoc: B00 canonical checkout/route map; B03b candidate schema cho evaluator contract. Checkpoint manifest/scorer co the bat dau truoc khi co anh that; certification phu thuoc assets duoc phep su dung va human labels.
- Chi offline dataset/scorer. Khong provider calls, network ingestion anh, credentials, D1, inventory write, deployment hay thay doi runtime behavior.
- Tai su dung task contracts/runtime policy hien co; evaluator la cong cu offline, khong tao AI router hoac ingredient authority thu hai.

## OWNED_PATHS

1. qa/ocr/v3/README.md, dataset-manifest.schema.json, annotation.schema.json, LICENSES.md va manifest candidate.
2. tests/fixtures/scan-v3: synthetic expected/predicted fixtures khong PII, khong anh nguoi dung.
3. scripts/scan-v3-eval.mjs va module scoring thuan duoc goi boi script.
4. tests/unit/scan-v3-evaluator.test.ts va tests/unit/scan-v3-dataset.test.ts.
5. Packet nay va reporting template ben duoi docs/backend-upgrade/tasks; CURRENT_STATE.md, TASK_BOARD.md, HANDOFF.md do coordinator cap nhat.

Scripts scripts/ai-eval.mjs va scripts/ocr-benchmark.mjs chi thay doi qua checkpoint compatibility do coordinator giao; khong sua corpus ai-golden.json dang co 6-case regression de gia tang certification.

## FORBIDDEN_PATHS

Runtime packages/ai/src/router.ts, task-runtime.ts, providers; src/worker/routes, services, config, index.ts; src/web; packages/domain va packages/db; wrangler.jsonc; migrations; .github/workflows; package.json va pnpm-lock.yaml; billing/auth/PayOS; T19/T20/T21 authority/recovery artifacts; ignored private evidence/credentials. Khong commit asset rieng tu hay gia lap license/consent.

## Checkpoints va dau ra

### A1 - Contract manifest/scorer offline

- Dataset manifest versioned, content hash, immutable asset ID, document/source group ID, task, locale/country, quality slice, source image hash, preprocessing variant hash va version.
- Metadata license/permission, source provenance, retention/access policy, redaction status, human transcript/annotation reviewer, adjudication status, split va annotation schema version. Truong thieu duoc ghi MISSING, khong fake reviewed/approved.
- Scorer nhan ground truth va predicted output tu files; khong goi provider. Default dry-run; live flag bi reject ro rang o evaluator nay. Khong doc env credentials.
- Synthetic fixtures chung minh scoring voi UNKNOWN, VND/JPY, duplicate line occurrences, damaged image failures, missing outputs, abstention va malformed schema.
- Dau ra machine-readable report + concise reporting template; immutable input hash, evaluator version/SHA va command duoc ghi.

### A2 - Pilot asset assembly khi du dau vao

- Muc tieu pilot 240 original assets: 60 VN receipts, 60 JP receipts, 60 labels, 60 fridge images; moi nhom co clean, blur, tilt, low-light, missing-field cases. Day la pilot design, khong final statistically powered heldout.
- Split theo original document/source; preprocessing variants va cung receipt khong duoc roi vao ca calibration va heldout. Report sample counts theo document, khong dem tung field/variant la sample doc lap.
- Expected labels do nguoi review doc lap voi provider output. Receipt/label phai co evidence text/position. Fridge quantity unknown neu anh khong chung minh duoc, khong suy khoi luong tu nhan dien ten.
- Hai dong mua that giong ten/quantity/unit/price van la hai occurrences; chi duplicate extraction co position/evidence moi duoc loai.
- Ghi measured minutes/item, rework/rejection, disagreement va evidence reuse; tinh final sample size/coverage floor sau pilot va truoc final heldout.

### A3 - Ready for separately scoped benchmark

- Dataset certificate chi khi license, human labels, hashes, split isolation va task slices da qua review.
- Benchmark runner/provider execution thuoc task sau, khong B03a. Pin dataset, evaluator, models/policy/pricing, capped budget va heldout targets truoc paid execution.
- Khong tu sua dataset/threshold sau khi da xem heldout de lam pass. Bat ky doi nao tao version moi va giu report cu.

## Scoring contracts

1. Schema-first pass va final schema pass: denominator tat ca submissions; timeout/no output/parse failure khong bi loai. Persisted-accepted output phai 100% schema compliant; usable success bao rieng.
2. Field precision/recall theo task/locale/quality. Quantity, unit, basis phai dung dong thoi; money phai dung amount va currency, khong FX conversion. AmountMinor policy VND/JPY zero decimal places phai explicit.
3. Canonical match bao accepted precision va abstention/coverage rieng; khong cho abstain gan het tro thanh QUALITY_CERTIFIED.
4. Unknown hallucination = asserted-known tren ground-truth unknown / unknown slots. Bao sample size va confidence interval 95%; 0 observed chi la sample result, khong claim zero production risk.
5. Line matching dung occurrences va source positions; truong hop duplicate purchases khong collapse. Khong chi ten matching; support name text error metric rieng voi semantic money/quantity metric.
6. Latency tach queue wait/provider/end-to-end; timeout/failure rate bao rieng. Provider comparison paired theo cung anh/task policy/budget; uncertainty/bootstrap theo document.
7. Chi phi/100 successes = 100 x tong primary + repair + retry + shadow cost / successful jobs. Zero success tra undefined/not-computable, khong zero cost. Ghi estimated vs billed, pricing version, usage unknown va conservative estimate; khong tu suy billed amount.

## Quality va cost gates

- Offline correctness: meaningful adversarial fixtures pass, repeat report deterministic voi same inputs; malformed labels/contradictory known/unknown fail closed.
- License/transcript missing: MANIFEST_READY hoac SCORER_CODE_COMPLETE chi la implementation classification; DATASET_CERTIFIED remains blocked.
- Final quality targets proposal: accepted canonical match precision >=99%, clean critical receipt fields >=95%; degraded thresholds, coverage/recall floors va statistical sample size can chot sau pilot truoc heldout. Chua dat chung thanh release gate o B03a.
- 0 observed UNKNOWN hallucination tren heldout/adversarial la necessary gate; slice thieu sample size la INCONCLUSIVE, khong PASS.
- Paid run phai co owner-signed cap tong spend/calls/tokens, per-job ceilings, stop policy va report receipt. Budget unknown khong cho paid request. B03a chi tinh cost tu cung cap offline usage fixtures.
- Khong false inventory write; evaluator khong khoi tao D1/runtime client.

## Proposed test commands - chua chay trong B00

```sh
pnpm vitest run tests/unit/scan-v3-evaluator.test.ts tests/unit/scan-v3-dataset.test.ts tests/unit/ai-golden-dataset.test.ts
node scripts/scan-v3-eval.mjs --dataset tests/fixtures/scan-v3/dataset.json --predictions tests/fixtures/scan-v3/predictions.json --dry-run
pnpm ai:eval -- --dry-run
pnpm lint
pnpm typecheck
pnpm test
pnpm check:migrations
pnpm build
git diff --check
```

Implementation packet phai tao files/CLI dung commands tren; neu syntax thay doi, ghi exact command thuc te. Dependency install frozen-lockfile tren canonical checkout; Node >=22.13 cho node:sqlite va sqlite3 CLI. Loi phai ghi nguyen nhan/limitation, khong claim hosted/staging/production PASS tu local checks.

## Current blockers va evidence

- Base tests/fixtures/ai-golden.json co 6 symbolic cases, mot image fixture://receipt-vietnamese, khong real licensed OCR corpus.
- scripts/ai-eval.mjs chi inspection; mode live cung khong provider execution va khong scoring. scripts/ocr-benchmark.mjs yeu cau positive quantity/totalPriceVnd, khong du cho UNKNOWN/JPY/tasks V3.
- Chua co 240 assets/licensing/consent/transcript adjudication, final sample size/thresholds, provider eligibility certificate, capped paid budget hoac billed pricing evidence.
- Khong can cac dau vao tren de bat dau A1. A2/A3 giu classification blocked chinh xac cho dependency thieu, khong tu tao evidence.

## Completion va rollback

Done A1: reviewed manifest/annotation contracts, adversarial deterministic scorer tests, fixture inspection report va commands/results duoc luu trong repo. A2/A3 duoc theo doi rieng, khong gop "code complete" vao "quality certified". Rollback offline la dung evaluator/version moi va tro ve existing tools; khong runtime/data mutation. Coordinator cap nhat state/board/handoff voi actual checks va exact next action.
