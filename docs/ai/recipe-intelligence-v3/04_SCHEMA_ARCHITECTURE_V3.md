# V3 schema architecture

V3 candidates remain a review-only sidecar. ADR-075 adds the cooking compatibility
foundation; it does not replace the runtime catalog or publish candidate content.

## Candidate envelope

Each candidate retains stable recipeId/slug, V1/V2 fingerprints, candidate
schema/content identity, complete ingredients/steps, reconciliation/quantity and
source evidence, nutrition state, explicit projection exclusions and review state.
The existing V2 model remains the candidate source; V3 adds deterministic audit
and review artifacts rather than another runtime recipe model.

## Accepted runtime boundary

Migration0046 adds immutable validated RuntimeRecipe content keyed by single-recipe
SHA256, household grants and nullable immutable cooking receipt references.
Detail/start archive trusted unscaled pre-media content. Household grants follow
allowed authority; another household's canary archive grants no access.
Legacy receipt NULL stays unknown. Apply0046 before the new Worker.

The archive contains runtime content, not all classification/nutrition/planning
evidence. It cannot replace the current catalog/authority freshness fences.
Saved planner/composition/shopping pinning and version-aware recovery remain
prerequisites for changed-content promotion. Later additive schema work requires
its own ADR, migration/integrity checks and hosted recovery evidence.

Local0046 replay, populated legacy preservation, local D1 and exact schema checks
are recorded in22_COOKING_FOUNDATION_VALIDATION.md. No remote migration occurred.
