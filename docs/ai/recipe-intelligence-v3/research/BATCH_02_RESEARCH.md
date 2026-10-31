# Current integrated research checkpoint

Current canonical packets: batch-02. 20 recipes; 45 source rows; 37 bounded content reads; 35 claims; 20 recipes with external-content claims; 1 candidate edits across 1 recipes. Human approval and full culinary verification remain zero. Source/runtime promotion remains false.

Current validation from the repository root:

```sh
PATH=/opt/homebrew/opt/node@24/bin:$PATH TMPDIR=/private/tmp node scripts/recipe-intelligence-v3-audit.mjs --check
```

This validates all 500 V1/V2 hashes, exact packet ownership, claim facts/pointers, allowed edits, candidate fingerprints and generated outputs. Raw retrieval-cache checks remain historical session evidence; current source hashes and fact locators are retained in the canonical packets. Supplement summaries: `GAP_RESEARCH_SUPPLEMENTS.md`.

Current packet hashes:

| Packet | Evidence SHA-256 | Edits SHA-256 |
|---|---|---|
| batch-02 | `4e21b525cadeeb1da3aed98fa74bb55d645195197c176d126935b44f41d252f1` | `f8704faec65d518d6e656f264202ca004c36657e3019e4f2696660c3b58551a0` |

---

The original report below is historical: counts, packet hashes and session commands describe the initial pre-supplement snapshot. Its fixed-count code is retained as text. Use the current validation command above.

# Batch 02 bounded culinary research

Status: `RECIPE_V3_RESEARCH_IN_PROGRESS`. Date: 2026-10-26 UTC.
Batch: `v3-02`. Human review: `PENDING`. Full recipe verifications: 0.
Source/runtime promotion: false. Production mutations: 0.

This packet compares 20 compiled V1 records, their immutable V2 files and
selected source-specific facts. It does not complete the culinary protocol's
whole-recipe review: unmentioned identities, ingredients, quantities, cooking
steps, metadata, safety, allergens and nutrition remain unverified. No source
is promoted to `content_verified`; no recipe is certified for runtime release.

## Actual accounting

| Measure | Result |
| --- | --- |
| Recipes | 20 |
| Source retrieval attempts | 45 |
| HTTP 200 | 39 |
| Readable sources with bounded relevance/fact records | 37 |
| Readable HTML / PDF | 36 / 1 |
| Unavailable sources | 8 |
| Claims | 35 |
| Internal V2 observations marked `FACT_SUPPORTED` | 5 |
| Source-internal conflict claims | 3 |
| Bounded source comparisons | 20 |
| Availability claims | 7 |
| Note-only candidate edits | 1 |
| Fully verified recipes / human approved recipes | 0 / 0 |

The eight unavailable sources comprise six retrieval failures/HTTP errors and
two HTTP-200 YouTube shells without readable recipes/transcripts. HTTP success
and JSON-LD metadata were not accepted as culinary evidence. Publication dates
and authors are metadata only; absent values stay null.

## Selected findings

