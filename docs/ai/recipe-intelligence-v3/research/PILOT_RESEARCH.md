# Current integrated research checkpoint

Current canonical packets: pilot. 20 recipes; 46 source rows; 30 bounded content reads; 55 claims; 20 recipes with external-content claims; 7 candidate edits across 6 recipes. Human approval and full culinary verification remain zero. Source/runtime promotion remains false.

Current validation from the repository root:

```sh
PATH=/opt/homebrew/opt/node@24/bin:$PATH TMPDIR=/private/tmp node scripts/recipe-intelligence-v3-audit.mjs --check
```

This validates all 500 V1/V2 hashes, exact packet ownership, claim facts/pointers, allowed edits, candidate fingerprints and generated outputs. Raw retrieval-cache checks remain historical session evidence; current source hashes and fact locators are retained in the canonical packets. Supplement summaries: `GAP_RESEARCH_SUPPLEMENTS.md`.

Current packet hashes:

| Packet | Evidence SHA-256 | Edits SHA-256 |
|---|---|---|
| pilot | `d3948fdb07b4bb2a39fbaee680ca8adb9c6cc2d831168b59ee5e8f016b651515` | `a48d522667c22947672288bb70151e67901105daded9ff09ef1d217a16a877b9` |

---

The original report below is historical: counts, packet hashes and session commands describe the initial pre-supplement snapshot. Its fixed-count code is retained as text. Use the current validation command above.

# Bounded culinary pilot research

Status: `RECIPE_V3_RESEARCH_IN_PROGRESS`. Date: 2026-10-26 UTC.
Human review: `PENDING`. Full recipe verifications: 0. Source/runtime promotion: false.

This pilot investigates selected high-risk findings in 20 of 500 recipes. It
compares compiled V1 records, immutable V2 files, and source-specific facts.
It does not certify complete recipes: unmentioned ingredients, quantities,
steps, metadata, allergens and nutrients remain unverified. The other 480
recipes have no culinary content investigation in this pilot; URL attempts
elsewhere in the program do not change that.

## Evidence accounting

| Measure | Actual result |
| --- | --- |
| Distinct pilot recipes | 20 |
| Distinct source retrieval attempts | 46 |
| HTTP 200 | 32 |
| Readable content, bounded relevance review | 30 |
| Content unavailable | 16: 14 failed retrievals and two HTTP-200 YouTube shells without readable recipe/transcript |
| Claims | 55 |
| `FACT_SUPPORTED` | 21: 10 explicitly labelled internal V2 observations; 11 bounded external facts |
| `SOURCE_CONFLICT` | 4 source-internal contradictions |
| `SOURCE_CONTENT_READ` | 18: 12 variant comparisons and six unsupported derivations |
| `SOURCE_UNAVAILABLE` | 12 recipe-level access-limit claims covering 16 source attempts |
| Editorial candidate changes | Seven ingredient notes across six recipes |
| Human approvals / full recipe verifications / production mutations | 0 / 0 / 0 |

`URL_REACHABLE` describes retrieval. `SOURCE_CONTENT_READ` and
`SOURCE_RELEVANCE_VERIFIED` describe the agent's bounded source review.
None promotes V2 `contentVerification` to `content_verified`. A supported
internal V2 inconsistency is evidence of that inconsistency, not external
endorsement of a corrected recipe.

Each source stores URL, final URL, retrieval time, response status, byte count,
SHA-256, available author/date metadata, and a structured fact with section or
visible-snapshot locator. Unavailable metadata remains null. Complete copied
recipes and source images are not committed. Local HTML/text caches supported
this research and their stored hashes were checked; caches are temporary,
not durable source archives. Future reviewers can retrieve the URLs and compare
facts; changed pages may differ from the recorded hashes.

V1 `recordSha256` hashes actual compiled runtime records, loaded from
`ALL_RECIPES` plus the sequentially compiled approved import batches. Its exact
algorithm is Python `json.dumps(record, ensure_ascii=False, sort_keys=True,
separators=(',', ':'))`, encoded as UTF-8 then SHA-256. This research snapshot
hash is distinct from `stableRuntimeJson` and the catalog runtime fingerprint.
V2 `fileSha256` hashes raw source-file bytes.

## Findings by recipe

“Read/attempted” counts source pages, not complete recipe reviews. The claim
IDs, source ownership, exact V2 pointers and support limits are in
`data/recipe-intelligence/v3/research/pilot-evidence.json`.

