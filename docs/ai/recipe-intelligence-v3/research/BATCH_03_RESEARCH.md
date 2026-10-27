# Current integrated research checkpoint

Current canonical packets: batch-03. 20 recipes; 47 source rows; 38 bounded content reads; 48 claims; 20 recipes with external-content claims; 0 candidate edits across 0 recipes. Human approval and full culinary verification remain zero. Source/runtime promotion remains false.

Current validation from the repository root:

```sh
PATH=/opt/homebrew/opt/node@24/bin:$PATH TMPDIR=/private/tmp node scripts/recipe-intelligence-v3-audit.mjs --check
```

This validates all 500 V1/V2 hashes, exact packet ownership, claim facts/pointers, allowed edits, candidate fingerprints and generated outputs. Raw retrieval-cache checks remain historical session evidence; current source hashes and fact locators are retained in the canonical packets. Supplement summaries: `GAP_RESEARCH_SUPPLEMENTS.md`.

Current packet hashes:

| Packet | Evidence SHA-256 | Edits SHA-256 |
|---|---|---|
| batch-03 | `c5135084f7c86e5f83562bda5b0bf9311374f0e50ccc3cb3ef47e5dc7b186031` | `bcc3b7038d7f5a0795a33a8bead0419a91581d699b33e29a33759b60495a2f45` |

---

The original report below is historical: counts, packet hashes and session commands describe the initial pre-supplement snapshot. Its fixed-count code is retained as text. Use the current validation command above.

# Batch 03 bounded culinary research

Status: `RECIPE_V3_RESEARCH_IN_PROGRESS`. Date: 2026-10-26 UTC.
Batch: `v3-03`. Human review: `PENDING`. Full recipe verifications: 0.
Source/runtime promotion: false. Production mutations: 0.

This packet compares 20 compiled V1 records, immutable V2 files and selected
source-specific facts. It does not complete whole-recipe culinary review.
Unmentioned identities, ingredients, quantities, steps, metadata, safety,
allergens and nutrition remain unverified. No source becomes `content_verified`.

## Actual accounting

| Measure | Result |
| --- | --- |
| Recipes | 20 |
| Source retrieval attempts | 47 |
| HTTP 200 / readable with bounded fact records | 38 / 38 |
| Unavailable sources | 9 |
| Claims | 48 |
| Internal V2 observations marked `FACT_SUPPORTED` | 20 |
| Bounded external comparison claims | 20 |
| Availability claims | 8 |
| Source-internal contradiction claims | 0 |
| Candidate edits | 0 |
| Full recipe verifications / human approved | 0 / 0 |

The nine unavailable sources comprise six incomplete/failed requests, two HTTP
403 responses and one HTTP 404 response. One availability claim groups two
unavailable shrimp sources. HTTP success alone was not accepted as recipe
verification. Unknown authors and publication dates remain null.

## Selected findings

| Recipe | Bounded finding / unresolved action |
| --- | --- |
| `vn-hap-02` | Salt used for blanching then rinsed is counted as consumed. Boiling aromatics/liquid retention remains unknown. |
| `vn-hap-03` | Sugar totals two teaspoons but steps use three; sesame oil totals one teaspoon but steps use two. Source portion/whole-fish recipes are separate variants. |
| `vn-hap-05` | Declared salt is fully allocated to marinade/dip before cleaning salt. Ginger has rinsed and steamed uses; retained quantities unknown. |
| `vn-hap-06` | Marinade and dip each use the one-teaspoon salt total. Sugar process-only role and excluded coconut-water shopping need review. |
| `vn-cuon-02` | MSG enters edible marinade despite process-only role; cleaning salt absent; 30-minute marinade exceeds 20-minute metadata. |
| `vn-cuon-03` | Lemon spans cleaning, soaking and dressing; consumed vinegar is rinsed away. Allocations unknown. |
| `vn-cuon-04` | Already-cooked 400g chicken conflicts with raw whole-bird boiling/shredding steps and 20-minute metadata. |
| `vn-cuon-05` | Salt rinsing and expressed sugar liquid make edible intake uncertain. One readable recipe is surrounded by unrelated spam and has low authority. |
| `vn-cuon-06` | Lemongrass skewers removed at serving are consumed; sauce lime is process-only. Pork/gio/shrimp and heating variants differ. |
| `vn-bun-02` | Extracted lemongrass solids and cleaning salt are consumed. Source parts ratio cannot certify 60g sugar. |
| `vn-bun-03` | Broth/mixing water absent from list; purchased cha cua conflicts with raw paste-ball instructions. |
| `vn-bun-04` | Optional bones unused; crab shell discard lacks edible yield; tofu frying oil unallocated. |
| `vn-bun-05` | Eaten lettuce is process-only; spring-roll frying oil absent beyond scallion-oil allocation. |
| `vn-bun-06` | 30-minute boil exceeds 25-minute metadata; cleaning/broth salt and additional fish-sauce marinade lack allocation; onion unused. |
| `vn-chay-01` | V2 uses fresh shiitake, not straw mushroom. Counted tofu block mass and complete formulation remain unverified. |
| `vn-chay-02` | Pepper used but absent; soaking/saute/final salt allocation unknown. |
| `vn-chay-03` | Process-only frying oil overlaps edible saute use; extra sauce water absent; egg-free noodle identity unverified. |
| `vn-chay-04` | Two baking stages take 20-25 minutes before preheating/preparation; unspecified source spoon sugar cannot certify one teaspoon. |
| `vn-chay-06` | Julienned half of ginger unused. V1 WATER_SPINACH versus V2 mustard greens remains an identity blocker. |
| `vn-sang-01` | Optional crispy flour unused although source describes a separate frying stage. Oil process-only role conflicts with edible rice/egg cooking. |