| Recipe | Bounded finding / unresolved action |
| --- | --- |
| `vn-canh-02` | VietnamNet supports 500g crab and counted/bunched vegetables. Water volume, vegetable mass and edible crab yield remain unverified. |
| `vn-canh-03` | Four-melon/1.5L and three-melon/800ml recipes are variants; dry mushroom amount and V2 25-30 minute cooking need review. |
| `vn-canh-04` | Minced-pork and rib recipes differ; rib/water amounts unverified. V2 35-minute metadata conflicts with a 30-45 minute simmer plus later cooking. |
| `vn-canh-05` | Readable main recipe lacks support for the V2 lotus-seed combination; two alternatives unavailable. |
| `vn-canh-06` | Half/whole pineapple formulations differ; shell-on clam yield remains unknown. |
| `vn-kho-02` | V2 renders the one pork line into crackling, then fries/braises pork again and adds crackling later; allocation is ambiguous. |
| `vn-kho-03` | Step 6 uses about 120ml water absent from the ingredient list. |
| `vn-kho-04` | Combined vegetable/sauce variant unverified; step 7 uses about 100ml water absent from ingredients. |
| `vn-kho-05` | Off-heat seasoning/no-lid method has bounded support; peeled/shell-on scaling and pepper rounding do not. |
| `vn-kho-06` | BaoHaiPhong list says two tablespoons fish sauce; marinade has none, final step one. Correct attribution only; preserve existing amount pending review. |
| `vn-xao-02` | Bluestone lists quarter teaspoon MSG but uses it twice. Western celery/water celery are distinct ingredient variants. |
| `vn-xao-03` | Each separate 700g tomato variant uses pineapple omitted from its list; no amount can be recovered for the V2 hybrid. |
| `vn-xao-04` | Separate 300g/500g variants; visible editorial drafting text reduces one source's authority. |
| `vn-xao-05` | Chicken-egg/duck-egg and chayote counts differ across variants, not a source-internal conflict. |
| `vn-xao-06` | V2 step 9 uses two teaspoons fish sauce absent from ingredients; source beef/bean ratios do not validate the V2 ratio. |
| `vn-chien-01` | PDF coated/deep-fried and ordinary-fried finishes differ; simple HTML formulation differs again. Block mass remains unknown. |
| `vn-chien-02` | Three-serving scaling gives 4.5 eggs before rounding; raw/precooked filling formulations differ. |
| `vn-chien-03` | Four-wing source has no wing mass; one-kilogram coated/blanched variant depends on unreadable video. |
| `vn-chien-04` | Fish/fat/pork mixture and doubled seasoning rely on unsupported yield/scaling assumptions. |
| `vn-chien-06` | Different one-fish coating/dip variants; fish mass, two-fish scaling and exact oil attribution remain unknown. |

`SOURCE_CONFLICT` applies only to the BaoHaiPhong fish-sauce discrepancy,
Bluestone MSG discrepancy and pineapple omissions within the inspected separate
squid variants. Differences between recipes or labelled formulations use
`VARIANT_DIFFERENCE`. `FACT_SUPPORTED` in this packet labels reproducible
internal V2 observations; it never asserts complete external verification.

## Evidence and candidate

- `data/recipe-intelligence/v3/research/batch-02-evidence.json`: source metadata,
  raw/text hashes, source-specific fact locators, scoped findings, V1/V2 hashes.
- `data/recipe-intelligence/v3/research/batch-02-edits.json`: one note change at
  `vn-kho-06` `/ingredients/5/note`; current amount/identity/roles untouched.
- Raw snapshots remain in `/tmp/takolio-v3-batch02-research`, not committed.
  Facts paraphrase inspected sections; this packet grants no content/image reuse.
- Source `source-28dc62eee157c037` is a seven-page PDF. The raw cache suffix is
  `.html`, but content type and PDF extraction basis are explicit. Raw PDF hash
  and extracted-text hash are distinct. A garbled page-3 seasoning phrase is
  excluded from quantitative support. No visual-layout correctness is claimed.

## Executed checks

- `node scripts/recipe-intelligence-v3-audit.mjs --check`: packet/schema/claim/
  source/ownership assertions passed before the generated-output comparison;
  FAIL at expected `manifests/coverage.json` drift, existing 20 researched/6
  editorially changed versus expected 40/7 after adding batch02. Shared outputs
  require regeneration by the integration owner. This was not a release pass.
- Embedded self-check below: command and actual output recorded after execution.
- `git diff --check -- data/recipe-intelligence/v3/research/batch-02-evidence.json data/recipe-intelligence/v3/research/batch-02-edits.json docs/ai/recipe-intelligence-v3/research/BATCH_02_RESEARCH.md`: actual result recorded after execution.

Root owns generated outputs, full integration gates and shared status/handoff
files. Next: integrate this packet, review source limitations, resolve ingredient
omissions and component lineage, complete whole-recipe comparison, obtain human
culinary review. No protected runtime, payment, authentication or production
file is changed by this packet.

## Runnable deterministic self-check

```text
python3 -c 'from pathlib import Path; p=Path("docs/ai/recipe-intelligence-v3/research/BATCH_02_RESEARCH.md"); exec(compile(p.read_text().split("<!-- BATCH_02_SELF_CHECK_START -->\n```text\n",1)[1].split("\n```\n<!-- BATCH_02_SELF_CHECK_END -->",1)[0],str(p),"exec"))' --v1-snapshot /tmp/takolio-v3-v1-pilot-selfcheck.json --source-cache /tmp/takolio-v3-batch02-research
```

