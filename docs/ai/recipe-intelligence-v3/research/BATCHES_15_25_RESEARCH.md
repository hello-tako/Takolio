# Current integrated research checkpoint

Current canonical packets: batch-15, batch-16, batch-17, batch-18, batch-19, batch-20, batch-21, batch-22, batch-23, batch-24, batch-25. 220 recipes; 532 source rows; 253 bounded content reads; 660 claims; 220 recipes with external-content claims; 7 candidate edits across 3 recipes. Human approval and full culinary verification remain zero. Source/runtime promotion remains false.

Current validation from the repository root:

```sh
PATH=/opt/homebrew/opt/node@24/bin:$PATH TMPDIR=/private/tmp node scripts/recipe-intelligence-v3-audit.mjs --check
```

This validates all 500 V1/V2 hashes, exact packet ownership, claim facts/pointers, allowed edits, candidate fingerprints and generated outputs. Raw retrieval-cache checks remain historical session evidence; current source hashes and fact locators are retained in the canonical packets. Supplement summaries: `GAP_RESEARCH_SUPPLEMENTS.md`.

Current packet hashes:

| Packet | Evidence SHA-256 | Edits SHA-256 |
|---|---|---|
| batch-15 | `062c33781fee8528cb50d003142aa1424b1975373b1fafe7450d37c2af4f7719` | `bcc3b7038d7f5a0795a33a8bead0419a91581d699b33e29a33759b60495a2f45` |
| batch-16 | `a4edc72f415417cf863ad41c18335147892f95eb1b0db395ce1d3fc314ef5c7a` | `bcc3b7038d7f5a0795a33a8bead0419a91581d699b33e29a33759b60495a2f45` |
| batch-17 | `5822ee5e1d4b817a8bba6724d416ddc9f2f4c26a3095bb6726c3796a14a34511` | `bcc3b7038d7f5a0795a33a8bead0419a91581d699b33e29a33759b60495a2f45` |
| batch-18 | `94676c6310db233a9a7f6902f5530dbadd0a0869d41d1e46539f591c24d46731` | `bcc3b7038d7f5a0795a33a8bead0419a91581d699b33e29a33759b60495a2f45` |
| batch-19 | `b22f8dc458adfeab19930be5119040352ca78fdbfb5865dda6295ed963504789` | `c048e02337be7871edd8f191f28f8012d977bbcb3bfb0e6931cfc44f1eedc618` |
| batch-20 | `74ec67acab1abe9f151761538e4f4c6b8370663cb2e30d4ba19d88c3077a5814` | `bcc3b7038d7f5a0795a33a8bead0419a91581d699b33e29a33759b60495a2f45` |
| batch-21 | `1734c8696bf03fd5f823926ba345b387882c385f8c0d50549ee4150bdbacb040` | `da0ea96f67a621790f70be96a7750d230c3a9fdad7a61bdad090910871b2331c` |
| batch-22 | `3a6e8459975a22170f73dcad4dc6570486addbd3567cb8729681c2c19762830f` | `bcc3b7038d7f5a0795a33a8bead0419a91581d699b33e29a33759b60495a2f45` |
| batch-23 | `b1ceeb7d4c3620db773671d2e669150796687bed185c9553b283621d17568d6c` | `9cd4c0a953d35d7f9a18805a36d2f95bcdaf934a486f8d1839eff1f61e623e5d` |
| batch-24 | `11b57f3187968b3a52ef9349aa7fe88e10a2af381b515f4dcc8a8c6526efea39` | `bcc3b7038d7f5a0795a33a8bead0419a91581d699b33e29a33759b60495a2f45` |
| batch-25 | `357ea68a0f10e54473f68b7ef5258b125d6b7334894d3c7ebc49a14047c5bbe6` | `bcc3b7038d7f5a0795a33a8bead0419a91581d699b33e29a33759b60495a2f45` |

---

The original report below is historical: counts, packet hashes and session commands describe the initial pre-supplement snapshot. Its fixed-count code is retained as text. Use the current validation command above.

# Batches 15-25 source inventory and bounded ingredient facts

Status: `RECIPE_V3_RESEARCH_IN_PROGRESS`. Date: 2026-10-26 UTC.
Human review: `PENDING`. Full recipe verification: `NOT_COMPLETE` for all 220.
Source/runtime promotion: false. Candidate edits: 0. Production mutations: 0.

