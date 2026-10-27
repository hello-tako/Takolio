# Current integrated research checkpoint

Current canonical packets: batch-07. 20 recipes; 46 source rows; 27 bounded content reads; 42 claims; 20 recipes with external-content claims; 1 candidate edits across 1 recipes. Human approval and full culinary verification remain zero. Source/runtime promotion remains false.

Current validation from the repository root:

```sh
PATH=/opt/homebrew/opt/node@24/bin:$PATH TMPDIR=/private/tmp node scripts/recipe-intelligence-v3-audit.mjs --check
```

This validates all 500 V1/V2 hashes, exact packet ownership, claim facts/pointers, allowed edits, candidate fingerprints and generated outputs. Raw retrieval-cache checks remain historical session evidence; current source hashes and fact locators are retained in the canonical packets. Supplement summaries: `GAP_RESEARCH_SUPPLEMENTS.md`.

Current packet hashes:

| Packet | Evidence SHA-256 | Edits SHA-256 |
|---|---|---|
| batch-07 | `6cb8ddc53e751ea1f1e41b231a741c126747ac5ddb18afc8cdffa363db163b80` | `c71b5b02f819b38598a6e5c1b0d2755b223d3387b8c41ed9846cfb583ee62fca` |

---

The original report below is historical: counts, packet hashes and session commands describe the initial pre-supplement snapshot. Its fixed-count code is retained as text. Use the current validation command above.

# Batch 07 bounded source inventory

Status: `RECIPE_V3_RESEARCH_IN_PROGRESS`. Batch: `v3-07`. Human review: `PENDING`. Full recipe verification: 0.
Source/runtime promotion: false. Production mutations: 0.

This packet records source-specific bounded facts for 20 immutable V2 recipes. It does not verify any complete external recipe. Unmentioned identities, ingredients, quantities, steps, metadata, nutrition, allergens and safety remain unverified. No source is promoted to `content_verified`.

## Actual accounting

| Measure | Result |
| --- | ---: |
| Recipes | 20 |
| Source retrieval attempts | 42 |
| Source content read with bounded facts | 25 |
| Reachable HTTP 200 but not reviewed | 6 |
| Unavailable sources | 11 |
| Claims | 35 |
| Bounded source fact claims | 25 |
| Availability claims | 10 |
| Candidate edits | 0 |
| Full recipe verifications / human approved | 0 / 0 |

HTTP 200 without a bounded fact remains `URL_REACHABLE` with `reviewState=NOT_REVIEWED`. Failed, blocked or unreadable attempts remain `SOURCE_UNAVAILABLE`; no culinary facts are inferred from them. Source-level facts stay linked to their exact `sourceId` and `reviewed-1` fact reference.

## Selected bounded findings

| Recipe | Title | Bounded fact |
| --- | --- | --- |
| `imp-53760c13ec1e452b` | Tôm xào giá đỗ | Lists 200g shrimp and 150g bean sprouts in the selected stir-fry. |
| `imp-a47ef9289f5d0136` | Cà rốt xào trứng | Lists two eggs, 4g salt, 3g cooking wine and 5ml soy sauce. |
| `imp-abdcd797955a6d6a` | Đậu phụ xào cà chua | Lists three tofu bars and 400g tomatoes. |
| `imp-97f26ff4abe44f9b` | Nem rán nhân cua thịt | Lists 250g pork, one crab and three eggs. |
| `imp-97f26ff4abe44f9b` | Nem rán nhân cua thịt | Lists two crabs, 350g pork, three eggs and 70g vermicelli. |
| `imp-03cb4c492e643034` | Tôm chiên trứng mỏng | Lists four eggs and 200g shrimp and precooks the shrimp. |
| `imp-c4a65718d5cd4b3c` | Chả giò chay nấm đậu | Lists 100g mung beans, one tofu piece and 150g sweet potato or taro for four to six servings. |
| `imp-f3c2431be267b74d` | Cá hấp dứa gừng | Lists one 1-1.2kg fish and ginger for a steamed fish variant. |

These facts support only their stated source locator and limits. Variant differences do not justify merging quantities or changing V2. Candidate edit files remain empty.

## Remaining source review

| Reachable source without bounded review | Recipe |
| --- | --- |
| `source-9b61f70b7d9863bf` | `imp-6e4c264764981b8b` |
| `source-d5f25e1925486ed6` | `imp-abdcd797955a6d6a` |
| `source-a21cf9ddd816d4c4` | `imp-f3c2431be267b74d` |
| `source-1a1077322b8fcd08` | `imp-6118e8aa010584af` |
| `source-9595cd0ffe46d7d9` | `imp-ba737c5583985a50` |
| `source-b5d252620de1bd13` | `imp-37a39eaa1edcd2e4` |

Unavailable retrieval reasons: `HTTP_403`: 2, `HTTP_404`: 3, `HTTP_502`: 1, `RETRIEVAL_FAILED_BEFORE_READABLE_CONTENT`: 5.

## Evidence and limits

- `data/recipe-intelligence/v3/research/batch-07-evidence.json` contains source metadata/hashes, bounded facts, V1 snapshot hashes and V2 file hashes.
- `data/recipe-intelligence/v3/research/batch-07-edits.json` contains zero edits.
- Raw source HTML/text and parsed payloads remain session-only under `/tmp/takolio-v3-batches05-14-research`; no full source recipe or source media is copied into the repository.
- V1 hashes use documented compact sorted Unicode JSON. They are research snapshot hashes, not the runtime catalog fingerprint.
- V2 hashes use exact source-file bytes. No V2, runtime, ingredient registry, shopping/cooking consumer, media, migration or production change is made here.

## Executed checks

- `python3 /tmp/generate_batches05_14.py`: PASS; regenerated batches 05–14 with source-specific claims and zero edits.
- `python3 /tmp/check_batches05_14.py`: PASS; ordered ledger IDs, hashes, source facts, claim references, payload-key exclusion and pending gates validated.
- `git diff --check -- data/recipe-intelligence/v3/research/batch-07-evidence.json data/recipe-intelligence/v3/research/batch-07-edits.json docs/ai/recipe-intelligence-v3/research/BATCH_07_RESEARCH.md`: PASS; exit 0, no output.
- Shared `node scripts/recipe-intelligence-v3-audit.mjs --check`: owned by the lead agent; this packet does not claim the shared integration gate.

Actual packet checks: `2026-10-26T18:35:06.613718Z` UTC. The embedded Python block was extracted and executed from the repository root: PASS. All 30 owned evidence/edit/document files also passed a direct trailing-whitespace/newline scan, including untracked content. The session-only checker additionally matched cached raw/text hashes and the compiled V1 snapshot; it is not required by the portable check.

## Runnable packet self-check

From the repository root:

```text
import hashlib, json, pathlib
root = pathlib.Path.cwd()
base = root / 'data/recipe-intelligence/v3/research'
evidence = json.loads((base / 'batch-07-evidence.json').read_text())
edits = json.loads((base / 'batch-07-edits.json').read_text())
ledger = json.loads((root / 'docs/ai/recipe-intelligence-v3/batches/batch-ledger.json').read_text())
expected = [row['recipeId'] for row in ledger['batches'][6]['recipes']]
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
print('PASS batch07: ordered IDs, V2 hashes, pending gates, zero edits')
```

Next: independently review each bounded fact, resolve all remaining fields and obtain human culinary approval before any source or runtime promotion.