<!-- BATCH_02_SELF_CHECK_START -->
```text
import argparse, hashlib, json
from collections import Counter
from pathlib import Path

args = argparse.ArgumentParser()
args.add_argument('--v1-snapshot', type=Path)
args.add_argument('--source-cache', type=Path)
options = args.parse_args()
root = Path.cwd()
base = root / 'data/recipe-intelligence/v3/research'
evidence = json.loads((base / 'batch-02-evidence.json').read_text())
edits = json.loads((base / 'batch-02-edits.json').read_text())
recipes, sources = evidence['recipes'], evidence['sources']
ids = [r['recipeId'] for r in recipes]
source_by_id = {s['sourceId']: s for s in sources}
ledger = json.loads((root / 'docs/ai/recipe-intelligence-v3/batches/batch-ledger.json').read_text())
assert ids == [r['recipeId'] for b in ledger['batches'] if b['batchId'] == 'v3-02' for r in b['recipes']]
assert evidence['schemaVersion'] == 1
assert evidence['humanReview'] == 'PENDING'
assert evidence['sourcePromotionAllowed'] is False
assert evidence['runtimePromotionAllowed'] is False
assert len(ids) == len(set(ids)) == 20
assert len(sources) == len(source_by_id) == 45
assert set(edits) == {'schemaVersion', 'edits'} and edits['schemaVersion'] == 1
assert len(edits['edits']) == 1
assert evidence['scope']['pilotRecipeCount'] == 20
assert evidence['scope']['catalogRecipeCount'] == 500
assert evidence['scope']['fullRecipeVerificationCompleted'] == 0

def sha(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()

def resolve(value, pointer):
    assert pointer.startswith('/')
    for part in pointer[1:].split('/'):
        token = part.replace('~1', '/').replace('~0', '~')
        value = value[int(token)] if isinstance(value, list) else value[token]
    return value

v2_by_id = {}
for source in sources:
    assert source['humanReview'] == 'PENDING'
    assert source['retrievedAt'] and source['url']
    assert source['sourceId'] == 'source-' + hashlib.sha256(source['url'].encode()).hexdigest()[:16]
    assert set(source['recipeIds']) <= set(ids)
    states = set(source['evidenceStatus'])
    assert 'URL_DISCOVERED' in states
    assert ('URL_REACHABLE' in states) == (source['httpStatus'] == 200)
    if 'SOURCE_CONTENT_READ' in states:
        assert 'SOURCE_RELEVANCE_VERIFIED' in states
        assert source['reviewedFacts'] and source['relevanceReview']['scope']
        for fact in source['reviewedFacts']:
            assert fact['locator'] and fact['reviewerSummary'] and fact['supportLimits']
    else:
        assert 'SOURCE_UNAVAILABLE' in states and source['unavailabilityReason']
for recipe in recipes:
    rid = recipe['recipeId']
    source_path = root / recipe['v2']['sourcePath']
    data = json.loads(source_path.read_text()); v2_by_id[rid] = data
    assert recipe['v2']['fileSha256'] == sha(source_path)
    assert recipe['title'] == data['identity']['title']
    assert recipe['humanReview'] == 'PENDING'
    assert recipe['fullRecipeVerification'] == 'NOT_COMPLETE'
    assert recipe['sourcePromotionAllowed'] is False
    assert len(set(recipe['sourceIds'])) == len(recipe['sourceIds'])
    assert set(recipe['sourceIds']) == {s['sourceId'] for s in sources if rid in s['recipeIds']}
    assert len({c['id'] for c in recipe['claims']}) == len(recipe['claims'])
    for claim in recipe['claims']:
        for key in ('findingType', 'evidenceBasis', 'reviewerSummary', 'supportLimits'):
            assert isinstance(claim[key], str) and claim[key]
        assert set(claim['sourceIds']) <= set(recipe['sourceIds'])
        for ref in claim.get('sourceFactReferences', []):
            assert ref['sourceId'] in claim['sourceIds']
            source = source_by_id[ref['sourceId']]
            assert any(f['factId'] == ref['factId'] for f in source.get('reviewedFacts', []))
        if claim['evidenceBasis'].startswith('EXTERNAL_'):
            assert claim['sourceIds'] and claim['sourceFactReferences']
            assert set(claim['sourceIds']) == {r['sourceId'] for r in claim['sourceFactReferences']}
            assert all('SOURCE_CONTENT_READ' in source_by_id[s]['evidenceStatus'] for s in claim['sourceIds'])
        if claim['status'] == 'SOURCE_CONFLICT':
            assert claim['evidenceBasis'] == 'EXTERNAL_SOURCE_INTERNAL_CONFLICT'
        for position in claim['ingredientPositions']:
            assert data['ingredients'][position]['position'] == position
        for step in claim['stepNumbers']:
            assert data['steps'][step - 1]['stepNumber'] == step
        for pointer in claim['v2Pointers']:
            resolve(data, pointer)
            if pointer.startswith('/ingredients/'):
                assert int(pointer.split('/')[2]) in claim['ingredientPositions']
            if pointer.startswith('/steps/'):
                assert int(pointer.split('/')[2]) + 1 in claim['stepNumbers']
for edit in edits['edits']:
    assert set(edit) == {'recipeId', 'path', 'oldValue', 'newValue', 'reason', 'evidenceReferences'}
    assert edit['path'].startswith('/ingredients/') and edit['path'].endswith('/note')
    assert resolve(v2_by_id[edit['recipeId']], edit['path']) == edit['oldValue']
    assert edit['newValue'] != edit['oldValue'] and edit['reason']
    assert edit['evidenceReferences']
    for ref in edit['evidenceReferences']:
        prefix = 'data/recipe-intelligence/v3/research/batch-02-evidence.json#'
        assert ref.startswith(prefix)
        pointer = ref[len(prefix):]
        recipe_index = int(pointer.split('/')[2])
        assert recipes[recipe_index]['recipeId'] == edit['recipeId']
        assert edit['path'] in resolve(evidence, pointer)['v2Pointers']
summary = evidence['summary']
assert summary['recipeCount'] == 20 and summary['sourceAttemptCount'] == 45
assert summary['claimCount'] == sum(len(r['claims']) for r in recipes) == 35
assert Counter(c['status'] for r in recipes for c in r['claims']) == Counter(summary['claimStatusCounts'])
assert Counter(c['findingType'] for r in recipes for c in r['claims']) == Counter(summary['findingTypeCounts'])
assert Counter(s for row in sources for s in row['evidenceStatus']) == Counter(summary['sourceStatusCounts'])
assert summary['humanApprovedCount'] == summary['fullRecipeVerificationCompleted'] == summary['productionMutations'] == 0
v1_count = html_count = pdf_count = text_count = 0
if options.v1_snapshot:
    runtime = {r['id']: r for r in json.loads(options.v1_snapshot.read_text())}
    assert len(runtime) == 500
    for recipe in recipes:
        payload = json.dumps(runtime[recipe['recipeId']], ensure_ascii=False,
                             sort_keys=True, separators=(',', ':')).encode()
        assert hashlib.sha256(payload).hexdigest() == recipe['v1']['recordSha256']
        v1_count += 1
if options.source_cache:
    for source in sources:
        key = source['sourceId'].removeprefix('source-')
        if source['httpStatus'] == 200:
            path = options.source_cache / (key + '.html')
            assert len(path.read_bytes()) == source['byteLength']
            assert sha(path) == source['contentSha256']
            if source['contentType'] == 'application/pdf':
                assert path.read_bytes().startswith(b'%PDF-')
                assert source['textExtractionBasis']; pdf_count += 1
            else:
                html_count += 1
        if 'SOURCE_CONTENT_READ' in source['evidenceStatus']:
            assert sha(options.source_cache / (key + '.txt')) == source['visibleTextSha256']
            text_count += 1
print(f'batch02-evidence-self-check=ok recipes=20 sources=45 claims=35 edits=1 v1Hashes={v1_count} htmlHashes={html_count} pdfHashes={pdf_count} visibleTextHashes={text_count}')
```
<!-- BATCH_02_SELF_CHECK_END -->

Executed result: embedded check PASS:
`batch02-evidence-self-check=ok recipes=20 sources=45 claims=35 edits=1 v1Hashes=20 htmlHashes=38 pdfHashes=1 visibleTextHashes=37`.
The 38 HTML hashes include the two unavailable YouTube shells; readable HTML
remains 36. `git diff --check` on all three owned paths PASS (exit 0).