`FACT_SUPPORTED` labels internal observations, not external recipe certification.
`SOURCE_CONFLICT` is reserved for contradictions inside a source; this packet
records none. Source variants do not justify merging ingredient lists or changing
quantities. Zero candidate edits preserve unresolved quantities and roles.

## Evidence and limits

- `data/recipe-intelligence/v3/research/batch-03-evidence.json` contains source
  metadata, raw/text hashes, bounded fact locators, observations and V1/V2 hashes.
- `data/recipe-intelligence/v3/research/batch-03-edits.json` contains zero edits.
- Raw HTML/text remains in `/tmp/takolio-v3-batch03-research`; no complete source
  recipe, unrelated spam or source image is copied into the repository.
- V1 hashes use explicitly documented Python sorted compact Unicode JSON. They
  are research snapshot hashes, not the runtime fingerprint algorithm.
- V2 hashes use exact source-file bytes. No V2, runtime, ingredient registry,
  shopping/cooking consumer, media, migration or production change is made here.

## Executed checks

- `python3 /tmp/generate_batch03.py`: PASS; all 38 readable raw/text cache hashes,
  every selected ingredient/step position and JSON pointer resolved before output.
- Embedded self-check below: actual command/result recorded after execution.
- `git diff --check -- data/recipe-intelligence/v3/research/batch-03-evidence.json data/recipe-intelligence/v3/research/batch-03-edits.json docs/ai/recipe-intelligence-v3/research/BATCH_03_RESEARCH.md`: actual result recorded after execution.
- Shared audit regeneration and full integration gates belong to the lead agent;
  neither is claimed as passed by this isolated packet.

Next: integrate the packet, independently review quantities/roles/identity and
complete the remaining whole-recipe fields before any source/runtime promotion.

## Runnable packet self-check

From the repository root:

