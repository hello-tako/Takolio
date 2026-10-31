# V3 schema architecture

V3 candidates remain a review-only sidecar. ADR-075/076/077/078 implement
saved-content compatibility; they do not publish candidate content.

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
Legacy receipt NULL stays unknown. Apply0046 before the new Worker, including
standalone V1 generation with composition flags OFF.

Migration0047 adds saved composition pins. ADR-077 retains standalone V1 pins in
existing result JSON; matching family/composed anchors inherit component pins.
ADR-078 retains those identities in existing shopping contribution JSON. No
backfill infers old content, and shopping reads never recalculate saved demand.
Changed contribution pins invalidate review while selected purchases/history
survive. Existing receipt-first replay and historical-computation fences remain.

The archive contains runtime content, not all classification/nutrition/planning
evidence. It cannot replace current catalog/authority freshness fences. Existing
recipe-content=1 negotiation preserves old strict DTOs. Older strict Workers and
cached clients cannot parse pinned JSON; recovery requires the certified same-source
version-aware Worker/client with paired flags OFF. Retain0046/0047 and user data.

Local evidence:22_COOKING_FOUNDATION_VALIDATION.md,
23_SAVED_CONTENT_VALIDATION.md,24_V1_SAVED_CONTENT_VALIDATION.md and
25_SAVED_SHOPPING_VALIDATION.md. Approved publication, same-source hosted recovery,
mixed-client certification and independent review remain release prerequisites.
No remote migration or deployment follows from local validation.
