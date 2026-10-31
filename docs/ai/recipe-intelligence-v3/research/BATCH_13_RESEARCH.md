# Current integrated research checkpoint

Current canonical packets: batch-13. 20 recipes; 44 source rows; 27 bounded content reads; 57 claims; 20 recipes with external-content claims; 4 candidate edits across 4 recipes. Human approval and full culinary verification remain zero. Source/runtime promotion remains false.

Current validation from the repository root:

```sh
PATH=/opt/homebrew/opt/node@24/bin:$PATH TMPDIR=/private/tmp node scripts/recipe-intelligence-v3-audit.mjs --check
```

This validates all 500 V1/V2 hashes, exact packet ownership, claim facts/pointers, allowed edits, candidate fingerprints and generated outputs. Raw retrieval-cache checks remain historical session evidence; current source hashes and fact locators are retained in the canonical packets. Supplement summaries: `GAP_RESEARCH_SUPPLEMENTS.md`.

Current packet hashes:

| Packet | Evidence SHA-256 | Edits SHA-256 |
|---|---|---|
| batch-13 | `28753f8dba9c141088582f1a8ff2ce1388f554e7b8babf8d310e69c63582c39c` | `7e20d9158b4b84d089f2f58a6444166687ba2f3d1751fb9e725d052def2e9db3` |

---

The original report below is historical: counts, packet hashes and session commands describe the initial pre-supplement snapshot. Its fixed-count code is retained as text. Use the current validation command above.

# Batch 13 bounded source inventory

Status: `RECIPE_V3_RESEARCH_IN_PROGRESS`. Batch: `v3-13`. Human review: `PENDING`. Full recipe verification: 0.
Source/runtime promotion: false. Production mutations: 0.

This packet records source-specific bounded facts for 20 immutable V2 recipes. It does not verify any complete external recipe. Unmentioned identities, ingredients, quantities, steps, metadata, nutrition, allergens and safety remain unverified. No source is promoted to `content_verified`.

## Actual accounting

| Measure | Result |
| --- | ---: |
| Recipes | 20 |
| Source retrieval attempts | 43 |
| Source content read with bounded facts | 6 |
| Reachable HTTP 200 but not reviewed | 0 |
| Unavailable sources | 37 |
| Claims | 25 |
| Bounded source fact claims | 6 |
| Availability claims | 19 |
| Candidate edits | 0 |
| Full recipe verifications / human approved | 0 / 0 |

HTTP 200 without a bounded fact remains `URL_REACHABLE` with `reviewState=NOT_REVIEWED`. Failed, blocked or unreadable attempts remain `SOURCE_UNAVAILABLE`; no culinary facts are inferred from them. Source-level facts stay linked to their exact `sourceId` and `reviewed-1` fact reference.

## Selected bounded findings

| Recipe | Title | Bounded fact |
| --- | --- | --- |
| `imp-96d226a7f4d12156` | Gà chiên gangjeong cay | Four-serving dakgangjeong lists 1.1 pounds boneless thigh or breast and one-third cup cornstarch or potato starch. |
| `imp-ba1871f088d9a522` | Lẩu bulgogi nấm | Four-serving bulgogi hotpot uses one pound sliced beef and a marinade with three tablespoons soy and one tablespoon each sugar and honey. |
| `imp-ba1871f088d9a522` | Lẩu bulgogi nấm | Three-serving hotpot uses one pound beef, half a cup bottled bibigo BBQ sauce, eight ounces mixed mushrooms and five cups water. |
| `imp-24fc3ac5cd3ff445` | Cơm chiên kim chi Hàn | Four-serving kimchi rice lists one cup kimchi labelled 150g and a bacon entry labelled six ounces and 200g. |
| `imp-46962ad0d6f6e63b` | Gà xào húng quế pad krapao | Two-serving holy-basil chicken uses one cup minced chicken, three Thai chillies and one cup packed holy-basil leaves. |
| `imp-e28e249efceacac7` | Larb heo chua cay | Two-serving larb uses 250g ground pork, 30ml fish sauce and 30ml lime juice, with two tablespoons raw rice for toasting. |

These facts support only their stated source locator and limits. Variant differences do not justify merging quantities or changing V2. Candidate edit files remain empty.

## Remaining source review

| Reachable source without bounded review | Recipe |
| --- | --- |
| None | All reachable sources have a bounded fact; complete recipe review remains pending. |

Unavailable retrieval reasons: `HTTP_403`: 3, `RETRIEVAL_FAILED_BEFORE_READABLE_CONTENT`: 34.

## Evidence and limits

- `data/recipe-intelligence/v3/research/batch-13-evidence.json` contains source metadata/hashes, bounded facts, V1 snapshot hashes and V2 file hashes.
- `data/recipe-intelligence/v3/research/batch-13-edits.json` contains zero edits.
- Raw source HTML/text and parsed payloads remain session-only under `/tmp/takolio-v3-batches05-14-research`; no full source recipe or source media is copied into the repository.
- V1 hashes use documented compact sorted Unicode JSON. They are research snapshot hashes, not the runtime catalog fingerprint.
- V2 hashes use exact source-file bytes. No V2, runtime, ingredient registry, shopping/cooking consumer, media, migration or production change is made here.

## Executed checks

- `python3 /tmp/generate_batches05_14.py`: PASS; regenerated batches 05–14 with source-specific claims and zero edits.
- `python3 /tmp/check_batches05_14.py`: PASS; ordered ledger IDs, hashes, source facts, claim references, payload-key exclusion and pending gates validated.
- `git diff --check -- data/recipe-intelligence/v3/research/batch-13-evidence.json data/recipe-intelligence/v3/research/batch-13-edits.json docs/ai/recipe-intelligence-v3/research/BATCH_13_RESEARCH.md`: PASS; exit 0, no output.
- Shared `node scripts/recipe-intelligence-v3-audit.mjs --check`: owned by the lead agent; this packet does not claim the shared integration gate.

Actual packet checks: `2026-10-26T18:35:06.613718Z` UTC. The embedded Python block was extracted and executed from the repository root: PASS. All 30 owned evidence/edit/document files also passed a direct trailing-whitespace/newline scan, including untracked content. The session-only checker additionally matched cached raw/text hashes and the compiled V1 snapshot; it is not required by the portable check.

## Runnable packet self-check

From the repository root:

```text
import hashlib, json, pathlib
root = pathlib.Path.cwd()
base = root / 'data/recipe-intelligence/v3/research'
evidence = json.loads((base / 'batch-13-evidence.json').read_text())
edits = json.loads((base / 'batch-13-edits.json').read_text())
ledger = json.loads((root / 'docs/ai/recipe-intelligence-v3/batches/batch-ledger.json').read_text())
expected = [row['recipeId'] for row in ledger['batches'][12]['recipes']]
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
print('PASS batch13: ordered IDs, V2 hashes, pending gates, zero edits')
```

Next: independently review each bounded fact, resolve all remaining fields and obtain human culinary approval before any source or runtime promotion.
