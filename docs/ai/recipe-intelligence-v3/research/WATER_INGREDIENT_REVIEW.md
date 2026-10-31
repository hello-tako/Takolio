# Water ingredient review

Status: `NEEDS_HUMAN_REVIEW`; no mapping, content or runtime change. This is a
read-only analysis of the V2 files pinned by `data/recipe-refresh/v2/manifest.json`.

`ING_ENR_572914FFD2108D59` appears on 204 ingredient lines in 198 recipes.
Five lines explicitly describe an alternative or mixture involving stock:

| Recipe file and JSON pointer | Source name |
|---|---|
| `data/recipe-refresh/v2/recipes/imp-6118e8aa010584af.json:124` `#/ingredients/2` | Nước lọc (hoặc nước dùng gà) |
| `data/recipe-refresh/v2/recipes/imp-f4665d594d941e4a.json:238` `#/ingredients/5` | Nước (nước luộc gà + nước lọc) |
| `data/recipe-refresh/v2/recipes/imp-b8d2cb0b37dbdb81.json:198` `#/ingredients/4` | Nước lọc (hoặc nước dùng rau củ) |
| `data/recipe-refresh/v2/recipes/imp-e47b2f01ee81031a.json:552` `#/ingredients/14` | Nước lọc (hoặc nước dùng rau củ) |
| `data/recipe-refresh/v2/recipes/imp-2b289d9040d46110.json:303` `#/ingredients/7` | Nước (hoặc nước dùng rau củ) |

These five lines are **not** evidence that all 204 lines are wrong. The exact
stock composition and the proportions of the mixture are not established by
these names. Before identity, shopping or nutrition promotion, review each source
and retain its alternative or mixture semantics; do not assume stock is water or
assign a stock composition from the shared ID. Stock-related text describing the
*purpose* of plain water alone is not classified as an alternative.

Reproduce from the repository root (Python standard library only):

```sh
python3 - <<'PY'
import hashlib
import json
from pathlib import Path

base = Path('data/recipe-refresh/v2')
manifest = json.loads((base / 'manifest.json').read_text())
for entry in manifest['fileHashes']:
    assert hashlib.sha256((base / entry['path']).read_bytes()).hexdigest() == entry['sha256'], entry['path']
rows = []
for recipe_id in manifest['orderedRecipeIds']:
    recipe = json.loads((base / 'recipes' / (recipe_id + '.json')).read_text())
    for index, ingredient in enumerate(recipe['ingredients']):
        if ingredient['canonicalIngredientId'] == 'ING_ENR_572914FFD2108D59':
            rows.append((recipe_id, index, ingredient['sourceName']))
selected = [row for row in rows if 'hoặc' in row[2].casefold() or 'nước luộc gà +' in row[2].casefold()]
assert len(rows) == 204 and len({row[0] for row in rows}) == 198
assert len(selected) == 5
print('water_group_lines=204 recipes=198 selected_alternative_or_mixture_lines=5')
for recipe_id, index, name in selected:
    print(f'{recipe_id}#/ingredients/{index}: {name}')
PY
```

The filter reproduces these five literal observations; it is not a complete
semantic classifier for alternatives or mixtures. Review the remaining group
individually before drawing broader conclusions.