This packet records source retrievals, selected ingredient facts and reproducible
internal V2 quantity observations. It does not complete the culinary protocol's
V1/V2 comparison of every identity, ingredient, amount, method, timing and
metadata field. A linked ingredient fact supports only its named source fact;
it does not establish correspondence with V2, a variant difference, safety,
allergens, edible retention, nutrition or source authority. `FACT_SUPPORTED`
labels internal V2 observations only. No source becomes `content_verified`.

## Actual accounting

Each batch retains its ledger's ordered 20 recipe IDs.

| Batch | Sources | Read ingredient facts | Unavailable | Claims | Edits |
| --- | ---: | ---: | ---: | ---: | ---: |
| 15 | 42 | 13 | 16 | 46 | 0 |
| 16 | 45 | 20 | 5 | 45 | 0 |
| 17 | 43 | 18 | 7 | 43 | 0 |
| 18 | 45 | 14 | 12 | 43 | 0 |
| 19 | 45 | 16 | 11 | 46 | 0 |
| 20 | 42 | 18 | 6 | 44 | 0 |
| 21 | 46 | 13 | 12 | 41 | 0 |
| 22 | 43 | 15 | 11 | 44 | 0 |
| 23 | 48 | 17 | 13 | 48 | 0 |
| 24 | 44 | 19 | 5 | 43 | 0 |
| 25 | 41 | 13 | 5 | 38 | 0 |
| Total | 484 | 176 | 103 | 481 | 0 |

The 484 source rows represent 482 unique retrievals. Of the 381 reachable rows,
380 returned HTTP 200 and one HTTP 202; reachability alone confers no culinary
evidence. There are 205 reachable rows without an accepted ingredient fact.
The 176 read rows contain 175 distinct paraphrases: one Tom Yum source recurs
in batches 20 and 24. Claims comprise 220 internal V2 observations, 175 external
ingredient facts and 86 availability limitations. Batch 24 retains a second
read source for one recipe without creating an additional external claim.

## Evidence boundaries

- Evidence and empty edits: `data/recipe-intelligence/v3/research/batch-15-evidence.json`
  through `batch-25-evidence.json`, paired with the corresponding edits files.
- Facts use short reviewer paraphrases with ingredient-section locators. Full
  recipes, raw HTML, methods and media are not copied into this packet.
- Publication/byline metadata stays null where unreviewed. Whole JSON-LD and
  metadata dumps are excluded. JSON-LD facts concern inspected ingredient
  entries only, never an uninspected preparation method.
- TOCs, introductions, unrelated sections and broken character-by-character
  ingredient extraction were downgraded to URL-only evidence. A radish soup,
  chicken-mushroom porridge, beef noodle salad or green-onion sauce does not
  establish the V2 cabbage soup, shrimp porridge, chicken amount or beef method.
- Rice-paper ingredients have no accepted method. Broccoli method widgets and
  an extracted instruction value of `1` are not method evidence. Bowl, bunch,
  slab, whole-fish, butter-stick and unqualified spoon measures are not converted.
- V1 hashes use Python sorted compact Unicode JSON, not the runtime catalog
  fingerprint. V2 hashes use exact source file bytes. Neither source is edited.
- Raw retrievals and extracted text remain in `/tmp/takolio-v3-research-15-25`;
  the 500-record compiled V1 snapshot remains in
  `/tmp/takolio-v3-v1-pilot-selfcheck.json`. These are optional verification
  inputs, not durable source copies or release artifacts. Without them the
  persistent check verifies repository integrity, but cannot recheck raw bytes.

Next action: complete source authority and whole-recipe V1/V2 comparisons,
resolve quantity/retention gaps, propose supported changes, obtain independent
culinary review. Root owns shared manifests, integration gates and state docs.

## Runnable deterministic self-check

Run from the repository root. Omit optional arguments when the temporary cache
is unavailable; output explicitly reports which hash checks ran. Locator checks
confirm an inspected section exists, not the semantic correctness of a claim.

