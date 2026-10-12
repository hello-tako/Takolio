# B05a - Ingredient V2 review contracts va source-to-authority proof

Ngay: 2026-10-11 JST. Owner: Catalog/data + domain reviewer. Trang thai packet: READY_FOR_OFFLINE_REVIEW_CONTRACT_IMPLEMENTATION; V2 van REVIEW_CANDIDATE, khong runtime authority.

## Authority va dependencies

- Repository vn-tak/Tako-san, ID 1385308553. Base SHA 652e0d7632745e9b77cda4b5b3caac83a3ec1015; implementation ghi exact branch/head/diff, pin lai neu main da doi.
- Canonical candidate source hash: da87da20475fa8d7ec92c716e899ee572339573258ae6d9cc7f3f8f554f2d695, tai data/recipe-refresh/v2/manifest.json.
- Dependencies: B00 pin source/candidate/release authority; read ADR-033, RUNTIME_INGREDIENT_MODEL_V2.md, candidate modules, consumer dependency map va existing refresh release gate.
- Co the bat dau schema/proof offline ngay; human review pilot B05b can assigned reviewers/evidence. Migration/hydration/consumer/cutover thuoc B05c-d-e sau.
- Tai su dung IngredientReviewDecisionSchema, compileReviewedIngredientAuthority, RuntimeIngredientV2Schema, projectV1ShoppingRequirements va current immutable release fingerprint function. Khong tao ingredient catalog, resolver hoac authority thu hai.

## OWNED_PATHS

1. packages/recipes/src/ingredient-review-manifest.ts: wrapper schema cho evidence-bound review decisions, transformation/source/nutrition review references.
2. packages/recipes/src/ingredient-authority-v2.ts va runtime-ingredient-v2.ts chi thay doi nho, pure candidate validation/proof; old callers giu contract, khong runtime wiring.
3. packages/recipes/src/runtime-ingredient-audit.ts va scripts/runtime-ingredient-v2-audit.mjs cho deterministic review status reporting; input source unchanged.
4. artifacts/runtime-ingredient-v2 derived audit outputs khi script tao va byte determinism pass; khong hand edit generated JSON de clear blocker.
5. tests/unit/ingredient-review-manifest.test.ts, ingredient-authority-v2.test.ts, runtime-ingredient-v2.test.ts, review audit tests neu co behavior thay doi.
6. Packet/design/consumer readiness matrix/report template duoi docs/backend-upgrade/tasks; docs/ai/RUNTIME_INGREDIENT_MODEL_V2.md update actual candidate state. Shared CURRENT_STATE.md/TASK_BOARD.md/HANDOFF.md/DECISIONS.md do coordinator tong hop.

## FORBIDDEN_PATHS

- data/recipe-refresh/v2 canonical source, manifest eligibility/fingerprint va current certified release manifests khong sua o B05a; thay source can task provenance/review rieng va tao version immutable moi.
- migrations (applied va new), current D1 hydrator/repository authority, packages/db, src/worker recipe authority/routes/services, recipe engine/discovery/production catalogue.
- Planner/composer/shopping/cooking/inventory consumers, inventory lot/event history, favorites/locks/persisted plan snapshots; src/web; ingredient canonical seed/master/alias runtime authority.
- wrangler.jsonc, runtime flags, .github/workflows, package.json/lockfile, auth/billing/PayOS/secrets, T19/T20/T21 forensic/recovery artifacts va production bookmarks.
- No network source fetching, provider normalization, remote D1, import/recovery/migration/deploy. Khong reapply 0039 hoac chon so 0040 truoc coordinator.

## Baseline candidate truth

| Metric | Source-state tai base |
| --- | --- |
| Recipes / source ingredient lines | 500 / 6766 |
| Projected / excluded lines | 3770 / 2996 |
| Excluded transformations / projected-risk review | 2860 / 169; tong 3029 review lines |
| Distinct provisional IDs trong recipe rows | 1395 ING_ENR concepts |
| Source concept count | 1438, gom 43 existing canonical IDs |
| Safe newly resolved exclusions | 0 |
| URL occurrences / unique URLs / recorded verified content | 1102 / 1072 / 0 |
| Nutrition publishable / blocked / truthful null | 1 / 288 / 211 |

Manifest runtimeProjectionReady=false, productionReleaseReady=false, finalRuntimeFingerprint=null. Bon blockers: RUNTIME_PROJECTION_LOSS, INGREDIENT_RECONCILIATION_INCOMPLETE, SOURCE_CONTENT_VERIFICATION_INCOMPLETE, NUTRITION_EVIDENCE_INCOMPLETE. Counts tren la candidate audit, khong production defect counts.

