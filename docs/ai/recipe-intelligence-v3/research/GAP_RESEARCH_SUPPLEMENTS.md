# Gap research supplements

Current aggregate of bounded research integrated into 25 canonical packets. Initial research left 97 recipes without external-content claims. Supplements01-03 covered85; supplements04-05 covered the remaining12 with bounded source or related-variant claims. Supplement06 adds bounded safety evidence for six critical cases. Source reading or one supported field does not verify a complete recipe. All humanReview=PENDING, fullRecipeVerification=NOT_COMPLETE, sourcePromotionAllowed=false, runtimePromotionAllowed=false.

| Supplement | Recipes reviewed | Recipes with bounded external facts | Claims added | Editorial edits |
|---|---:|---:|---:|---:|
|01|10|8|15|9|
|02|30|28|47|10|
|03|57|49|175|0|
|04|8|8|41|0|
|05|4|4|17|0|
|06|6 critical cases|5; sprouts unresolved|6|4|

01:11 readable sources/7 failed attempts. 02:30 readable/33 failed/7 reachable-only. 03:118 URLs/75 bounded reads including11 PDFs/13 reachable-only/30 failed. 04:46 source records/47 retrieval observations/17 bounded reads/36 fact references. 05:13 source records/6 bounded reads/12 fact references. These supplement records overlap existing sources; canonical totals count merged records.

06 researched28 source records and four official GOV.UK/FSA documents with eight facts, plus reused JOC facts. Only sources explicitly linked to recipe claims were integrated: seven new packet source rows, three new URLs, six claims and four edits. Existing JOC source/facts/history remained byte-equivalent. The unused cross-contamination document and failed alternatives remain temporary supplement evidence; they were not assigned to recipes without claims. Source recipeIds were narrowed to exact sourceIds ownership after an audit failure caught overly broad packet-level ownership. All previous source objects and historical claim/edit prefixes were preserved.

Raw HTML/PDF/text caches stay private. Canonical packets retain response/text hashes, retrieval history, bounded fact summaries, locators and support limits. Internal comparisons are FACT_SUPPORTED/INTERNAL_V2_OBSERVATION only. Every edit cites an exact claim pointer. No quantities, identity, nutrition, role or serving edits were made.

Current:500 recipes/25 packets;1180 source rows/1145 URLs/1319 claims;500/500 with bounded external-content claims. 36 reversible edits/29 recipes. Full culinary verification0/500;human approval0/500.

Source partition:{"bounded reads": 668, "reachable-and-unavailable": 4, "reachable-only/unread": 199, "unavailable-only": 309}. Claim states:{"FACT_SUPPORTED": 398, "SOURCE_CONFLICT": 8, "SOURCE_CONTENT_READ": 592, "SOURCE_UNAVAILABLE": 321}.

## Remaining formulation review

No recipe lacks a bounded external-content claim, but exact formulation review remains open. `imp-d02c9b83214f81be` has only a related shrimp-cucumber salad source without pork. It does not verify the canonical shrimp/pork salad. Broth volume, serving yield, mushroom/cut/shell state, coating and oil retention differ across other variants; no averaging or automatic quantity replacement is authorized.

The earlier UnicodeEncodeError for Laziji was a retrieval error, not publisher outage. Corrected encoded-source reading remains separate from safety review.

## Critical safety queue

| Recipe ID | Candidate change and unresolved decision |
|---|---|
|`imp-ac255bcc36d1324e`|Both `/steps/5/instruction` and `/steps/5/tip` retain52-54C. JOC attributes63C to USDA; exact official numeric fish guidance was not independently retrieved. No append-only warning applied because the contradictory imperative would remain. FAIL_UNRESOLVED.|
|`imp-f729957329cd75f5`|Pad Thai note warns fresh shrimp remains after dried-shrimp omission. Raw/briefly warmed sprouts in steps9-10 lack exact official safety evidence. No sprouts edit or allergen safety approval.|
|`imp-a71f6ef791b463ea`|Five-minute lemon soak/raw shrimp remains unresolved. General freezing/cooked-seafood advice does not validate acid treatment or a shrimp freezing protocol. No edit.|
|`imp-c398c169dc196c4e`|`/steps/8/instruction` now requires sauce reserved before raw-shrimp contact and clean utensils. Full doneness, raw handling and consumed-oil review remain open.|
|`imp-f04b28987d7cd34a`|Both step0 instruction/tip now use fridge thawing, drip control, packaging guidance and fully thawed center; room-temperature1-2h/rinse instructions removed. Raw/pre-cooked crab identity and downstream endpoint remain unresolved.|
|`imp-0efe9204d9dbdb3e`|Step2 tip warns external color/time cannot prove chicken cooked; clean food thermometer/raw-contact marinade caution added. No recipe-specific temperature/time endpoint selected.|

Official guidance retains its UK household context. General food guidance is not species/formulation certification. All six remain critical and pending despite bounded improvements.

Source-internal conflict `imp-de5ce12092f4f0aa`:250g frozen spinach paired with7oz;7 avoirdupois oz is approximately198g. No replacement quantity chosen. Cream-based shrimp pasta, lemongrass mushroom and soft-shell-crab sources remain separate formulations.

## Executed validation and limits

```sh
PATH=/opt/homebrew/opt/node@24/bin:$PATH TMPDIR=/private/tmp node scripts/recipe-intelligence-v3-audit.mjs --check
CI=1 PATH=/opt/homebrew/opt/node@24/bin:$PATH TMPDIR=/private/tmp pnpm test tests/unit/recipe-intelligence-v3.test.mjs tests/unit/recipe-intelligence-v3-artifacts.test.mjs
```

PASS500 recipes/25 packets/36 reversible edits;focused2files/29tests/4.07s. The artifact test now runs the full audit --check, covering unchanged candidates and generated outputs. Source-cache checkers01-06 retain their observation-time scope;06 passed28 raw/text hashes,10 locators,10 fact refs,6 V1/V2 hashes and4 exact oldValue pointers. Full-cache retrieval histories and unused06 attempts remain private session evidence.

Original14 research reports retain initial narratives as historical text; their current prefixes contain current counts/hashes and shared audit validation. Exact commands, full-gate scope and retained failures: `../14_TEST_STRATEGY.md`. All four V2 release blockers and dependency advisories remain. No source/nutrition/ingredient certification, runtime promotion, browser/staging acceptance, human approval or production mutation.