| Recipe ID | Read/attempted | Bounded finding and remaining work |
| --- | --- | --- |
| `vn-canh-01` | 1/2 | Netspace explicitly serves four and uses 120g extracted tamarind liquid. Correct the note's missing-yield attribution; 50g raw-pulp equivalence remains unsupported. Helen video unavailable. |
| `vn-bun-01` | 2/2 | V2 metadata says 35 minutes while broth requires hours. Step 6 removes aromatics still marked consumed. Source simmer schedules are variants; Pho Thin page also contains casino spam and has reduced authority. |
| `vn-kho-01` | 2/2 | Sugar phases can exceed the declared two tablespoons; scallion appears in step 9 but not ingredients. Variant timing does not supply an automatic replacement amount or time. |
| `vn-hap-01` | 2/2 | Whole-bird sources do not validate an 800g half-bird cooking time. Half a teaspoon pepper appears twice against one half-teaspoon line. The 500g salt bed is already process_only; food-safety endpoint remains unverified. |
| `imp-6eaf6ed6d417c52c` | 2/2 | Recipe Cart's seasoning total scales to 9/16 teaspoon at 1.5x, not V2 3/4. Egg/starch coating is another variant. Oil is already process_only; absorbed oil is unknown. |
| `imp-7d38862afc164a8d` | 2/2 | Declared source contradicts its own `Ts` ingredient units with `ts` method units for garlic, oyster sauce and sesame oil. Alternate sauce cannot resolve the conflict. |
| `imp-0d6c454ae1073ef6` | 1/2 | The relevant chayote subsection supports steaming/dressing only; it provides no quantities, serving count, scallion or soy sauce. Broad vegetable-aggregate content supplies no missing recipe amounts. |
| `vn-xao-01` | 2/2 | V2 allocates half a teaspoon salt to blanching and again to stir-frying, but lists one process-only half teaspoon. Alternate source itself conflicts: fish sauce one teaspoon in list, one tablespoon in method. |
| `vn-hap-04` | 1/2 | Raw pork, derived crackling and retained fat are all shopping/nutrition lines. Cookpad starts with five tablespoons ready crackling and four tablespoons fish sauce; no 200g-to-80g yield is established. |
| `vn-chien-05` | 1/3 | V2 lists whole eggs but uses yolks. Readable alternate conflicts between three yolks in list and two in method. Pork/noodle/shrimp scaling remains unverified; frying oil already process_only. |
| `vn-chay-05` | 1/2 | Readable source fries/braises tofu; V2 steams silken tofu. Averaging soy quantities between incompatible variants does not verify 1.5 tablespoons. |
| `vn-cuon-01` | 1/2 | Source shrimp/pork amounts differ from V2. Three tablespoons pickle sugar plus one dip tablespoon could explain V2 48g under its assumed conversion; no proven sugar-total defect. |
| `vn-sang-05` | 1/2 | Step 2 uses two tablespoons milk absent from ingredients. Alternate supports four eggs, thin sheet and rolling while just set, not all V2 ingredients or milk/allergen handling. |
| `gl-01` | 1/3 | Alternate yield/pasta/tomato and sauce time differ. Those differences are variants, not proven defects; declared source remains unavailable. |
| `gl-02` | 1/4 | Newly discovered RecipeTin Eats supports method patterns only; declared sources unavailable. Step 2 white pepper is absent from ingredients and differs from Sichuan pepper. |
| `gl-03` | 1/2 | Readable source contradicts five eggs in narrative with four in card. Tomato ratio and ketchup/slurry differences are variants; V2 exact quantities remain unverified. |
| `gl-04` | 1/2 | Alternate's half-egg instruction allocates one of two servings, not V2 staged two-thirds/one-third. Sake and exact quantities remain unverified; JOC unavailable. |
| `gl-05` | 1/2 | Korean Bapsang specifies one-quarter small onion, not the V2 note's half onion. Meat omission is explicitly permitted. Sauce sequence and sesame-oil quantity are variant differences. |
| `gl-06` | 4/4 | Holy basil differs from Thai sweet basil; canonical identity and 25g handful conversion remain unresolved. Basil before/after heat is a variant choice, not a source contradiction. |
| `gl-10` | 2/2 | Hot Thai Kitchen says large makrut leaves infuse curry and are not eaten; remove or warn diners. V2 consumed role remains unresolved. Coconut-milk, seasoning and vegetable sequences differ by variant. |

## Candidate scope

`pilot-edits.json` contains exact old/new values and resolving claim references:

| Recipe | Note path | Scope |
| --- | --- | --- |
| `vn-canh-01` | `/ingredients/2/note` | Correct yield attribution; distinguish raw pulp from extracted liquid. |
| `vn-hap-04` | `/ingredients/4/note` | Clarify derived crackling; raw-to-rendered yield unverified. |
| `vn-hap-04` | `/ingredients/16/note` | Clarify retained fat lineage; warn against duplicate intake accounting. |
| `vn-chay-05` | `/ingredients/5/note` | Withdraw unsupported midpoint claim; distinguish fried/braised and steamed variants. |
| `gl-05` | `/ingredients/5/note` | Correct source onion attribution without approving current amount. |
| `gl-06` | `/ingredients/11/note` | Distinguish basil species; label timing variants and unknown gram conversion. |
| `gl-10` | `/ingredients/8/note` | Explain infusion-only large leaves and removal/warning. |

Quantities, canonical identities, source roles, shopping/nutrition flags,
steps and nutrient profiles are preserved. These note candidates do not resolve
the structural findings and do not authorize release. Each edit remains pending
independent culinary review.

## Executed checks

