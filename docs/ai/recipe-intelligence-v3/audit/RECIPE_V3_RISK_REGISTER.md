# Recipe V3 risk register

Baseline: `b49f3e6c4fc2f1485b77623ed7257d0f8bd31f9a`. Status describes local
source evidence. OPEN does not mean the existing V1 path is newly broken; it
means the stated V3 publication/acceptance condition is not yet met.

Priority: P0 blocks V3 content promotion; P1 requires compatibility work before
integration; P2 requires explicit coverage/review evidence. Production mutation,
flag changes, release, auth/payment and inventory authority are outside scope.

| ID | Priority / state | Concrete trigger and impact | Existing mitigation | Required closure / owner | Evidence |
| --- | --- | --- | --- | --- | --- |
| R01 | P0 OPEN | V2 projection drops 2996/6766 ingredient lines; 2860 need reviewed transformation. Publishing that projection loses source meaning and may understate shopping/cooking requirements | Release compiler blocks; full canonical source retained | Lossless candidate representation plus line-level transformation/review evidence; compiler/ingredient owner | `packages/recipes/src/refresh/compiler.ts:23`, `:39`, `data/recipe-refresh/v2/manifest.json:1` |
| R02 | P0 OPEN | 1395 distinct provisional `ING_ENR_` IDs are not reviewed canonical authority. Name-only promotion can connect wrong inventory/allergen identities | Explicit target/basis/evidence schema, collision checks, release rejection | Reviewed registry reconciliation for every candidate line; unresolved stays blocked; ingredient owner | `packages/recipes/src/ingredient-authority-v2.ts:6`, `:26`, `:46`, `packages/recipes/src/refresh/release.ts:138` |
| R03 | P0 OPEN | Source URLs have structural checks but zero content-verified URLs. HTTP 200 or Recipe JSON-LD alone cannot establish same dish, claim support or permission to reproduce | Source blocker remains active; research isolated from runtime | Record actual retrieval, relevance and claim review separately; human review queue; research owner | `data/recipe-refresh/v2/manifest.json:1`, `packages/recipes/src/refresh/release.ts:84` |
| R04 | P0 OPEN | V2 nutrition has 1 publishable, 288 blocked, 211 null. Treating legacy macros or proxy estimates as certified invents evidence | Nullable/blocked profiles; version-aware trusted evidence query; compiler omits blocked values | Preserve null/blocked and basis/provenance; resolve evidence before claim; nutrition owner | `packages/recipes/src/refresh/compiler.ts:71`, `:94`, `packages/db/src/ranking-nutrition.ts:133`, `migrations/0034_global_recipe_catalog_parity.sql:8` |
| R05 | P0 OPEN | Replacing any static71 content in current D1 breaks legacy-prefix readiness; changing manifest alone does not waive equality | Full count/ID/order/prefix/hash checks fail closed | Additive/versioned release architecture and rollback proof; runtime/architecture owner | `packages/recipes/src/recipe-authority.ts:165`, `:183`, `:196` |
| R06 | P1 OPEN | Active cooking UI holds an older Recipe while complete independently resolves current recipe; history lacks content version. Publication can change unit interpretation of legacy missing-unit payloads or current restriction decisions | Client freezes explicit deductions/servings; hard restrictions and atomic/idempotent inventory fences remain | Add backward-compatible content handle/snapshot and stale-publication policy; preserve exact legacy payload replay; cooking/runtime owner | `src/web/stores/useCookingStore.ts:69`, `:149`, `src/worker/routes/recipes.ts:137`, `:339`, `:380`, `:424` |
| R07 | P1 OPEN | Composition/family component persists recipe ID but renderer reads current recipe title/time/content, so historical rendering can drift across publication | Parent authority changes block edits; source snapshots and shopping freshness fences exist | Bind component rendering to saved revision/snapshot, retaining old decoder; planner/runtime owner | `packages/db/src/meal-composition.ts:45`, `src/worker/services/meal-composition.ts:295`, `:345`, `:963` |
| R08 | P1 OPEN | Older Week rows lacking embedded recipe resolve current authority; content replacement can alter that legacy historical view | Exact embedded saved response preferred; request/revision receipts preserved | Version-aware legacy fallback or documented migration/unknown provenance; Week compatibility owner | `src/worker/services/week-read.ts:128`, `:144`, `migrations/0045_week_swap_receipts.sql:1` |
| R09 | P1 OPEN | Ingredient detail's related-recipe section imports static71 directly during normal online usage; imported429 never appear | Main recipe API/discovery use resolved authority correctly | Replace this recipe-scoped lookup using shared authority; verify ID/name matching without inventory mutation changes; web recipe owner | `src/web/pages/IngredientDetailPage.tsx:19`, `:212`, `:591`, `:607` |
| R10 | P1 OPEN | Shopping demand stores exact quantities/titles but no immutable content handle. A future V3 reproject implementation could overwrite old intent if existing fences are removed | Current catalog drift blocks share; transaction witnesses, review fingerprints, preserved overrides, idempotent receipts | Preserve all fences and add provenance binding; prove old demand unchanged after publication; shopping/runtime owner | `src/worker/services/shopping-plan.ts:33`, `:56`, `:72`, `:100`, `:112`, `src/worker/services/meal-composition.ts:972` |
| R11 | P2 OPEN | Imported429 have no device-static detail/recommendation coverage; catalog switches invalidate discovery cursors | Genuine-offline-only fallback and explicit `device:static` cursor fingerprint | Define compatible offline content/version cache only if required; test explicit unavailable behavior now; web recipe owner | `src/web/services/recipes.ts:49`, `:78`, `src/web/services/recipe-discovery.ts:48`, `:52` |
| R12 | P1 DEPENDENCY | Cache-poisoned JS MIME incident and pending release verification can invalidate browser recipe acceptance even when local build passes | Repair merged at audited baseline; separate recovery program owns production release | Exact deployed SHA/cache recovery/browser evidence from release owner; do not modify recovery under this task | `docs/ai/CURRENT_STATE.md:1`, `public/sw.js:1`, `:90` |
| R13 | P2 OPEN | Local manifest/hash/certification can be misread as current live production flags, physical row lineage, deployment or culinary approval | Current docs distinguish local, historical and production evidence | Same-SHA operator/staging evidence; retain unobserved state explicitly; release owner | `docs/ai/recipe-catalog/T14F_C_500_CATALOG_CERTIFICATION.md`, `docs/ai/recipe-catalog/T21RA_RUNTIME_CANONICAL_AUTHORITY_CERTIFICATION.md`, `src/worker/services/recipe-authority.ts:87` |
| R14 | P1 OPEN | New content exposes unknown ingredient/allergen/dietary metadata; missing tags could be mistaken for safe classifications | Hard restrictions fail closed; reviewed-role provenance distinct from AI confidence | Review candidate safety separately; keep unknown states and current hard-restriction gates; safety/ingredient owner | `src/worker/routes/recipes.ts:339`, `src/worker/services/meal-composition.ts:796`, `migrations/0039_meal_composition_v2.sql:61` |
| R15 | P2 OPEN | Media availability/version or recipe ID continuity may be confused with license and culinary evidence | Ready media key/hash immutable; MIME/length checked; fallback maintained | Preserve IDs/current media boundary; review rights independently; media/release owner | `src/worker/routes/recipe-media.ts:46`, `:90`, `:106`, `migrations/0035_recipe_media_layer.sql:67` |

