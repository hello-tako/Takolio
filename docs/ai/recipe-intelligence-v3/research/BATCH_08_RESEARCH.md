# Current integrated research checkpoint

Current canonical packets: batch-08. 20 recipes; 56 source rows; 24 bounded content reads; 46 claims; 20 recipes with external-content claims; 1 candidate edits across 1 recipes. Human approval and full culinary verification remain zero. Source/runtime promotion remains false.

Current validation from the repository root:

```sh
PATH=/opt/homebrew/opt/node@24/bin:$PATH TMPDIR=/private/tmp node scripts/recipe-intelligence-v3-audit.mjs --check
```

This validates all 500 V1/V2 hashes, exact packet ownership, claim facts/pointers, allowed edits, candidate fingerprints and generated outputs. Raw retrieval-cache checks remain historical session evidence; current source hashes and fact locators are retained in the canonical packets. Supplement summaries: `GAP_RESEARCH_SUPPLEMENTS.md`.

Current packet hashes:

| Packet | Evidence SHA-256 | Edits SHA-256 |
|---|---|---|
| batch-08 | `12e511ce0a826031a802508bb5eb0720384cadc70e6137d35e554cfee2ae18a1` | `0ab0b9060e42fa457d3e02d83479b4aa85197aabfee983a419553c44f953d005` |

---

The original report below is historical: counts, packet hashes and session commands describe the initial pre-supplement snapshot. Its fixed-count code is retained as text. Use the current validation command above.

# Batch 08 bounded source inventory

Status: `RECIPE_V3_RESEARCH_IN_PROGRESS`. Batch: `v3-08`. Human review: `PENDING`. Full recipe verification: 0.
Source/runtime promotion: false. Production mutations: 0.

This packet records source-specific bounded facts for 20 immutable V2 recipes. It does not verify any complete external recipe. Unmentioned identities, ingredients, quantities, steps, metadata, nutrition, allergens and safety remain unverified. No source is promoted to `content_verified`.

## Actual accounting

| Measure | Result |
| --- | ---: |
| Recipes | 20 |
| Source retrieval attempts | 48 |
| Source content read with bounded facts | 16 |
| Reachable HTTP 200 but not reviewed | 2 |
| Unavailable sources | 30 |
| Claims | 34 |
| Bounded source fact claims | 16 |
| Availability claims | 18 |
| Candidate edits | 0 |
| Full recipe verifications / human approved | 0 / 0 |

HTTP 200 without a bounded fact remains `URL_REACHABLE` with `reviewState=NOT_REVIEWED`. Failed, blocked or unreadable attempts remain `SOURCE_UNAVAILABLE`; no culinary facts are inferred from them. Source-level facts stay linked to their exact `sourceId` and `reviewed-1` fact reference.

## Selected bounded findings

| Recipe | Title | Bounded fact |
| --- | --- | --- |
| `imp-35164fb31de89c5f` | Gỏi gà bắp cải chanh | Lists 700g chicken breast, one-quarter cabbage, one carrot and one onion. |
| `imp-368d91563cb1879b` | Lẩu Thái tôm cá miền Tây | Lists 1kg bones, six lemongrass stalks, ten lime leaves and three teaspoons sugar; seafood quantities are unstated. |
| `imp-368d91563cb1879b` | Lẩu Thái tôm cá miền Tây | Lists 1kg bones but leaves mixed seafood and vegetables dependent on diner count. |
| `imp-c52c790faf9281da` | Lẩu nấm chay đậu phụ | Describes corn and sugarcane broth simmering about 30 minutes before remaining ingredients. |
| `imp-e9678cfa1bc90074` | Tôm xào trứng cà chua | Two-serving card lists 12 medium shrimp, six eggs, two medium tomatoes and 2.5 tablespoons ghee. |
| `imp-387c41fb3a0c2297` | Gà Kung Pao Tứ Xuyên | Four-serving Kung Pao card lists one pound chicken and a marinade with one tablespoon soy sauce, two teaspoons wine and one tablespoon starch; marinade rests 10-30 minutes. |
| `imp-f5abd36e99d48d94` | Đậu phụ Mapo Tứ Xuyên | Uses four ounces ground pork, one tofu block, one tablespoon cooking oil, three tablespoons doubanjiang and one cup stock or water. |
| `imp-2d508cd359edb61c` | Đậu phụ hấp tôm gừng | Twelve-piece recipe lists half a pound peeled shrimp, one package medium-firm tofu and one egg white. |

These facts support only their stated source locator and limits. Variant differences do not justify merging quantities or changing V2. Candidate edit files remain empty.

## Remaining source review

| Reachable source without bounded review | Recipe |
| --- | --- |
| `source-39b0ba4bca6f1eb3` | `imp-b23ab24915e52866` |
| `source-17e2508c27a32021` | `imp-6d3fa354c64cf8b1` |

Unavailable retrieval reasons: `HTTP_200_BUT_NO_RELIABLE_READABLE_RECIPE_TEXT`: 4, `HTTP_308`: 1, `HTTP_403`: 20, `HTTP_404`: 2, `HTTP_429`: 1, `RETRIEVAL_FAILED_BEFORE_READABLE_CONTENT`: 2.

## Evidence and limits

- `data/recipe-intelligence/v3/research/batch-08-evidence.json` contains source metadata/hashes, bounded facts, V1 snapshot hashes and V2 file hashes.
- `data/recipe-intelligence/v3/research/batch-08-edits.json` contains zero edits.
- Raw source HTML/text and parsed payloads remain session-only under `/tmp/takolio-v3-batches05-14-research`; no full source recipe or source media is copied into the repository.
- V1 hashes use documented compact sorted Unicode JSON. They are research snapshot hashes, not the runtime catalog fingerprint.
- V2 hashes use exact source-file bytes. No V2, runtime, ingredient registry, shopping/cooking consumer, media, migration or production change is made here.

## Executed checks

- `python3 /tmp/generate_batches05_14.py`: PASS; regenerated batches 05–14 with source-specific claims and zero edits.
- `python3 /tmp/check_batches05_14.py`: PASS; ordered ledger IDs, hashes, source facts, claim references, payload-key exclusion and pending gates validated.
- `git diff --check -- data/recipe-intelligence/v3/research/batch-08-evidence.json data/recipe-intelligence/v3/research/batch-08-edits.json docs/ai/recipe-intelligence-v3/research/BATCH_08_RESEARCH.md`: PASS; exit 0, no output.
- Shared `node scripts/recipe-intelligence-v3-audit.mjs --check`: owned by the lead agent; this packet does not claim the shared integration gate.

Actual packet checks: `2026-10-26T18:35:06.613718Z` UTC. The embedded Python block was extracted and executed from the repository root: PASS. All 30 owned evidence/edit/document files also passed a direct trailing-whitespace/newline scan, including untracked content. The session-only checker additionally matched cached raw/text hashes and the compiled V1 snapshot; it is not required by the portable check.

## Runnable packet self-check

From the repository root:

```text
import hashlib, json, pathlib
root = pathlib.Path.cwd()
base = root / 'data/recipe-intelligence/v3/research'
evidence = json.loads((base / 'batch-08-evidence.json').read_text())
edits = json.loads((base / 'batch-08-edits.json').read_text())
ledger = json.loads((root / 'docs/ai/recipe-intelligence-v3/batches/batch-ledger.json').read_text())
expected = [row['recipeId'] for row in ledger['batches'][7]['recipes']]
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
print('PASS batch08: ordered IDs, V2 hashes, pending gates, zero edits')
```

Next: independently review each bounded fact, resolve all remaining fields and obtain human culinary approval before any source or runtime promotion.
