# Current integrated research checkpoint

Current canonical packets: batch-06. 20 recipes; 44 source rows; 30 bounded content reads; 47 claims; 20 recipes with external-content claims; 4 candidate edits across 2 recipes. Human approval and full culinary verification remain zero. Source/runtime promotion remains false.

Current validation from the repository root:

```sh
PATH=/opt/homebrew/opt/node@24/bin:$PATH TMPDIR=/private/tmp node scripts/recipe-intelligence-v3-audit.mjs --check
```

This validates all 500 V1/V2 hashes, exact packet ownership, claim facts/pointers, allowed edits, candidate fingerprints and generated outputs. Raw retrieval-cache checks remain historical session evidence; current source hashes and fact locators are retained in the canonical packets. Supplement summaries: `GAP_RESEARCH_SUPPLEMENTS.md`.

Current packet hashes:

| Packet | Evidence SHA-256 | Edits SHA-256 |
|---|---|---|
| batch-06 | `f16aa07000589ef845cefe2662ea90986c2d6bda31e9ca40949fb9b54916d3fb` | `8b7e2a66dc4b35dbdd7bdcfb293a7a2789afc6b5f25363c4c66c39933457e348` |

---

The original report below is historical: counts, packet hashes and session commands describe the initial pre-supplement snapshot. Its fixed-count code is retained as text. Use the current validation command above.

# Batch 06 bounded source inventory

Status: `RECIPE_V3_RESEARCH_IN_PROGRESS`. Batch: `v3-06`. Human review: `PENDING`. Full recipe verification: 0.
Source/runtime promotion: false. Production mutations: 0.

This packet records source-specific bounded facts for 20 immutable V2 recipes. It does not verify any complete external recipe. Unmentioned identities, ingredients, quantities, steps, metadata, nutrition, allergens and safety remain unverified. No source is promoted to `content_verified`.

## Actual accounting

| Measure | Result |
| --- | ---: |
| Recipes | 20 |
| Source retrieval attempts | 44 |
| Source content read with bounded facts | 25 |
| Reachable HTTP 200 but not reviewed | 3 |
| Unavailable sources | 16 |
| Claims | 38 |
| Bounded source fact claims | 25 |
| Availability claims | 13 |
| Candidate edits | 0 |
| Full recipe verifications / human approved | 0 / 0 |

HTTP 200 without a bounded fact remains `URL_REACHABLE` with `reviewState=NOT_REVIEWED`. Failed, blocked or unreadable attempts remain `SOURCE_UNAVAILABLE`; no culinary facts are inferred from them. Source-level facts stay linked to their exact `sourceId` and `reviewed-1` fact reference.

## Selected bounded findings

| Recipe | Title | Bounded fact |
| --- | --- | --- |
| `imp-b01569fd0df22f66` | Mì Ý Aglio e Olio tỏi ớt dầu olive | Four-serving aglio e olio lists 11.3 ounces spaghetti, three garlic cloves and five tablespoons olive oil. |
| `imp-9d575ec5c01896f0` | Mì Ý sốt kem cá hồi rau bina | Two-serving card uses 150g penne, 60g smoked salmon, 250g passata and 100ml cream. |
| `imp-810c132a4d2cd4e0` | Canh chua tôm dứa Nam Bộ | Lists 400g fresh shrimp, two tomatoes, half a pineapple and four to five okra; separates shrimp heads for stock preparation. |
| `imp-59015074541ba061` | Canh khổ qua nhồi tôm | Lists 1kg bitter melon, 500g ground pork and 400g featherback fish, minced shrimp or pork paste as alternatives. |
| `imp-9c678f92a5cb0812` | Canh bí đao tôm tươi | Lists 300g winter melon and either 200g fresh shrimp or 100g peeled shrimp, with two shallots. |
| `imp-80ce5736becc08da` | Canh cà chua trứng nhà lá | Uses three eggs and two tomatoes; thickener is one spoon sweet-potato starch labelled 15g mixed with two spoons water. |
| `imp-9473faeacd64d970` | Canh nấm gà xé sợi | Uses 300g straw mushrooms and 300g mixed chicken meat, bones and wings; simmers chicken about 40 minutes before mushrooms. |
| `imp-9ab5767266722397` | Canh mực cà chua chua nhẹ | Selected southern sour-soup section starts with 200g squid and a bạc hà stalk. |

These facts support only their stated source locator and limits. Variant differences do not justify merging quantities or changing V2. Candidate edit files remain empty.

## Remaining source review

| Reachable source without bounded review | Recipe |
| --- | --- |
| `source-a574dd37f14cc5aa` | `imp-ad2b55ed85f0d109` |
| `source-819ec4e303ad0da4` | `imp-7cfc6a2e9d8bf8a3` |
| `source-3e83a7ab3cb62798` | `imp-3f1ad35e1f1ec87f` |

Unavailable retrieval reasons: `HTTP_200_BUT_NO_RELIABLE_READABLE_RECIPE_TEXT`: 4, `HTTP_403`: 4, `RETRIEVAL_FAILED_BEFORE_READABLE_CONTENT`: 8.

## Evidence and limits

- `data/recipe-intelligence/v3/research/batch-06-evidence.json` contains source metadata/hashes, bounded facts, V1 snapshot hashes and V2 file hashes.
- `data/recipe-intelligence/v3/research/batch-06-edits.json` contains zero edits.
- Raw source HTML/text and parsed payloads remain session-only under `/tmp/takolio-v3-batches05-14-research`; no full source recipe or source media is copied into the repository.
- V1 hashes use documented compact sorted Unicode JSON. They are research snapshot hashes, not the runtime catalog fingerprint.
- V2 hashes use exact source-file bytes. No V2, runtime, ingredient registry, shopping/cooking consumer, media, migration or production change is made here.

## Executed checks

- `python3 /tmp/generate_batches05_14.py`: PASS; regenerated batches 05–14 with source-specific claims and zero edits.
- `python3 /tmp/check_batches05_14.py`: PASS; ordered ledger IDs, hashes, source facts, claim references, payload-key exclusion and pending gates validated.
- `git diff --check -- data/recipe-intelligence/v3/research/batch-06-evidence.json data/recipe-intelligence/v3/research/batch-06-edits.json docs/ai/recipe-intelligence-v3/research/BATCH_06_RESEARCH.md`: PASS; exit 0, no output.
- Shared `node scripts/recipe-intelligence-v3-audit.mjs --check`: owned by the lead agent; this packet does not claim the shared integration gate.

Actual packet checks: `2026-10-26T18:35:06.613718Z` UTC. The embedded Python block was extracted and executed from the repository root: PASS. All 30 owned evidence/edit/document files also passed a direct trailing-whitespace/newline scan, including untracked content. The session-only checker additionally matched cached raw/text hashes and the compiled V1 snapshot; it is not required by the portable check.

## Runnable packet self-check

From the repository root:

```text
import hashlib, json, pathlib
root = pathlib.Path.cwd()
base = root / 'data/recipe-intelligence/v3/research'
evidence = json.loads((base / 'batch-06-evidence.json').read_text())
edits = json.loads((base / 'batch-06-edits.json').read_text())
ledger = json.loads((root / 'docs/ai/recipe-intelligence-v3/batches/batch-ledger.json').read_text())
expected = [row['recipeId'] for row in ledger['batches'][5]['recipes']]
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
print('PASS batch06: ordered IDs, V2 hashes, pending gates, zero edits')
```

Next: independently review each bounded fact, resolve all remaining fields and obtain human culinary approval before any source or runtime promotion.
