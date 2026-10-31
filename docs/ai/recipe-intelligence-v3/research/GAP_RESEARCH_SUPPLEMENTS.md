# Gap research supplements

Current aggregate: 500 recipes/25 packets; 1,190 source rows/1,152 distinct URLs/1,328 claims. All 500 have bounded external-content claims. There are 49 reversible edits across 29 recipes. Full culinary verification and human approval remain 0/500; all humanReview=PENDING, fullRecipeVerification=NOT_COMPLETE, sourcePromotionAllowed=false, runtimePromotionAllowed=false.

Source partition: 678 bounded reads, 199 reachable-only/unread, 309 unavailable-only, four reachable-and-unavailable. Claims: FACT_SUPPORTED405, SOURCE_CONTENT_READ594, SOURCE_UNAVAILABLE321, SOURCE_CONFLICT8. One supported field does not verify a complete recipe.

| Supplement | Recipes reviewed | Recipes with bounded external facts | Claims added | Editorial edits |
|---|---:|---:|---:|---:|
|01|10|8|15|9|
|02|30|28|47|10|
|03|57|49|175|0|
|04|8|8|41|0|
|05|4|4|17|0|
|06|6 critical cases|5; sprouts unresolved at that checkpoint|6|4|
|07|6 critical cases|6; bounded official safety facts|7|8 new paths, 1 prior edit revised|
|08|1 raw-crab case|1; general MHLW and product comparator facts|2|5 new paths, 2 prior edits revised|

Initial research left 97 recipes without external-content claims. Supplements01-03 covered85;04-05 covered the remaining12 with bounded source or related-variant claims. These records overlap existing sources; canonical totals count merged records.

01:11 readable sources/7 failed attempts. 02:30 readable/33 failed/7 reachable-only. 03:118 URLs/75 bounded reads including11 PDFs/13 reachable-only/30 failed. 04:46 source records/47 retrieval observations/17 bounded reads/36 fact references. 05:13 source records/6 bounded reads/12 fact references.

06 researched28 source records and four official GOV.UK/FSA documents with eight facts, plus reused JOC facts. Only sources explicitly linked to claims were integrated: seven new packet source rows, three new URLs, six claims and four edits. Existing JOC source/facts/history remained byte-equivalent. Unused sources and failed alternatives remain private. The audit rejected overly broad ownership; narrowing source recipeIds to actual linked claims passed without changing the guard.

07 independently retrieved five official FDA/CDC URLs, adding eight packet source rows and seven claims in batches05/19/21/23. All 1,319 prior claims, 1,180 prior source objects and36 previous edits remain preserved, including the replaced chicken tip at its owning recipe's previousCandidateEdits. previousSupplementalResearch retains the preceding checkpoint. Raw source caches and unused oyster guidance are excluded from publication. General US and UK household guidance retains its jurisdiction and scope.

No ingredient quantity, identity, role, serving or nutrition field changed. Salmon's existing sake top-up instruction remains. At supplement07, raw shrimp and crab received evidence only. Supplement08 now coordinates the raw-crab editorial path; no structural substitution is proposed.

## Coordinated raw-crab supplement08 - 2026-10-31 JST

Batch23 adds two source rows/two claims; seven crab edits replace two prior
thawing edits. General MHLW household guidance supports measured center75C for
at least1minute and raw/cooked separation. Marine Foods is a half-thaw comparator
only; package directions govern, no product or thaw duration selected. Timers5/4
remain inspection reminders. Prior edits/claims/sources/supplement metadata are
retained; all499 other candidate records are unchanged. Quantity/servings/time,
ingredient identities/roles,nutrition and immutable V2 remain unvalidated.

Current artifact SHA256:`61729db2569a553a3551051161a6aa3cb0dc996d381050327b89108f56a473e2`;
crab fingerprint:`fc267f18206245a9036bf9156ee38a8aa7a0f306bb11618cef469cc03eba6e98`. Six safety cases remain pending; crab and raw
shrimp remain FAIL_UNRESOLVED. Actual reviewer decisions0/500; owner reports review
complete. Full verification/source promotion/runtime promotion remain zero.
[Raw seafood packet](RAW_SEAFOOD_DECISIONS.md) contains retrieval bindings and
limits. Exact checks: [14_TEST_STRATEGY.md](../14_TEST_STRATEGY.md).

