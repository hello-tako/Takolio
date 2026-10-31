#!/usr/bin/env python3
"""Read-only strict ingredient audit. Run with --write once, then without it to verify."""
import argparse
import ast
import collections
import hashlib
import json
import pathlib
import re
import unicodedata

ROOT = pathlib.Path(__file__).resolve().parents[1]
REPORT = ROOT / 'docs/ai/recipe-intelligence-v3/manifests/ingredient-exact-audit.json'
REGISTRY = 'packages/domain/src/index.ts'
BASE = 'data/recipe-refresh/v2/'


def digest(data):
    return hashlib.sha256(data).hexdigest()


def stable(value):
    return json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(',', ':')).encode()


def normalized(value):
    return ' '.join(unicodedata.normalize('NFKC', value).casefold().split())


def audit(root):
    source = (root / REGISTRY).read_text()
    marker = 'export const CANONICAL_INGREDIENTS: CanonicalIngredient[] = '
    assert source.count(marker) == 1
    literal = source.split(marker, 1)[1].split('\n];', 1)[0] + '\n]'
    literal = re.sub(r'^\s*//.*$', '', literal, flags=re.M)
    literal = re.sub(r'(?m)^(\s*)(\w+):', r'\1"\2":', literal)
    # Only the existing, static literal is parsed; no TypeScript is executed.
    catalog = ast.literal_eval(literal)
    assert len(catalog) == 45
    assert len({row['id'] for row in catalog}) == len(catalog)
    registry_index = collections.defaultdict(list)
    for row in catalog:
        assert set(row) == {'id', 'nameVi', 'nameEn', 'aliases', 'category', 'defaultUnit', 'defaultShelfLifeDays', 'icon'}
        assert not row['id'].startswith('ING_ENR_')
        for field in ('nameVi', 'nameEn', 'aliases'):
            values = row[field] if field == 'aliases' else [row[field]]
            for value in values:
                assert isinstance(value, str) and value
                registry_index[normalized(value)].append((row['id'], field, value))

    manifest = json.loads((root / (BASE + 'manifest.json')).read_text())
    reconciliation = json.loads((root / (BASE + 'ingredient-reconciliation.json')).read_text())
    assert manifest['recipeCount'] == len(manifest['orderedRecipeIds']) == 500
    assert len(set(manifest['orderedRecipeIds'])) == 500
    verified_files = []
    for row in manifest['fileHashes']:
        path = BASE + row['path']
        actual = digest((root / path).read_bytes())
        assert actual == row['sha256'], path
        verified_files.append({'path': path, 'sha256': actual})
    assert len(verified_files) == len({row['path'] for row in verified_files}) == 503

    groups = collections.defaultdict(lambda: {'reconciliation': [], 'ingredients': []})
    resolution_counts = collections.Counter()
    for i, row in enumerate(reconciliation):
        resolution_counts[row['resolution']] += 1
        if row['canonicalId'].startswith('ING_ENR_'):
            groups[row['canonicalId']]['reconciliation'].append({
                'sourceName': row['sourceName'], 'canonicalName': row['canonicalName'],
                'resolution': row['resolution'], 'pointer': BASE + 'ingredient-reconciliation.json#/' + str(i),
            })
    line_count = 0
    for recipe_id in manifest['orderedRecipeIds']:
        path = BASE + 'recipes/' + recipe_id + '.json'
        recipe = json.loads((root / path).read_text())
        assert recipe['identity']['id'] == recipe_id
        for i, ingredient in enumerate(recipe['ingredients']):
            assert ingredient['position'] == i
            line_count += 1
            if ingredient['canonicalIngredientId'].startswith('ING_ENR_'):
                groups[ingredient['canonicalIngredientId']]['ingredients'].append({
                    'recipeId': recipe_id, 'sourceName': ingredient['sourceName'],
                    'pointer': path + '#/ingredients/' + str(i),
                })
    assert line_count == 6766
    assert len(reconciliation) == 2515
    assert len(groups) == 1395
    evidence = []
    exact_hits = []
    top_impacts = []
    for ingredient_id, group in sorted(groups.items()):
        assert group['reconciliation'] and group['ingredients'], ingredient_id
        source_names = sorted({row['sourceName'] for rows in group.values() for row in rows})
        canonical_names = sorted({row['canonicalName'] for row in group['reconciliation']})
        for name in sorted(set(source_names + canonical_names)):
            for target in registry_index.get(normalized(name), []):
                exact_hits.append({'provisionalId': ingredient_id, 'sourceName': name, 'target': target})
        recipe_ids = sorted({row['recipeId'] for row in group['ingredients']})
        evidence.append({'provisionalId': ingredient_id, 'sourceNames': source_names,
                         'canonicalNames': canonical_names, 'recipeIds': recipe_ids, **group})
        top_impacts.append({'provisionalId': ingredient_id, 'sourceNames': source_names,
                            'ingredientLines': len(group['ingredients']), 'recipes': len(recipe_ids),
                            'reconciliationRows': len(group['reconciliation'])})
    assert not exact_hits
    assert sum(len(g['ingredients']) for g in groups.values()) == 4233
    assert sum(len(g['reconciliation']) for g in groups.values()) == 2004
    assert resolution_counts['provisional_new_canonical_id'] == 1642
    top_impacts.sort(key=lambda row: (-row['ingredientLines'], row['provisionalId']))
    basil_id = 'ING_ENR_0121EB2200008912'
    basil = next(row for row in evidence if row['provisionalId'] == basil_id)
    assert any('Thai basil' in name for name in basil['sourceNames'])
    assert any('holy basil' in name for name in basil['sourceNames'])
    direct_hashes = {path: digest((root / path).read_bytes()) for path in
                     (REGISTRY, BASE + 'manifest.json', BASE + 'ingredient-reconciliation.json')}
    return {
        'schemaVersion': 1,
        'scope': 'CANDIDATE_ONLY_EXACT_EXISTING_REGISTRY_AUDIT',
        'humanReview': 'PENDING', 'promotion': False, 'approvedDecisions': 0,
        'normalization': 'Unicode NFKC; casefold; whitespace collapse only',
        'excludedTransforms': ['accent stripping', 'context stripping', 'punctuation stripping',
                               'species/form substitution', 'fuzzy matching', 'invented synonyms'],
        'conclusion': 'No exact canonical name/alias matches. All 1395 provisional IDs remain unresolved; no mappings proposed.',
        'counts': {
            'registryIngredients': len(catalog), 'registryNormalizedKeys': len(registry_index),
            'recipes': 500, 'ingredientLines': line_count,
            'provisionalIds': len(groups), 'provisionalIngredientLines': 4233,
            'recipesWithProvisionalIngredients': len({r['recipeId'] for g in groups.values() for r in g['ingredients']}),
            'reconciliationRows': len(reconciliation), 'provisionalIdReconciliationRows': 2004,
            'provisionalNewReconciliationRows': 1642, 'provisionalDuplicateAliasReconciliationRows': 362,
            'exactMatches': 0, 'ambiguousExactMatches': 0, 'noExactMatchIds': 1395,
        },
        'sourceHashes': direct_hashes,
        'transitiveSourceHashes': {
            'pointer': BASE + 'manifest.json#/fileHashes',
            'verifiedFileCount': len(verified_files), 'verifiedRecipes': 500,
            'expandedPathHashListSha256': digest(stable(sorted(verified_files, key=lambda row: row['path']))),
        },
        'coverage': {
            'sortedProvisionalIdsSha256': digest(stable(sorted(groups))),
            'perIdNamesOccurrencesRecipesAndPointersSha256': digest(stable(evidence)),
            'description': 'Self-check reconstructs every ID, exact source name, canonical name, reconciliation pointer, recipe ingredient pointer and impact count in memory; all source bytes pinned by the hashes above.',
            'ingredientLineHistogram': dict(sorted(collections.Counter(len(g['ingredients']) for g in groups.values()).items())),
        },
        'largestImpacts': top_impacts[:10],
        'ambiguityExample': {
            'provisionalId': basil_id, 'state': 'NEEDS_HUMAN_REVIEW',
            'reason': 'One provisional ID contains labels Thai basil and holy basil. Preserve the labels and review their species identities before any grouping decision.',
            'sourceNames': basil['sourceNames'], 'ingredients': basil['ingredients'],
            'reconciliation': basil['reconciliation'],
            'humanReview': 'PENDING', 'promotion': False,
        },
        'candidates': [],
    }


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--root', type=pathlib.Path, default=ROOT)
    parser.add_argument('--report', type=pathlib.Path, default=REPORT)
    parser.add_argument('--write', action='store_true')
    args = parser.parse_args()
    result = audit(args.root)
    # Exercise Unicode equivalence while protecting meaningful differences.
    assert normalized('  CA\u0300 CHUA\t') == normalized('Cà chua')
    assert normalized('cà') != normalized('ca')
    assert normalized('gạo') != normalized('cơm')
    assert normalized('Xì dầu (chấm kèm)') != normalized('Xì dầu')
    if args.write:
        args.report.write_text(json.dumps(result, ensure_ascii=False, indent=2) + '\n')
    else:
        expected = json.loads(args.report.read_text())
        assert json.loads(json.dumps(result)) == expected, 'report/source drift'
    print('ingredient-exact-audit=ok registry=45 recipes=500 lines=6766 provisionalIds=1395 provisionalLines=4233 exact=0 noExact=1395 humanReview=PENDING promotion=false')


if __name__ == '__main__':
    main()