```text
python3 -c 'from pathlib import Path; p=Path("docs/ai/recipe-intelligence-v3/research/BATCHES_15_25_RESEARCH.md"); exec(compile(p.read_text().split("<!-- BATCHES_15_25_SELF_CHECK_START -->\n```text\n",1)[1].split("\n```\n<!-- BATCHES_15_25_SELF_CHECK_END -->",1)[0],str(p),"exec"))' --v1-snapshot /tmp/takolio-v3-v1-pilot-selfcheck.json --source-cache /tmp/takolio-v3-research-15-25
```

<!-- BATCHES_15_25_SELF_CHECK_START -->
```text
import argparse
import hashlib
import json
import re
from collections import Counter
from datetime import datetime
from html.parser import HTMLParser
from pathlib import Path

parser = argparse.ArgumentParser()
parser.add_argument('--v1-snapshot', type=Path)
parser.add_argument('--source-cache', type=Path)
options = parser.parse_args()
root = Path.cwd()
base = root / 'data/recipe-intelligence/v3/research'
ledger = json.loads((root / 'docs/ai/recipe-intelligence-v3/batches/batch-ledger.json').read_text())
batches = {b['batchId']: b for b in ledger['batches']}
runtime = None
if options.v1_snapshot:
    snapshot = json.loads(options.v1_snapshot.read_text())
    runtime = {r['id']: r for r in snapshot}
    assert len(snapshot) == len(runtime) == 500


def digest(data):
    return hashlib.sha256(data).hexdigest()


def resolve(value, pointer):
    assert pointer.startswith('/')
    for part in pointer[1:].split('/'):
        token = part.replace('~1', '/').replace('~0', '~')
        value = value[int(token)] if isinstance(value, list) else value[token]
    return value


class StructuredRecipes(HTMLParser):
    def __init__(self, source):
        super().__init__()
        self.active = False
        self.buffer = []
        self.ingredients = []
        self.feed(source)

    def handle_starttag(self, tag, attrs):
        if tag == 'script':
            self.active = dict(attrs).get('type', '').lower() == 'application/ld+json'
            self.buffer = []

    def handle_data(self, data):
        if self.active:
            self.buffer.append(data)

    def handle_endtag(self, tag):
        if tag == 'script' and self.active:
            self.active = False
            try:
                self.walk(json.loads(''.join(self.buffer)))
            except json.JSONDecodeError:
                pass

    def walk(self, value):
        if isinstance(value, dict):
            entries = value.get('recipeIngredient')
            while isinstance(entries, list) and len(entries) == 1 and isinstance(entries[0], list):
                entries = entries[0]
            if isinstance(entries, list) and entries and all(isinstance(x, str) for x in entries):
                self.ingredients.append(entries)
            for child in value.values():
                self.walk(child)
        elif isinstance(value, list):
            for child in value:
                self.walk(child)


source_keys = set('sourceId url recipeIds retrievedAt httpStatus finalUrl contentType contentSha256 byteLength title author publishedAt metadataBasis evidenceStatus humanReview visibleTextSha256 error contentReviewLimit relevanceReview reviewedFacts'.split())
source_states = {'URL_DISCOVERED', 'URL_REACHABLE', 'SOURCE_CONTENT_READ', 'SOURCE_RELEVANCE_VERIFIED', 'SOURCE_UNAVAILABLE'}
all_ids, all_sources, all_claims = [], [], []
cache_raw, cache_text, cache_locators = set(), set(), set()
v1_count = 0
for number in range(15, 26):
    stem = f'batch-{number:02d}'
    evidence = json.loads((base / (stem + '-evidence.json')).read_text())
    edits = json.loads((base / (stem + '-edits.json')).read_text())
    batch = batches[f'v3-{number:02d}']
    recipes, sources = evidence['recipes'], evidence['sources']
    ids = [r['recipeId'] for r in recipes]
    assert ids == [r['recipeId'] for r in batch['recipes']]
    assert len(ids) == len(set(ids)) == 20
    assert evidence['schemaVersion'] == 1 and evidence['program'] == 'TAKOLIO_RECIPE_INTELLIGENCE_V3'
    assert evidence['dataset'] == f'recipe-refresh-v2-bounded-{stem}'
    assert evidence['status'] == 'RECIPE_V3_RESEARCH_IN_PROGRESS'
    assert evidence['pilotStatus'] == 'BOUNDED_SOURCE_INVENTORY_REVIEW_PENDING'
    assert evidence['humanReview'] == 'PENDING'
    assert evidence['sourcePromotionAllowed'] is evidence['runtimePromotionAllowed'] is False
    assert evidence['scope']['pilotRecipeCount'] == 20 and evidence['scope']['catalogRecipeCount'] == 500
    assert evidence['scope']['fullRecipeVerificationCompleted'] == 0
    assert edits == {'schemaVersion': 1, 'edits': []}
    source_by_id = {s['sourceId']: s for s in sources}
    assert len(source_by_id) == len(sources)
    for source in sources:
        sid = source['sourceId']
        assert set(source) <= source_keys
        assert sid == 'source-' + digest(source['url'].encode())[:16]
        assert source['url'].startswith(('http://', 'https://'))
        assert datetime.fromisoformat(source['retrievedAt'].replace('Z', '+00:00')).tzinfo
        assert source['humanReview'] == 'PENDING'
        assert source['author'] is source['publishedAt'] is None
        assert source['recipeIds'] and set(source['recipeIds']) <= set(ids)
        states = set(source['evidenceStatus'])
        assert len(states) == len(source['evidenceStatus']) and states <= source_states
        assert 'URL_DISCOVERED' in states
        assert ('URL_REACHABLE' in states) == (source['httpStatus'] is not None and 200 <= source['httpStatus'] < 300)
        assert ('SOURCE_UNAVAILABLE' in states) == ('URL_REACHABLE' not in states)
        assert ('SOURCE_RELEVANCE_VERIFIED' in states) == ('SOURCE_CONTENT_READ' in states)
        if 'SOURCE_CONTENT_READ' in states:
            assert source['httpStatus'] == 200
            review = source['relevanceReview']
            assert set(review) == {'status', 'scope', 'reviewerSummary', 'supportLimits'}
            assert review['status'] == 'AGENT_BOUNDED' and 'ingredient facts only' in review['scope']
            facts = source['reviewedFacts']
            assert len(facts) == len({f['factId'] for f in facts}) == 1
            for fact in facts:
                assert set(fact) == {'factId', 'locator', 'reviewerSummary', 'supportLimits'}
                assert 30 < len(fact['reviewerSummary']) < 340
                assert fact['locator'] and fact['supportLimits']
                assert fact['reviewerSummary'] == review['reviewerSummary']
        else:
            assert source['contentReviewLimit']
            assert not source.get('reviewedFacts') and not source.get('relevanceReview')
        if options.source_cache:
            key = sid.removeprefix('source-')
            if source['contentSha256'] is not None:
                raw = (options.source_cache / (key + '.html')).read_bytes()
                assert digest(raw) == source['contentSha256'], sid
                assert len(raw) == source['byteLength'], sid
                cache_raw.add(sid)
            if source.get('visibleTextSha256') is not None:
                text_bytes = (options.source_cache / (key + '.txt')).read_bytes()
                assert digest(text_bytes) == source['visibleTextSha256'], sid
                cache_text.add(sid)
            for fact in source.get('reviewedFacts', []):
                match = re.fullmatch(r'Visible text lines (\d+)-(\d+), ingredient section opening', fact['locator'])
                if match:
                    start, end = map(int, match.groups())
                    lines = text_bytes.decode().splitlines()
                    assert 1 <= start <= end <= len(lines), sid
                    assert any(lines[start - 1:end]), sid
                else:
                    assert fact['locator'] in {
                        'Recipe JSON-LD recipeIngredient opening entries 1-4; ingredient facts only',
                        'Recipe JSON-LD recipeIngredient nested array, opening entries; ingredient names only',
                    }
                    parsed = StructuredRecipes(raw.decode('utf-8', errors='replace'))
                    assert any(len(entries) >= 2 and all(len(x) > 1 for x in entries[:2]) for entries in parsed.ingredients), sid
                cache_locators.add((sid, fact['factId']))
    claims = []
    for index, recipe in enumerate(recipes):
        rid = recipe['recipeId']
        assert recipe['v1']['recordSha256'] == batch['recipes'][index]['beforeFingerprints']['v1']
        assert 'sort_keys=True' in recipe['v1']['recordSha256Algorithm']
        path = root / 'data/recipe-refresh/v2/recipes' / (rid + '.json')
        assert recipe['v2']['sourcePath'] == path.relative_to(root).as_posix()
        assert recipe['v2']['fileSha256'] == digest(path.read_bytes())
        data = json.loads(path.read_text())
        assert recipe['title'] == data['identity']['title']
        assert recipe['evidenceStatus'] == 'BOUNDED_SOURCE_INVENTORY_REVIEW_PENDING'
        assert recipe['humanReview'] == 'PENDING' and recipe['fullRecipeVerification'] == 'NOT_COMPLETE'
        assert recipe['sourcePromotionAllowed'] is False
        expected_sources = {'source-' + digest(s['url'].encode())[:16] for s in data['research']['sources'] if s['role'] == 'declared'}
        assert set(recipe['sourceIds']) == expected_sources == {s['sourceId'] for s in sources if rid in s['recipeIds']}
        assert len(recipe['sourceIds']) == len(set(recipe['sourceIds']))
        assert len(recipe['claims']) == len({c['id'] for c in recipe['claims']})
        internal = [c for c in recipe['claims'] if c['evidenceBasis'] == 'INTERNAL_V2_OBSERVATION']
        assert len(internal) == 1
        for claim in recipe['claims']:
            assert claim['reviewerSummary'] and claim['supportLimits']
            assert set(claim['sourceIds']) <= set(recipe['sourceIds'])
            assert claim['findingType'] != 'VARIANT_DIFFERENCE'
            for pos in claim['ingredientPositions']:
                assert data['ingredients'][pos]['position'] == pos
            for step in claim['stepNumbers']:
                assert data['steps'][step - 1]['stepNumber'] == step
            for pointer in claim['v2Pointers']:
                resolve(data, pointer)
                if pointer.startswith('/ingredients/'):
                    assert int(pointer.split('/')[2]) in claim['ingredientPositions']
                if pointer.startswith('/steps/'):
                    assert int(pointer.split('/')[2]) + 1 in claim['stepNumbers']
            refs = claim['sourceFactReferences']
            if claim['evidenceBasis'] == 'EXTERNAL_SOURCE_FACT':
                assert claim['status'] == 'SOURCE_CONTENT_READ' and claim['findingType'] == 'SOURCE_INGREDIENT_FACT'
                assert len(refs) == len(claim['sourceIds']) == 1
                assert not claim['ingredientPositions'] and not claim['stepNumbers']
                ref = refs[0]
                assert ref['sourceId'] == claim['sourceIds'][0]
                source = source_by_id[ref['sourceId']]
                assert 'SOURCE_CONTENT_READ' in source['evidenceStatus']
                fact = next(f for f in source['reviewedFacts'] if f['factId'] == ref['factId'])
                assert claim['reviewerSummary'] == fact['reviewerSummary']
            elif claim['evidenceBasis'] == 'INTERNAL_V2_OBSERVATION':
                assert claim['status'] == 'FACT_SUPPORTED' and claim['findingType'] == 'INTERNAL_V2_UNIT_BASIS_UNRESOLVED'
                assert not refs and not claim['sourceIds'] and claim['ingredientPositions']
                for pos in claim['ingredientPositions']:
                    q = data['ingredients'][pos]['quantity']
                    assert q['evidence'] in ('estimated', 'qualitative') or q['runtime'] is None
            else:
                assert claim['evidenceBasis'] == 'RETRIEVAL_ATTEMPT'
                assert claim['status'] == 'SOURCE_UNAVAILABLE' and claim['findingType'] == 'SOURCE_ACCESS_LIMIT'
                assert not refs and claim['sourceIds']
                assert all('SOURCE_UNAVAILABLE' in source_by_id[s]['evidenceStatus'] for s in claim['sourceIds'])
            claims.append(claim)
        if runtime is not None:
            payload = json.dumps(runtime[rid], ensure_ascii=False, sort_keys=True, separators=(',', ':')).encode()
            assert digest(payload) == recipe['v1']['recordSha256'], rid
            v1_count += 1
    summary = evidence['summary']
    assert summary == {
        'recipeCount': len(recipes), 'sourceAttemptCount': len(sources),
        'sourceStatusCounts': dict(Counter(s for row in sources for s in row['evidenceStatus'])),
        'claimCount': len(claims), 'claimStatusCounts': dict(Counter(c['status'] for c in claims)),
        'findingTypeCounts': dict(Counter(c['findingType'] for c in claims)),
        'humanApprovedCount': 0, 'fullRecipeVerificationCompleted': 0, 'productionMutations': 0,
    }
    all_ids.extend(ids)
    all_sources.extend(sources)
    all_claims.extend(claims)
assert len(all_ids) == len(set(all_ids)) == 220
assert len(all_sources) == 484 and len({s['sourceId'] for s in all_sources}) == 482
assert len(all_claims) == 481
assert Counter(c['evidenceBasis'] for c in all_claims) == {'INTERNAL_V2_OBSERVATION': 220, 'EXTERNAL_SOURCE_FACT': 175, 'RETRIEVAL_ATTEMPT': 86}
assert Counter(s for row in all_sources for s in row['evidenceStatus']) == {'URL_DISCOVERED': 484, 'URL_REACHABLE': 381, 'SOURCE_CONTENT_READ': 176, 'SOURCE_RELEVANCE_VERIFIED': 176, 'SOURCE_UNAVAILABLE': 103}
print(f'batches15-25-self-check=ok recipes=220 sources=484 uniqueSources=482 claims=481 edits=0 v1Hashes={v1_count} rawHashes={len(cache_raw)} textHashes={len(cache_text)} factLocators={len(cache_locators)}')
```
<!-- BATCHES_15_25_SELF_CHECK_END -->