## Boundaries that already protect users

- Planner V1 saves requirements/instructions and detects source/catalog drift.
  A content publication is not permission to mutate saved results.
- Composition shopping rejects catalog freshness changes; only narrowly allowed
  elapsed/inventory/history reasons permit reprojection. Unknown demand remains
  unknown, not quantity 1. Saved contributions and overrides persist.
- Cooking explicit deductions stay client-frozen. R06 does not assert that a
  publication silently changes those exact amounts. Preserve FEFO, household
  checks, revision authority, atomicity, idempotency and queued-body equality.
- Favorites retain recipe identity and unavailable display. Current display is
  intentionally refreshed; do not force every favorite to an old recipe version.
- Server fallback to static71 is deliberate and bounded. It reduces visibility;
  it does not authorize loading blocked V2 research as an alternate fallback.

## Required review scenarios

| Scenario | Expected evidence before closure |
| --- | --- |
| Old V1 saved plan after V3 publication | Stored result unchanged; explicit stale/revalidation status |
| Old shopping list after publication | Quantities, overrides, checked state and source contribution unchanged |
| Old active cooking and queued command | Displayed revision resolved explicitly; exact request replay retained |
| Legacy missing-unit cooking request | Existing safe unit behavior preserved; ambiguity cannot silently convert |
| Old Week row without embedded recipe | Defined fallback/provenance behavior; no saved-plan deletion |
| Catalog rollback | Prior content readable; favorites/plans/shopping/history retained |
| Imported recipe offline | Explicit unavailable or verified saved snapshot; no fabricated static match |
| Source URL 200 / unrelated Recipe schema | Remains pending relevance/claim review; no content verification claim |
| Unknown nutrition / allergen | Null/unknown state preserved; hard restrictions remain fail closed |
| Media missing | Recipe content usable with existing fallback |
| Ingredient related-recipe section | Same authority universe as main online recipes |
| Cache recovery dependency | Browser evidence linked to actual deployed SHA; local test is not substitute |

## Audit completion limit

The authority matrix, consumer map and this risk register are forensic artifacts.
They do not close the four V2 release blockers or certify any 500-recipe culinary
review. Exact executed validation belongs in the program checkpoint. No production
operation was executed for these documents.
