# Beef identity candidate quarantine - 2026-10-31 JST

Status: candidate correction implemented under ADR-080; NEEDS_REVIEW.
Compiler2 demotes the12contradictory inherited BEEF_SIRLOIN lines together:
canonicalIngredientId=NULL,reconciliation=ambiguous,new explicit reason.
No replacement mapping or human approval is asserted. Original labels,amounts,
roles,nutrition and steps remain intact; immutable V2 retains the original ID.
The runtime registry,V1 authority,public consumers and database are unchanged.

Current candidate SHA256:
7c0b8b3840c4f72dd724737d2066946f04e07c8fe8631d5bc937d87c172466df.
500recompilations/85exact edit reversals/488unchanged content records PASS;
full local check436files/9754tests PASS exit0. Exact commands and limitations:
[14_TEST_STRATEGY.md](../14_TEST_STRATEGY.md). Four release gates remain blocked.
The following read-only investigation is preserved as the historical baseline;
its no-candidate-change statement describes the earlier checkpoint only.

---

# Beef identity review

Status: `NEEDS_HUMAN_REVIEW`; no mapping, candidate, runtime or database change.

The shared registry names `BEEF_SIRLOIN` as Vietnamese `Thịt bò`, English `Beef
sirloin`, and includes `bắp bò` among its aliases (`packages/domain/src/index.ts`,
starting at line 90). Those labels do not specify the same cut. This pre-existing
ambiguity is not resolved by the V2 status `existing_canonical_id`.

The pinned V2 files contain 12 lines across 12 recipes with this ID. Four names
say `Thịt thăn bò`, two say `Bắp bò`, four say generic `Thịt bò` or `Thịt bò
thái lát`, and two name shoulder/neck or allow shoulder/chuck as an alternative
to sirloin. All 12 have positive measured runtime quantities and are marked
shopping inputs, and meet the source-field preconditions of
`runtimeIngredientFromSource` (`packages/recipes/src/refresh/compiler.ts`). This
is potential V2 projection behavior, not proof that V2 was published.

The existing V1 source also uses this ID with broader text: `vn-lau-01` contains
`Bắp bò hoa thái lát mỏng nhúng lẩu` and `vn-bun-04` contains `Thịt bò tái chần
mềm` (`packages/recipes/src/vietnamese-bank.ts`). Both IDs are in the current V1
release manifest. This establishes the source-level ambiguity in V1, but does not
establish live production stock, actual shopping results, or the deployed SHA.
V1 and V2 amounts, optionality and descriptions differ; do not infer that one
version represents the other.

Review the specific intended cut and valid substitution semantics for each line,
the existing registry's intended breadth, and affected inventory, shopping and
nutrition consumers before any change. Do not relabel generic beef, shoulder, neck
or shank as a specific cut by assumption. Retain old IDs and source labels until a
reviewed compatibility and migration plan exists. The gate remains blocked.

Reproduce the V2 count, exact lines and source fingerprint from repository root:

```sh
python3 - <<'PY'
import hashlib
import json
from pathlib import Path

base = Path('data/recipe-refresh/v2')
manifest = json.loads((base / 'manifest.json').read_text())
assert len(manifest['orderedRecipeIds']) == len(set(manifest['orderedRecipeIds'])) == 500
for entry in manifest['fileHashes']:
    assert hashlib.sha256((base / entry['path']).read_bytes()).hexdigest() == entry['sha256'], entry['path']
rows = []
for recipe_id in manifest['orderedRecipeIds']:
    recipe = json.loads((base / 'recipes' / (recipe_id + '.json')).read_text())
    for index, item in enumerate(recipe['ingredients']):
        if item['canonicalIngredientId'] == 'BEEF_SIRLOIN':
            runtime = item['quantity']['runtime']
            assert item['reconciliation'] == 'existing_canonical_id'
            assert item['includeInShopping'] and runtime and runtime['amount'] > 0
            assert not (item['usageRole'] in ('process_only', 'mixed_process')
                        and item['quantity']['kind'] == 'measured'
                        and item['quantity']['evidence'] == 'estimated')
            rows.append((recipe_id, index, item['sourceName']))
assert len(rows) == len({row[0] for row in rows}) == 12
from collections import Counter
names = Counter(row[2] for row in rows)
assert names == {'Thịt thăn bò': 4, 'Bắp bò': 2, 'Thịt bò thái lát': 3,
                 'Thịt bò': 1, 'Thịt bò (nạc vai/chuck hoặc thăn, thái lát mỏng)': 1,
                 'Thịt bò (nạc vai/cổ bò, thái khối)': 1}
print('v2_beef_sirloin_lines=12 recipes=12 manifest_files_verified=' + str(len(manifest['fileHashes'])))
for recipe_id, index, name in rows:
    print(f'{recipe_id}#/ingredients/{index}: {name}')
PY
```

This check verifies the pinned V2 inputs and exact observed fields; it does not
independently prove culinary equivalence or execute the TypeScript compiler.
