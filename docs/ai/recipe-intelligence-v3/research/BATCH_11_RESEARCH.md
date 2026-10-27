# Current integrated research checkpoint

Current canonical packets: batch-11. 20 recipes; 49 source rows; 33 bounded content reads; 47 claims; 20 recipes with external-content claims; 0 candidate edits across 0 recipes. Human approval and full culinary verification remain zero. Source/runtime promotion remains false.

Current validation from the repository root:

```sh
PATH=/opt/homebrew/opt/node@24/bin:$PATH TMPDIR=/private/tmp node scripts/recipe-intelligence-v3-audit.mjs --check
```

This validates all 500 V1/V2 hashes, exact packet ownership, claim facts/pointers, allowed edits, candidate fingerprints and generated outputs. Raw retrieval-cache checks remain historical session evidence; current source hashes and fact locators are retained in the canonical packets. Supplement summaries: `GAP_RESEARCH_SUPPLEMENTS.md`.

Current packet hashes:

| Packet | Evidence SHA-256 | Edits SHA-256 |
|---|---|---|
| batch-11 | `ed13e43438339f4c31aa312f32af1f1de730d2bc3a7f29e2aa9814e28325f8e1` | `bcc3b7038d7f5a0795a33a8bead0419a91581d699b33e29a33759b60495a2f45` |

---

The original report below is historical: counts, packet hashes and session commands describe the initial pre-supplement snapshot. Its fixed-count code is retained as text. Use the current validation command above.

# Batch 11 bounded source inventory

Status: `RECIPE_V3_RESEARCH_IN_PROGRESS`. Batch: `v3-11`. Human review: `PENDING`. Full recipe verification: 0.
Source/runtime promotion: false. Production mutations: 0.

This packet records source-specific bounded facts for 20 immutable V2 recipes. It does not verify any complete external recipe. Unmentioned identities, ingredients, quantities, steps, metadata, nutrition, allergens and safety remain unverified. No source is promoted to `content_verified`.

## Actual accounting

| Measure | Result |
| --- | ---: |
| Recipes | 20 |
| Source retrieval attempts | 44 |
| Source content read with bounded facts | 30 |
| Reachable HTTP 200 but not reviewed | 2 |
| Unavailable sources | 12 |
| Claims | 41 |
| Bounded source fact claims | 31 |
| Availability claims | 10 |
| Candidate edits | 0 |
| Full recipe verifications / human approved | 0 / 0 |

HTTP 200 without a bounded fact remains `URL_REACHABLE` with `reviewState=NOT_REVIEWED`. Failed, blocked or unreadable attempts remain `SOURCE_UNAVAILABLE`; no culinary facts are inferred from them. Source-level facts stay linked to their exact `sourceId` and `reviewed-1` fact reference.

## Selected bounded findings

| Recipe | Title | Bounded fact |
| --- | --- | --- |
| `imp-c039dac37b31acdb` | Mì Quảng gà ta | Five-to-six-serving chicken Quang noodles use one approximately 1kg chicken and one litre chicken stock. |
| `imp-c039dac37b31acdb` | Mì Quảng gà ta | Lists 500g chicken, 400g noodles, one tablespoon cu nen and two shallots. |
| `imp-875e99916a13d031` | Phở chay nấm đậu | Uses one apple, one pear, 100g dried tofu/beef analogue and 400g fried tofu. |
| `imp-875e99916a13d031` | Phở chay nấm đậu | Vegetarian pho section names vegetables and spices qualitatively without fixed masses in the reviewed section. |
| `imp-389f525ea854b373` | Canh chua chay dứa đậu | Selected ingredient entries list one to two tomatoes and 200g okra. |
| `imp-389f525ea854b373` | Canh chua chay dứa đậu | Uses two to three tofu pieces, one-quarter slice pineapple, two tomatoes and 200g okra. |
| `imp-8301ed8c884fb619` | Cải bắp xào nấm chay | Selected cabbage stir-fry uses dried shiitake and calls for about two hours soaking. |
| `imp-327ffa644fbe1a7d` | Cháo tôm nấm nóng | Four-to-five-serving porridge uses a 180ml measuring cup for one cup rice, one cup shrimp and one-quarter cup dried scallops, plus 120g king oyster. |

These facts support only their stated source locator and limits. Variant differences do not justify merging quantities or changing V2. Candidate edit files remain empty.

## Remaining source review

| Reachable source without bounded review | Recipe |
| --- | --- |
| `source-f0704847fbd87c70` | `imp-24e75cbb2ba569f4` |
| `source-0b600efc685db688` | `imp-7fa36d5f0187a86e` |

Unavailable retrieval reasons: `HTTP_200_BUT_NO_RELIABLE_READABLE_RECIPE_TEXT`: 3, `HTTP_403`: 7, `RETRIEVAL_FAILED_BEFORE_READABLE_CONTENT`: 2.

## Evidence and limits

- `data/recipe-intelligence/v3/research/batch-11-evidence.json` contains source metadata/hashes, bounded facts, V1 snapshot hashes and V2 file hashes.
- `data/recipe-intelligence/v3/research/batch-11-edits.json` contains zero edits.
- Raw source HTML/text and parsed payloads remain session-only under `/tmp/takolio-v3-batches05-14-research`; no full source recipe or source media is copied into the repository.
- V1 hashes use documented compact sorted Unicode JSON. They are research snapshot hashes, not the runtime catalog fingerprint.
- V2 hashes use exact source-file bytes. No V2, runtime, ingredient registry, shopping/cooking consumer, media, migration or production change is made here.

## Executed checks

- `python3 /tmp/generate_batches05_14.py`: PASS; regenerated batches 05–14 with source-specific claims and zero edits.
- `python3 /tmp/check_batches05_14.py`: PASS; ordered ledger IDs, hashes, source facts, claim references, payload-key exclusion and pending gates validated.
- `git diff --check -- data/recipe-intelligence/v3/research/batch-11-evidence.json data/recipe-intelligence/v3/research/batch-11-edits.json docs/ai/recipe-intelligence-v3/research/BATCH_11_RESEARCH.md`: PASS; exit 0, no output.
- Shared `node scripts/recipe-intelligence-v3-audit.mjs --check`: owned by the lead agent; this packet does not claim the shared integration gate.

Actual packet checks: `2026-10-26T18:35:06.613718Z` UTC. The embedded Python block was extracted and executed from the repository root: PASS. All 30 owned evidence/edit/document files also passed a direct trailing-whitespace/newline scan, including untracked content. The session-only checker additionally matched cached raw/text hashes and the compiled V1 snapshot; it is not required by the portable check.

## Runnable packet self-check

From the repository root:

```text
import hashlib, json, pathlib
root = pathlib.Path.cwd()
base = root / 'data/recipe-intelligence/v3/research'
evidence = json.loads((base / 'batch-11-evidence.json').read_text())
edits = json.loads((base / 'batch-11-edits.json').read_text())
ledger = json.loads((root / 'docs/ai/recipe-intelligence-v3/batches/batch-ledger.json').read_text())
expected = [row['recipeId'] for row in ledger['batches'][10]['recipes']]
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
print('PASS batch11: ordered IDs, V2 hashes, pending gates, zero edits')
```

Next: independently review each bounded fact, resolve all remaining fields and obtain human culinary approval before any source or runtime promotion.
