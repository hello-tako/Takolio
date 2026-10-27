# Current integrated research checkpoint

Current canonical packets: batch-10. 20 recipes; 45 source rows; 30 bounded content reads; 45 claims; 20 recipes with external-content claims; 2 candidate edits across 2 recipes. Human approval and full culinary verification remain zero. Source/runtime promotion remains false.

Current validation from the repository root:

```sh
PATH=/opt/homebrew/opt/node@24/bin:$PATH TMPDIR=/private/tmp node scripts/recipe-intelligence-v3-audit.mjs --check
```

This validates all 500 V1/V2 hashes, exact packet ownership, claim facts/pointers, allowed edits, candidate fingerprints and generated outputs. Raw retrieval-cache checks remain historical session evidence; current source hashes and fact locators are retained in the canonical packets. Supplement summaries: `GAP_RESEARCH_SUPPLEMENTS.md`.

Current packet hashes:

| Packet | Evidence SHA-256 | Edits SHA-256 |
|---|---|---|
| batch-10 | `13dbfef47cfbd3d512e18b3e2a556401fa84c3d6eb88c6791c2cd07f97290968` | `4417944dc049d2603f4f8f3f3e447749378c2cc996a95ffbdb90de59da906661` |

---

The original report below is historical: counts, packet hashes and session commands describe the initial pre-supplement snapshot. Its fixed-count code is retained as text. Use the current validation command above.

# Batch 10 bounded source inventory

Status: `RECIPE_V3_RESEARCH_IN_PROGRESS`. Batch: `v3-10`. Human review: `PENDING`. Full recipe verification: 0.
Source/runtime promotion: false. Production mutations: 0.

This packet records source-specific bounded facts for 20 immutable V2 recipes. It does not verify any complete external recipe. Unmentioned identities, ingredients, quantities, steps, metadata, nutrition, allergens and safety remain unverified. No source is promoted to `content_verified`.

## Actual accounting

| Measure | Result |
| --- | ---: |
| Recipes | 20 |
| Source retrieval attempts | 45 |
| Source content read with bounded facts | 28 |
| Reachable HTTP 200 but not reviewed | 4 |
| Unavailable sources | 13 |
| Claims | 40 |
| Bounded source fact claims | 28 |
| Availability claims | 12 |
| Candidate edits | 0 |
| Full recipe verifications / human approved | 0 / 0 |

HTTP 200 without a bounded fact remains `URL_REACHABLE` with `reviewState=NOT_REVIEWED`. Failed, blocked or unreadable attempts remain `SOURCE_UNAVAILABLE`; no culinary facts are inferred from them. Source-level facts stay linked to their exact `sourceId` and `reviewed-1` fact reference.

## Selected bounded findings

| Recipe | Title | Bounded fact |
| --- | --- | --- |
| `imp-52b5963c6cecfb96` | Bò nướng bulgogi ngọt | Four-serving bulgogi card starts with two pounds sliced beef, one small onion and an optional small carrot. |
| `imp-44b1338a7a49098d` | Canh kim chi đậu phụ Hàn | Two-serving kimchi stew lists two cups kimchi, four ounces pork and six ounces tofu. |
| `imp-a24a701c584d3ef3` | Cơm trộn bibimbap Hàn | Four-serving bibimbap lists three cups short-grain rice and eight ounces each beef and sprouts. |
| `imp-51b6559bf09bc980` | Canh tôm nấu bí đỏ | Selected soup lists 500g pumpkin and 300g fresh shrimp, then peels shrimp and adds about one litre water. |
| `imp-81a203668e5e4c1a` | Canh trứng nấm kim châm | Lists two eggs, two tomatoes and 100g enoki mushrooms. |
| `imp-81a203668e5e4c1a` | Canh trứng nấm kim châm | Uses a 200g enoki package, two to three tomatoes and two eggs. |
| `imp-6c20dba60d77bdfd` | Canh sườn su su non | Fifth variant names chayote, ribs, potato, carrot and winter melon, with approximately 1.5 hours rib simmering before vegetables. |
| `imp-734cc9acf8620c69` | Canh đậu phụ cà chua trứng | Lists two eggs, one soft-tofu piece, two tomatoes and two shallots; method cuts tofu into cubes. |

These facts support only their stated source locator and limits. Variant differences do not justify merging quantities or changing V2. Candidate edit files remain empty.

## Remaining source review

| Reachable source without bounded review | Recipe |
| --- | --- |
| `source-0797351f5456ffa2` | `imp-734cc9acf8620c69` |
| `source-7851d94d57cd2370` | `imp-695f59248dbf4895` |
| `source-074f9541e7b536b2` | `imp-500644420438efd3` |
| `source-7a8f4dddc1cc4161` | `imp-403a1693ea9b3cf8` |

Unavailable retrieval reasons: `HTTP_403`: 8, `HTTP_404`: 3, `RETRIEVAL_FAILED_BEFORE_READABLE_CONTENT`: 2.

## Evidence and limits

- `data/recipe-intelligence/v3/research/batch-10-evidence.json` contains source metadata/hashes, bounded facts, V1 snapshot hashes and V2 file hashes.
- `data/recipe-intelligence/v3/research/batch-10-edits.json` contains zero edits.
- Raw source HTML/text and parsed payloads remain session-only under `/tmp/takolio-v3-batches05-14-research`; no full source recipe or source media is copied into the repository.
- V1 hashes use documented compact sorted Unicode JSON. They are research snapshot hashes, not the runtime catalog fingerprint.
- V2 hashes use exact source-file bytes. No V2, runtime, ingredient registry, shopping/cooking consumer, media, migration or production change is made here.

## Executed checks

- `python3 /tmp/generate_batches05_14.py`: PASS; regenerated batches 05–14 with source-specific claims and zero edits.
- `python3 /tmp/check_batches05_14.py`: PASS; ordered ledger IDs, hashes, source facts, claim references, payload-key exclusion and pending gates validated.
- `git diff --check -- data/recipe-intelligence/v3/research/batch-10-evidence.json data/recipe-intelligence/v3/research/batch-10-edits.json docs/ai/recipe-intelligence-v3/research/BATCH_10_RESEARCH.md`: PASS; exit 0, no output.
- Shared `node scripts/recipe-intelligence-v3-audit.mjs --check`: owned by the lead agent; this packet does not claim the shared integration gate.

Actual packet checks: `2026-10-26T18:35:06.613718Z` UTC. The embedded Python block was extracted and executed from the repository root: PASS. All 30 owned evidence/edit/document files also passed a direct trailing-whitespace/newline scan, including untracked content. The session-only checker additionally matched cached raw/text hashes and the compiled V1 snapshot; it is not required by the portable check.

## Runnable packet self-check

From the repository root:

```text
import hashlib, json, pathlib
root = pathlib.Path.cwd()
base = root / 'data/recipe-intelligence/v3/research'
evidence = json.loads((base / 'batch-10-evidence.json').read_text())
edits = json.loads((base / 'batch-10-edits.json').read_text())
ledger = json.loads((root / 'docs/ai/recipe-intelligence-v3/batches/batch-ledger.json').read_text())
expected = [row['recipeId'] for row in ledger['batches'][9]['recipes']]
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
print('PASS batch10: ordered IDs, V2 hashes, pending gates, zero edits')
```

Next: independently review each bounded fact, resolve all remaining fields and obtain human culinary approval before any source or runtime promotion.