Review-risk classes gom culinary/count/package semantics, qualitative/missing purchase quantity, process use, identity ambiguity va nutrition absorption. Classifier chi triage, khong evidence cho conversion hay promotion.

Quarantine evidence: vn-hap-01 salt-bed source sodium 51497.78 mg/serving va imp-6eaf6ed6d417c52c 1 L frying-oil source energy 2994.53 kcal/serving. Process amount khong tu dong la consumed amount; blocked/null nutrition khong project numeric macros. Khong clamp outliers de lam profile publishable.

## Review manifest contract

Manifest versioned; contains candidate canonicalSourceSha256, baseReleaseId, reviewManifestId/content hash, schema version va per-decision evidence. Empty/synthetic manifest classified TEST_ONLY/INCOMPLETE, khong reviewed production authority.

### Ingredient identity decision

- Key provisionalId + sourceName/source references va candidate source hash.
- Existing decisions: MATCH_EXISTING, ALIAS_EXISTING, REVIEWED_NEW_CONCEPT, POSSIBLE_DUPLICATE, AMBIGUOUS, INVALID.
- Resolved decision requires targetId, basis, evidenceReference, reviewer identity, reviewedAt, reviewed source hash va explicit authority scope. Unresolved decision khong la successful promotion; null target/review semantics giu fail closed.
- MATCH/ALIAS targets phai existing IDs trong certified same-release authority; khong target provisional ID. REVIEWED_NEW_CONCEPT giu original ING_ENR ID nhung chi approved decision proof moi duoc tao master row; collision/duplicate/alias-cycle/contradiction reject.
- SourceName phai thuoc actual concept sourceNames. Similarity/AI hint la candidate metadata, khong co gia tri review evidence.

### Transformation and quantity decision

- Key recipeId + sourcePosition + source row digest + ingredient identity + source hash. Display quantity text giu original; unknown/missing quantity khong zero.
- Quantity channels tach display, shopping demand, process use, consumed quantity va servings scaling. Known shopping unit/amount can source explicit hoac independently reviewed conversion evidence; process quantity khong tu copy sang shopping/nutrition.
- Physical g/kg va ml/l conversions deterministic; culinary measure/pack/count food-specific mass can evidence density/package/mass reference, applicability range va reviewer. Khong universal tablespoon/cup/onion weight.
- Scaling policy proportional | fixed | unresolved theo channel; source text khong tu rewrite thanh fabricated numeric quantity. Process salt bed/frying medium khong inherit edible food scaling.
- Exclusion phai co explicit semantics/evidence, khong xoa line de tang coverage. Preserve identity trong hard restriction set ke ca quantity unresolved; projectV1ShoppingRequirements phai refuse provisional/incomplete/unresolved shopping input.

### Source, allergen va nutrition evidence

- URL structural validity khac content verification. Review record reference/URL, source content hash, observedAt, verified claim mapping/source line va reviewer; unreachable/changed/unverified van unresolved. B05a chi schema, khong fetch sources.
- Allergen safety khong suy tu absence tag; identity/restriction lineage khong bi mat khi exclude quantity/process row.
- Nutrition consumes evidenced edible/absorbed amount, certified nutrient reference va profile scope/per-serving basis. Unknown absorption/edible quantity giu blocked/null; full oil/salt process amount khong la consumed amount.
- No manufactured citations, signature, verifiedAt/reviewer. Sensitive/copyright source bytes tuan license/access; public audit chi allowlisted metadata/counts/digests.

## Checkpoints

### C1 - Review schema va proof fixtures

- Read existing source manifest/audits/contracts; document dependency consumer map, current gates va why V1 projection of the V2 candidate remains blocked.
- Add evidence-bound review wrapper schema; pure helper checks source hash, source-line coverage, decision cardinality, evidence binding, alias targets, collision va contradictions.
- Adversarial synthetic fixtures prove empty/partial/stale source/ambiguous/fake promotion/conversion fail closed. Fixtures co TEST_ONLY labels; khong ghi fake decisions vao real manifest.
- Existing candidate contracts giu approved semantics; khong runtime cutover/migration/export authority.

### C2 - Deterministic audit and readiness report