The researcher executed these local checks; full project gates and generated
candidate validation belong to the lead agent's final checkpoint.

- Current V1 was recompiled with Vite SSR and `compileImportBatch` from both
  approved batches into `/tmp/takolio-v3-v1-pilot-selfcheck.json`:
  `pilot-v1-runtime-load=ok recipes=500`.
- All 20 pilot V1 research hashes match that freshly compiled runtime.
- All 20 V2 raw-byte hashes, claim pointers, ingredient positions, step numbers,
  source/fact ownership and seven edit old values match their inputs.
- All 32 cached HTTP-200 HTML hashes/byte counts and 30 visible-text hashes match
  evidence. These checks validate recorded provenance integrity, not source truth.
- All source, claim and finding-type counts recompute exactly. Approvals remain
  zero; every source/recipe review is pending; promotion remains false.
- Manual pointer review corrected `eggroll-bounded-support` to steps 6/7; phở
  metadata/removal claims point to steps 5/6. The four source-internal conflicts
  were checked against their cached visible sections.
- Initial self-check caught a missing ingredient-position declaration after
  adding the tofu-method note pointer. Position 5 was added; rerun passed.
- `git diff --check -- data/recipe-intelligence/v3/research/pilot-evidence.json data/recipe-intelligence/v3/research/pilot-edits.json docs/ai/recipe-intelligence-v3/research/PILOT_RESEARCH.md` passed. All three new files were explicitly parsed/read; untracked files are not covered by ordinary Git diff alone.

Runnable deterministic check follows. Run from repository root; optional
snapshot/cache arguments add integrity checks against local research inputs.
The exact executed command was:

```text
python3 -c 'from pathlib import Path; p=Path("docs/ai/recipe-intelligence-v3/research/PILOT_RESEARCH.md"); exec(compile(p.read_text().split("<!-- PILOT_SELF_CHECK_START -->\n```text\n",1)[1].split("\n```\n<!-- PILOT_SELF_CHECK_END -->",1)[0],str(p),"exec"))' --v1-snapshot /tmp/takolio-v3-v1-pilot-selfcheck.json --source-cache /tmp/takolio-v3-pilot-research
```

<!-- PILOT_SELF_CHECK_START -->
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
evidence = json.loads((base / 'pilot-evidence.json').read_text())
edits = json.loads((base / 'pilot-edits.json').read_text())
recipes, sources = evidence['recipes'], evidence['sources']
ids = [r['recipeId'] for r in recipes]
source_by_id = {s['sourceId']: s for s in sources}
assert evidence['schemaVersion'] == 1
assert evidence['humanReview'] == 'PENDING'
assert evidence['sourcePromotionAllowed'] is False
assert evidence['runtimePromotionAllowed'] is False
assert len(ids) == len(set(ids)) == 20
assert len(sources) == len(source_by_id) == 46
assert set(edits) == {'schemaVersion', 'edits'} and edits['schemaVersion'] == 1
assert len(edits['edits']) == 7
assert len({e['recipeId'] for e in edits['edits']}) == 6
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
        if claim['evidenceBasis'] not in ('INTERNAL_V2_OBSERVATION', 'RETRIEVAL_ATTEMPT'):
            assert claim['sourceFactReferences']
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
        prefix = 'data/recipe-intelligence/v3/research/pilot-evidence.json#'
        assert ref.startswith(prefix)
        pointer = ref[len(prefix):]
        recipe_index = int(pointer.split('/')[2])
        assert recipes[recipe_index]['recipeId'] == edit['recipeId']
        assert edit['path'] in resolve(evidence, pointer)['v2Pointers']
summary = evidence['summary']
assert summary['recipeCount'] == 20 and summary['sourceAttemptCount'] == 46
assert summary['claimCount'] == sum(len(r['claims']) for r in recipes) == 55
assert Counter(c['status'] for r in recipes for c in r['claims']) == Counter(summary['claimStatusCounts'])
assert Counter(c['findingType'] for r in recipes for c in r['claims']) == Counter(summary['findingTypeCounts'])
assert Counter(s for row in sources for s in row['evidenceStatus']) == Counter(summary['sourceStatusCounts'])
assert summary['humanApprovedCount'] == summary['fullRecipeVerificationCompleted'] == summary['productionMutations'] == 0
v1_count = html_count = text_count = 0
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
            assert sha(path) == source['contentSha256']; html_count += 1
        if 'SOURCE_CONTENT_READ' in source['evidenceStatus']:
            assert sha(options.source_cache / (key + '.txt')) == source['visibleTextSha256']
            text_count += 1
print(f'pilot-evidence-self-check=ok recipes=20 sources=46 claims=55 edits=7 v1Hashes={v1_count} htmlHashes={html_count} visibleTextHashes={text_count}')
```
<!-- PILOT_SELF_CHECK_END -->

Next action: review every field of these 20 recipes, resolve the structural
findings with coherent variant and safety evidence, calibrate the pilot review
criteria, then continue the remaining 480. Independent culinary review and
separate source/nutrition/ingredient release gates remain required.
