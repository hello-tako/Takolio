# Current integrated research checkpoint

Current canonical packets: batch-05. 20 recipes; 46 source rows; 25 bounded content reads; 47 claims; 20 recipes with external-content claims; 4 candidate edits across 3 recipes. Human approval and full culinary verification remain zero. Source/runtime promotion remains false.

Current validation from the repository root:

```sh
PATH=/opt/homebrew/opt/node@24/bin:$PATH TMPDIR=/private/tmp node scripts/recipe-intelligence-v3-audit.mjs --check
```

This validates all 500 V1/V2 hashes, exact packet ownership, claim facts/pointers, allowed edits, candidate fingerprints and generated outputs. Raw retrieval-cache checks remain historical session evidence; current source hashes and fact locators are retained in the canonical packets. Supplement summaries: `GAP_RESEARCH_SUPPLEMENTS.md`.

Current packet hashes:

| Packet | Evidence SHA-256 | Edits SHA-256 |
|---|---|---|
| batch-05 | `8bf201e7cb1a42a1a7638dbec076a842d2fd02d88216fc8b7be70842f1bcf3df` | `5b2d9e8d0efb25892b375cb415ee0f7d44236cde58af646824edef93c06f0afd` |

---

The original report below is historical: counts, packet hashes and session commands describe the initial pre-supplement snapshot. Its fixed-count code is retained as text. Use the current validation command above.

# Batch 05 bounded source inventory

Status: `RECIPE_V3_RESEARCH_IN_PROGRESS`. Batch: `v3-05`. Human review: `PENDING`. Full recipe verification: 0.
Source/runtime promotion: false. Production mutations: 0.

This packet records source-specific bounded facts for 20 immutable V2 recipes. It does not verify any complete external recipe. Unmentioned identities, ingredients, quantities, steps, metadata, nutrition, allergens and safety remain unverified. No source is promoted to `content_verified`.

## Actual accounting

| Measure | Result |
| --- | ---: |
| Recipes | 20 |
| Source retrieval attempts | 42 |
| Source content read with bounded facts | 17 |
| Reachable HTTP 200 but not reviewed | 1 |
| Unavailable sources | 24 |
| Claims | 34 |
| Bounded source fact claims | 17 |
| Availability claims | 17 |
| Candidate edits | 0 |
| Full recipe verifications / human approved | 0 / 0 |

HTTP 200 without a bounded fact remains `URL_REACHABLE` with `reviewState=NOT_REVIEWED`. Failed, blocked or unreadable attempts remain `SOURCE_UNAVAILABLE`; no culinary facts are inferred from them. Source-level facts stay linked to their exact `sourceId` and `reviewed-1` fact reference.

## Selected bounded findings

| Recipe | Title | Bounded fact |
| --- | --- | --- |
| `imp-9ae951bec7fbf21b` | Hủ tiếu xào tôm giá hẹ kiểu Sài Gòn | Lists 300g dry noodles, 300g shrimp and 300g squid in a mixed-seafood formulation. |
| `imp-5ab5c1053b7371f0` | Đậu phụ chiên sả ớt chay đậm đà | Uses three tofu pieces, two lemongrass stalks, one garlic bulb and two chillies; fries tofu before coating in aromatic sauce. |
| `imp-5ab5c1053b7371f0` | Đậu phụ chiên sả ớt chay đậm đà | Four-serving card lists four tofu blocks and four lemongrass stalks, with two teaspoons soy sauce. |
| `imp-67054d03e5a5b011` | Cháo trứng gà hành lá gừng ấm bụng | Củ nén porridge section lists half a cup rice, 10-15 củ nén, one to two ginger slices and an optional egg or 100g minced meat. |
| `imp-e375595daced53af` | Lẩu bò nhúng dứa chua thanh | Four-serving card uses 1kg beef shank, 500g bones, 500ml coconut water and 150ml rice vinegar. |
| `imp-6d7fc503ade5df6e` | Thịt ba chỉ xào sả ớt kiểu miền Trung | Lists 300-400g pork belly with two to three lemongrass stalks and four to five chillies; briefly renders pork before aromatic frying. |
| `imp-6d7fc503ade5df6e` | Thịt ba chỉ xào sả ớt kiểu miền Trung | Lists 250g pork belly, seven lemongrass stalks, four chillies and three garlic cloves. |
| `imp-364497296cfcf033` | Mực nhồi thịt hấp gừng hành | Steamed variant lists 500g squid, 250g minced pork and 20g ginger; divides ginger between filling and steaming and gives 15-20 minutes steaming. |

