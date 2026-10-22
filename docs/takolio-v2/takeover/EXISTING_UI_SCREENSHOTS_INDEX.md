# Existing UI screenshot index

The historical salvage checkpoint local run (before UI-C5) produced 49 PNGs: 35 route/state captures, eight Home viewport/text-scale captures, one icon capture, two cooking completion states, two scan upload states and one planner pending state. They and available JSON companions are copied to `evidence/current/`; SHA-256, dimensions and byte counts are in `evidence/current-evidence-manifest.json`. All images use synthetic data.

`SCREEN_PROGRESS.csv` maps all 38 rows to evidence: 37 synthetic state captures and one splash row represented by `/landing`. A distinct splash is not implemented or certified. Route render assertions are separated from functional assertions; a screenshot alone is not behavioral certification or owner approval. The planner/Week rows exercise planner ON only; OFF compatibility code remains byte-identical to main.

Before/after evidence is in `evidence/current/icon-sizing/`: main has a failing screenshot without numerical JSON; WIP and integration RED measured 114.984375px metadata icons. The corrected integration measures 14-16px and passes the <=24px guard. The selector change is confined to recipe-media wrappers.

Useful review files:

- `current/home.png`, `current/home-320x420-text2.png`, `current/home-1440x900-text1.png`
- `current/recipes.png`, `current/recipe-detail.png`, `current/recipe-steps.png`, `current/cook.png`
- `current/planner-generating.png`, `current/scan-processing.png`, `current/scan-after-upload.png`
- `current/cooking-complete.png`, `current/cooking-complete-saved.png`
- `current/icon-sizing/{main,wip,integration}.png`

The new pending/completion screenshots were inspected visually. Owner visual acceptance remains pending. No reference mockup crops were shipped as application assets.

## UI-C5 recipe filters

`evidence/recipe-filters/manifest.json` pins main `90b94129` and hashes 28 files. Before/after screenshots cover eight viewport/text-scale settings, with eight after axe reports (zero violations). Additional evidence shows collapsed filters, empty results, long search at text200% and the real local discovery behavior summary.

Useful after files: `recipe-filters/after/filters-390x844-text1.png`, `recipe-filters/after/filters-320x420-text2.png`, `recipe-filters/after/filters-1440x900-text1.png`, `recipe-filters/after/filters-long-search-text2.png`. Paths here are relative to evidence/. SCREEN_PROGRESS row 18 now points to the new mobile capture and records actual filter/search/pagination/URL/focus checks. Other historical captures remain intact. Owner acceptance remains pending; root-font scaling is not physical-device certification.

## UI-C5 saved recipes

`evidence/saved-recipes/manifest.json` pins main `90b94129` and hashes 56 files: 37 PNGs, 17 zero-violation axe JSONs and persistence/handoff summaries from the real isolated API. `before/saved-tab.png` and `before/saved-handoff.png` precede the servings fix; the 16 responsive before images are after that fix and before the scoped layout fix. After evidence is from the final verified-paired run. Both phases are explicit in the manifest.

Useful review files relative to evidence/:

- `saved-recipes/after/collection-390x844-text1.png`
- `saved-recipes/after/collection-320x420-text2.png`
- `saved-recipes/after/handoff-320x420-text2.png`
- `saved-recipes/after/collection-1440x900-text1.png`
- `saved-recipes/after/persistence-summary.json`, `saved-recipes/after/handoff-summary.json`

The narrow text200% before/after pair shows the clipped action corrected by flexible button height and the close icon protected from shrinking. SCREEN_PROGRESS row 19 points to the new mobile capture, with actual save/remove/reload/search/servings, keyboard and responsive coverage. Owner visual acceptance remains pending; the captures use synthetic data and root-font scaling.