## Executed checks

Executed 2026-10-26 UTC (Python 3.9): embedded self-check passed with `recipes=220 sources=484 uniqueSources=482 claims=481 edits=0 v1Hashes=220 rawHashes=447 textHashes=447 factLocators=175`. `git diff --check --` plus `git diff --no-index --check /dev/null <owned-file>` for all 23 owned files passed with no whitespace output. The integration owner separately owns shared audits and full repository gates.

Earlier checks: the initial locator assertion failed on `source-9e14e04e731be169`
because its ingredient entries are nested; the parser now unwraps that array,
the locator explicitly names it, and the fact remains ingredient names only.
The first whitespace harness treated the normal no-index new-file exit 1 as
a failure; the corrected harness checks diagnostic output and accepts exits
0 or 1. Earlier `node scripts/recipe-intelligence-v3-audit.mjs --check` failed
on stale generated coverage before integration; no shared outputs were changed
by this packet. No whole-recipe verification or release pass is claimed.


## Packet file SHA-256

| Batch | Evidence SHA-256 |
| --- | --- |
| 15 | `c9a25498f0cd5cee6ff13bab17a444eeae49aa346761d7f9c520c8bb10ddd6ab` |
| 16 | `a4edc72f415417cf863ad41c18335147892f95eb1b0db395ce1d3fc314ef5c7a` |
| 17 | `c5b4fe4b4d33e151b175b8e13fdfb08a479c5e9e7913bebbd6c64560002241c9` |
| 18 | `47815a3ca36e005cb31d5081668263bdcf529a1b755ddaf58b739525145a6588` |
| 19 | `f651c84cf7d4d63f18d259581cb6ee6b0484a452908d4499ade1104c5cfd4989` |
| 20 | `1de55c4d9d0402095b35cdb12c73e8852784fee1697447c429a2c12a61a24810` |
| 21 | `939cc5d417f8a77d6f6036e71d4a82d938270d2ebc5bca4fd68ffe01d4ed421e` |
| 22 | `e35d2913b7ba5054920b80e09f4fa4c39efc2a5bb0ebc0f076916ab4e7f1f479` |
| 23 | `63dc19f9b9f7453685a9886f0e3d84f7a280dd3f0ff37d7e145e4617c01e7fa8` |
| 24 | `d6b9449230de34e57c2ce96fec0a488a99a1578f3bf6f34207d0c54d020e8a16` |
| 25 | `bccf155ca980a85ddbe7d44c878a1d89914cde607efbf73f2bf705e4b8e8c602` |

All eleven empty edits files share SHA-256 `bcc3b7038d7f5a0795a33a8bead0419a91581d699b33e29a33759b60495a2f45`.