## Official supplement07 evidence

| Source | Selected visible-text locators and limits |
|---|---|
|[FDA seafood](https://www.fda.gov/food/buy-store-serve-safe-food/selecting-and-serving-fresh-and-frozen-seafood-safely)|Lines111-112: thermometer/145F;114: firm, pearly, opaque shellfish flesh;126-129: thorough cooking/freezing limits;98-102: separation/clean utensils. The conflicting fish cue on line113 is excluded. 145F converts to62.777...C; candidate rounds upward to63C.|
|[CDC safer choices](https://www.cdc.gov/food-safety/foods/safer-food-choices.html)|Lines104-110: raw/undercooked sprouts riskier, steaming-hot sprouts safer;143-148: raw seafood including ceviche riskier. No acid/freezing protocol validated.|
|[FDA produce](https://www.fda.gov/food/buy-store-serve-safe-food/selecting-and-serving-produce-safely)|Lines77-79,108-113: sprout contamination and susceptible consumers. No invented sprout duration or numerical endpoint.|
|[FDA food handling](https://www.fda.gov/food/buy-store-serve-safe-food/safe-food-handling)|Lines92-94: thermometer;105-116: poultry165F;86-91: raw-contact separation/marinade. Candidate retains no-reuse choice.|
|[CDC prevention](https://www.cdc.gov/food-safety/prevention/index.html)|Lines117-129: thermometer and poultry165F. Exact frying duration, oil temperature and probe technique remain unverified.|

FDA seafood raw SHA256:909fa7955fea507afa01422389f0de85281e40ecdc53d2d4b378173d8c85bace; visible text SHA256:8613c505a4607e1c4f524d9298c968df096a2a6ea49398f5db184858ac715176. An earlier urllib404 was an abuse-detection response; default curl later returned complete HTTP200. It is not publisher-outage evidence. Canonical packets retain hashes, bounded summaries, source ownership and precise locators; raw HTML/PDF/text remains private.

## Critical safety queue

All six remain critical and pending. Full formulations, time, raw handling, quantities and consumed oil require independent review. Candidate file SHA256:61729db2569a553a3551051161a6aa3cb0dc996d381050327b89108f56a473e2.

| Recipe ID | Candidate change and unresolved decision |
|---|---|
|`imp-ac255bcc36d1324e`|Both `/steps/5/instruction` and `/steps/5/tip` now require measured63C before removal. The52-54C removal imperative is replaced; sake top-up retained. Complete formulation/time and independent safety approval remain open.|
|`imp-f729957329cd75f5`|`/steps/9/instruction` keeps heat on until sprouts steaming hot; matching tip rejects residual-heat warming; step10 removes raw sprouts. Fresh shrimp allergen warning retained. Full Pad Thai and allergen review remain open.|
|`imp-a71f6ef791b463ea`|FAIL_UNRESOLVED. Raw shrimp after five-minute lemon soak remains. FDA/CDC do not validate the acid/freezing procedure. A cooked variant changes formulation and requires a separate decision. No edit.|
|`imp-c398c169dc196c4e`|Both step7 instruction/tip now use measured63C and firm/pearly/opaque flesh; shell color or curl alone is insufficient. Prior step8 reserved-sauce/clean-utensil edit retained. Full handling/oil review pending.|
|`imp-f04b28987d7cd34a`|FAIL_UNRESOLVED. Seven coordinated raw-to-cook edits use package-governed refrigerator thawing, clean utensils and measured75C for at least1minute; timers5/4 only remind inspection. Former full-thaw and preboiled warming assertions removed. Exact species/product/package, grill method, yield/time/nutrition and independent safety acceptance remain unverified.|
|`imp-0efe9204d9dbdb3e`|Step2 instruction and revised tip now require clean-thermometer165F (approximately74C). Color/time alone is insufficient; no-reuse raw marinade caution retained. Exact pieces/probe technique, oil and full recipe review remain open.|

Candidate content fingerprints for review decisions:

| Recipe ID | Candidate content fingerprint |
|---|---|
|`imp-ac255bcc36d1324e`|`7bd474bc81520ab16a8222d396f5651d77525f2dc7355b7587bf1dd2724c035e`|
|`imp-f729957329cd75f5`|`1cb5dd00fa44a46a9ab4a0b736bc50d44db0d09cc5eceb2beb279377715bc872`|
|`imp-a71f6ef791b463ea`|`d3349cabf764cf32a9b2cea4c7e7268a987716c69f1395835fc75e7b4301bc1b`|
|`imp-c398c169dc196c4e`|`aa3284630f24d7b16efe42d9294fcf59537cb6665feb52dff5489a3a9bead492`|
|`imp-f04b28987d7cd34a`|`fc267f18206245a9036bf9156ee38a8aa7a0f306bb11618cef469cc03eba6e98`|
|`imp-0efe9204d9dbdb3e`|`26439831dcb619cd75484f0b64656f1bbe6a9b3c345e3b8f5b3408673a1fa9be`|

No reviewer identity, timestamp or approval is fabricated. Human decisions must bind these fingerprints, evidence and unresolved-risk disposition as required by19_INDEPENDENT_REVIEW_QUEUE.md.

## 2026-10-28 decision clarification

The [raw seafood decision packet](RAW_SEAFOOD_DECISIONS.md) records exact source locators, V2/candidate hashes, coupled-field contradictions and three unresolved choices per shrimp/crab case. The YouTube preboiled phrase belongs to merchandise; its product link reaches a suspension page. Written description read; video/captions unread. No canonical claim/source count or status changed. The later user reply selects PROVIDE_RAW_PRODUCT_PROTOCOL for shrimp and SELECT_RAW_PATH for crab, recorded in the decision packet at 2026-10-27T21:06:10Z. The follow-up "tự tìm kiếm đi" authorizes autonomous research: six publisher pages now supply product comparators and historical context, with hashes/locators in that packet. Alpex/Astra marketing does not validate raw-shrimp control; Marine Foods half-thaw instructions conflict with the archival crab wording; Nissui is a separate product. Exact package/process validation and both P0 safety decisions remain pending.

## Remaining formulation review

`imp-d02c9b83214f81be` has only a related shrimp-cucumber salad source without pork; it does not verify the canonical shrimp/pork salad. Broth volume, yield, mushroom/cut/shell state, coating and oil retention differ across other variants; no averaging or automatic replacement.

Source-internal conflict `imp-de5ce12092f4f0aa`:250g frozen spinach paired with7oz;7 avoirdupois oz is approximately198g. No replacement quantity chosen. Cream-based shrimp pasta, lemongrass mushroom and soft-shell-crab sources remain separate formulations. Earlier Laziji UnicodeEncodeError was retrieval failure, not publisher outage.

## Executed validation and limits

Canonical supplement07 review PASS:500V1/500V2 hashes,1,319 prior claims,1,180 prior sources,36 prior edits/history,7 incoming claims,208 metadata fields,1,190 reciprocal links,5 official caches/13 fact locators. Independent recompilation PASS500 candidates,44 exact reversals/29 recipes,1,500 provenance pointers,3,937 claim pointers,755 fact references,559 frozen inputs unchanged. Audit rebuild and --check PASS500/44/25; four inherited blockers remain.

```sh
python3 /private/tmp/takolio-v3-supp07-agent/check-proposal.py
python3 /private/tmp/takolio-v3-supplement07-review.py
PATH=/opt/homebrew/opt/node@24/bin:$PATH TMPDIR=/private/tmp node /private/tmp/takolio-v3-independent-review.mjs
PATH=/opt/homebrew/opt/node@24/bin:$PATH TMPDIR=/private/tmp node scripts/recipe-intelligence-v3-audit.mjs --check
```

Initial supplement07 review looked for chicken edit history in the edits packet; history belongs to the evidence recipe. Correcting that checker assumption passed without a canonical change. Source-cache checkers01-06 retain observation-time scope. The persistent artifact test runs the complete audit --check. Full gate result/log and retained failures: `../14_TEST_STRATEGY.md`.

Original14 research reports retain historical narratives; current prefixes contain current counts/hashes and shared audit validation. All four V2 release blockers and dependency advisories remain. No source/nutrition/ingredient certification, runtime promotion, browser/staging acceptance, human approval or production mutation.