```text
import collections
import hashlib
import json
import pathlib
from datetime import datetime

root = pathlib.Path.cwd()
base = root / 'data/recipe-intelligence/v3/research'
evidence = json.loads((base / 'batch-03-evidence.json').read_text())
edits = json.loads((base / 'batch-03-edits.json').read_text())
ledger = json.loads((root / 'docs/ai/recipe-intelligence-v3/batches/batch-ledger.json').read_text())
expected = [row['recipeId'] for row in ledger['batches'][2]['recipes']]
assert [row['recipeId'] for row in evidence['recipes']] == expected
assert len(expected) == len(set(expected)) == 20
assert evidence['schemaVersion'] == 1
assert evidence['program'] == 'TAKOLIO_RECIPE_INTELLIGENCE_V3'
assert evidence['humanReview'] == 'PENDING'
assert evidence['sourcePromotionAllowed'] is False
assert evidence['runtimePromotionAllowed'] is False
assert edits == {'schemaVersion': 1, 'edits': []}
sources = {row['sourceId']: row for row in evidence['sources']}
assert len(sources) == len(evidence['sources']) == 47
recipes = {row['recipeId']: row for row in evidence['recipes']}
for source_id, source in sources.items():
    assert source_id == 'source-' + hashlib.sha256(source['url'].encode()).hexdigest()[:16]
    datetime.fromisoformat(source['retrievedAt'].replace('Z', '+00:00'))
    assert source['humanReview'] == 'PENDING'
    assert source['recipeIds']
    assert all(source_id in recipes[rid]['sourceIds'] for rid in source['recipeIds'])
    if 'SOURCE_CONTENT_READ' in source['evidenceStatus']:
        assert 'SOURCE_RELEVANCE_VERIFIED' in source['evidenceStatus']
        assert source['relevanceReview']['status'] == 'AGENT_BOUNDED'
        assert source['reviewedFacts']
        for fact in source['reviewedFacts']:
            assert all(fact[key] for key in ('factId', 'locator', 'reviewerSummary', 'supportLimits'))
claims = []
for recipe in recipes.values():
    assert recipe['humanReview'] == 'PENDING'
    assert recipe['fullRecipeVerification'] == 'NOT_COMPLETE'
    assert recipe['sourcePromotionAllowed'] is False
    assert recipe['v2']['sourcePath'] == 'data/recipe-refresh/v2/recipes/' + recipe['recipeId'] + '.json'
    raw = (root / recipe['v2']['sourcePath']).read_bytes()
    assert hashlib.sha256(raw).hexdigest() == recipe['v2']['fileSha256']
    v2 = json.loads(raw)
    assert recipe['title'] == v2['identity']['title']
    assert all(recipe['recipeId'] in sources[sid]['recipeIds'] for sid in recipe['sourceIds'])
    assert len(recipe['claims']) == len({claim['id'] for claim in recipe['claims']})
    for claim in recipe['claims']:
        assert claim['status'] in {'FACT_SUPPORTED', 'SOURCE_CONTENT_READ', 'SOURCE_UNAVAILABLE', 'SOURCE_CONFLICT'}
        assert all(claim[key] for key in ('findingType', 'evidenceBasis', 'reviewerSummary', 'supportLimits'))
        assert set(claim['sourceIds']) <= set(recipe['sourceIds'])
        if claim['evidenceBasis'].startswith('EXTERNAL_'):
            assert claim['sourceIds'] and claim['sourceFactReferences']
            assert all(any(ref['sourceId'] == sid for ref in claim['sourceFactReferences']) for sid in claim['sourceIds'])
            assert all('SOURCE_CONTENT_READ' in sources[sid]['evidenceStatus'] for sid in claim['sourceIds'])
        for ref in claim.get('sourceFactReferences', []):
            assert ref['sourceId'] in claim['sourceIds']
            assert any(fact['factId'] == ref['factId'] for fact in sources[ref['sourceId']]['reviewedFacts'])
        for position in claim['ingredientPositions']:
            assert v2['ingredients'][position]['position'] == position
        for number in claim['stepNumbers']:
            assert v2['steps'][number - 1]['stepNumber'] == number
        for pointer in claim['v2Pointers']:
            target = v2
            for key in pointer[1:].split('/'):
                target = target[int(key)] if isinstance(target, list) else target[key]
        claims.append(claim)
counts = lambda values: dict(sorted(collections.Counter(values).items()))
assert evidence['summary'] == {
    'recipeCount': 20,
    'sourceAttemptCount': 47,
    'sourceStatusCounts': counts(status for source in sources.values() for status in source['evidenceStatus']),
    'claimCount': len(claims),
    'claimStatusCounts': counts(claim['status'] for claim in claims),
    'findingTypeCounts': counts(claim['findingType'] for claim in claims),
    'humanApprovedCount': 0,
    'fullRecipeVerificationCompleted': 0,
    'productionMutations': 0,
}
assert len(claims) == 48
assert sum('SOURCE_CONTENT_READ' in source['evidenceStatus'] for source in sources.values()) == 38
assert sum('SOURCE_UNAVAILABLE' in source['evidenceStatus'] for source in sources.values()) == 9
print('PASS batch03: 20 recipes, 47 attempts, 38 read, 9 unavailable, 48 claims, 0 edits; review pending')
```

Actual check results (2026-10-26 UTC):

- `python3 /tmp/check_batch03.py`: exit 0; `PASS batch03: 20 recipes, 47 attempts, 38 read, 9 unavailable, 48 claims, 0 edits; review pending`.
- The exact three-path `git diff --check` command above: exit 0, no output.
- Evidence SHA-256: `c5135084f7c86e5f83562bda5b0bf9311374f0e50ccc3cb3ef47e5dc7b186031`.
- Edits SHA-256: `bcc3b7038d7f5a0795a33a8bead0419a91581d699b33e29a33759b60495a2f45`.