- Run current audit from same source bytes; shuffled input/decision order cho same normalized result/hash, duplicate/stale/invalid decisions block.
- Report class counts va resolved/unresolved review status; aliases/master rows chi pure output khi complete evidence decision set, khong persist runtime.
- Required source coverage includes all 6766 lines/exclusion reasons; meaningful evidence gate cannot be replaced by numeric coverage percentage.
- Verify release-check expected red voi 4 actual blockers; khong sua releaseReady/fingerprint de pass. Record command exit1 la EXPECTED_BLOCKED, khong "tests failed" che khuat va khong claim release PASS.

### C3 - B05b pilot handoff

Pilot next task: 40 concepts, 60 transformations va 20 source URLs, choose across ambiguity/count/culinary/package/process/nutrition classes. Review throughput minutes/item, rejection/rework/disagreement va evidence reuse. Partial approved pilot decisions remain offline review artifacts, khong partial authority cho 500 recipes.

Chot full review capacity/schedule tu pilot truoc cam ket completion date. Mixed certified/unknown enrichment hoac release subset can ADR/schema/release proof rieng; khong silently lower full-release gate.

## Consumer readiness matrix - phai ghi truoc B05c/d

| Consumer | Proof truoc authority cutover |
| --- | --- |
| T02/T04 planner | Unknown shopping demand infeasible/unresolved, khong zero; recipe identity/restrictions intact |
| T03/T20 ranking/composer | Full ingredient restriction identity set, release-bound snapshots va unchanged locks/revision rules |
| T05 shopping | Only shopping demand, strict evidence conversion/pack rounding, shortage counted once |
| Cooking/inventory | Only evidenced used/purchased quantities; no nutrition/process estimates stock deduction; FEFO/ledger untouched |
| Recipe detail/UI | Display source text distinct; incomplete quantity khong numeric one-click shopping/confirm |
| Servings | Explicit per-channel scaling, process/fixed/unknown behavior |
| Nutrition | Independent edible/absorption evidence; blocked/null stays truthful |
| Persisted plans/favorites/media | IDs/content release lineage stable; old/new readers/rollback preserve meaning |

## Acceptance gates

1. No provisional auto-promotions, guessed conversions, fake reviewed decisions/citations hay fabricated nutrient/allergen facts.
2. Exact source hash and complete line/concept coverage; mismatches/duplicate conflicting evidence/unknown dependency fail closed.
3. Pure deterministic output va byte-stable audit; same-source IDs and projections use existing fingerprint implementation, khong parallel authority.
4. Existing source/manifest and runtime release remain unchanged; finalRuntimeFingerprint stays null va expected release gate stays blocked khi evidence incomplete.
5. Candidate counts/quarantine/blocked-null truth unchanged unless separately reviewed actual evidence justifies candidate version.
6. C1/C2 local tests PASS khong imply DATA_CERTIFIED/STAGING_CERTIFIED/PRODUCTION_APPROVED. Migration/FK/quick_check/import rollback rehearsal chi B05c/e tren separately scoped clone/staging, khong B05a.

## Proposed commands - chua chay trong B00

```sh
pnpm vitest run tests/unit/ingredient-review-manifest.test.ts tests/unit/ingredient-authority-v2.test.ts tests/unit/runtime-ingredient-v2.test.ts tests/unit/recipe-refresh-v2.test.ts
pnpm recipe:ingredient-v2:audit
pnpm recipe:refresh:check
pnpm recipe:import:check
pnpm recipe:refresh:release-check
pnpm lint
pnpm typecheck
pnpm test
pnpm check:migrations
pnpm build
git diff --check
```

release-check du kien exit1/4blockers va phai report EXPECTED_BLOCKED; cac gates con lai meaningful PASS truoc checkpoint. Node >=22.13/sqlite3, frozen-lockfile; khong remote schema/read/import shortcuts. Record exact commands/counts/errors/head/source hashes, local vs hosted distinction.

## Missing inputs, cost va completion

- Chua co completed human decision set cho 1395 concepts/3029 review lines/source claims/nutrition, source-content evidence, reviewer capacity va consumer migration certificate.
- B05a khong paid provider budget, khong AI-generated reviewed evidence. Human review capacity/cost duoc do B05b; no invented deadline/cost estimate.
- Done C1/C2: reviewed contract/proof fixtures, deterministic current audit, truthful blocked release report va precise pilot task. Runtime projection/final migration/cutover van dependency pending.
- Rollback C1/C2 la ngung candidate use va tro ve previous audit/schema version; no D1 history/write changes. Coordinator updates state/board/handoff actual checks, implementation head va B05b next action.