These facts support only their stated source locator and limits. Variant differences do not justify merging quantities or changing V2. Candidate edit files remain empty.

## Remaining source review

| Reachable source without bounded review | Recipe |
| --- | --- |
| `source-5941e2956d6492f7` | `imp-9ae951bec7fbf21b` |

Unavailable retrieval reasons: `HTTP_403`: 10, `HTTP_404`: 1, `RETRIEVAL_FAILED_BEFORE_READABLE_CONTENT`: 13.

## Evidence and limits

- `data/recipe-intelligence/v3/research/batch-05-evidence.json` contains source metadata/hashes, bounded facts, V1 snapshot hashes and V2 file hashes.
- `data/recipe-intelligence/v3/research/batch-05-edits.json` contains zero edits.
- Raw source HTML/text and parsed payloads remain session-only under `/tmp/takolio-v3-batches05-14-research`; no full source recipe or source media is copied into the repository.
- V1 hashes use documented compact sorted Unicode JSON. They are research snapshot hashes, not the runtime catalog fingerprint.
- V2 hashes use exact source-file bytes. No V2, runtime, ingredient registry, shopping/cooking consumer, media, migration or production change is made here.

## Executed checks

- `python3 /tmp/generate_batches05_14.py`: PASS; regenerated batches 05–14 with source-specific claims and zero edits.
- `python3 /tmp/check_batches05_14.py`: PASS; ordered ledger IDs, hashes, source facts, claim references, payload-key exclusion and pending gates validated.
- `git diff --check -- data/recipe-intelligence/v3/research/batch-05-evidence.json data/recipe-intelligence/v3/research/batch-05-edits.json docs/ai/recipe-intelligence-v3/research/BATCH_05_RESEARCH.md`: PASS; exit 0, no output.
- Shared `node scripts/recipe-intelligence-v3-audit.mjs --check`: owned by the lead agent; this packet does not claim the shared integration gate.

Actual packet checks: `2026-10-26T18:35:06.613718Z` UTC. The embedded Python block was extracted and executed from the repository root: PASS. All 30 owned evidence/edit/document files also passed a direct trailing-whitespace/newline scan, including untracked content. The session-only checker additionally matched cached raw/text hashes and the compiled V1 snapshot; it is not required by the portable check.

## Runnable packet self-check

From the repository root:

```text
import hashlib, json, pathlib
root = pathlib.Path.cwd()
base = root / 'data/recipe-intelligence/v3/research'
evidence = json.loads((base / 'batch-05-evidence.json').read_text())
edits = json.loads((base / 'batch-05-edits.json').read_text())
ledger = json.loads((root / 'docs/ai/recipe-intelligence-v3/batches/batch-ledger.json').read_text())
expected = [row['recipeId'] for row in ledger['batches'][4]['recipes']]
assert [row['recipeId'] for row in evidence['recipes']] == expected
assert len(expected) == len(set(expected)) == 20
assert evidence['humanReview'] == 'PENDING' and evidence['sourcePromotionAllowed'] is False and evidence['runtimePromotionAllowed'] is False
assert edits == {'schemaVersion': 1, 'edits': []}
for recipe in evidence['recipes']:
    raw = (root / recipe['v2']['sourcePath']).read_bytes()
    assert hashlib.sha256(raw).hexdigest() == recipe['v2']['fileSha256']
    assert recipe['humanReview'] == 'PENDING' and recipe['fullRecipeVerification'] == 'NOT_COMPLETE'
for source in evidence['sources']:
    assert source['sourceId'] == 'source-' + hashlib.sha256(source['url'].encode()).hexdigest()[:16]
print('PASS batch05: ordered IDs, V2 hashes, pending gates, zero edits')
```

Next: independently review each bounded fact, resolve all remaining fields and obtain human culinary approval before any source or runtime promotion.
