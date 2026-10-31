# Content versioning design

Stable `recipeId` and `slug` remain separate from immutable content identity.
ADR-075 implements cooking, ADR-076 saved compositions and ADR-077 standalone
V1 selections. ADR-072 still governs candidate publication.

Migration `0046_recipe_content_versions.sql` adds a server-owned RuntimeRecipe
archive keyed by the existing single-recipe SHA256, household access grants,
and nullable content/request references on durable cooking receipts. Detail and
start capture trusted, unscaled content before media enrichment. The response
exposes `contentFingerprint` outside Recipe; scaling servings cannot change it.
The cooking store freezes the fingerprint with the command and offline body.

Completion reads the household-authorized archive or an exact current match.
A committed retry is resolved before consulting the mutable catalog. Legacy
NULL references stay unknown; fixed V1 baseline or unambiguous receipt units
support old retries. Unknown aliases and ambiguous omitted units fail closed.
New unversioned commands are limited to the two fixed V1 catalog fingerprints.

Migration0047 pins saved composition components. ADR-077 stores optional nullable
pins in existing V1 result JSON without another migration. New recipe selections
capture the unscaled authority snapshot and household access. Composed/family
anchors inherit their component's pin, including legacy NULL; family variants
remain NULL. Swaps retain unchanged selections. Explicit V1 regeneration selects
current content and drops stale known locks even if provenance.version is equal.
Read-time V1 composition projections resolve household-authorized archives.

New clients negotiate `Accept: application/json; recipe-content=1`. Old strict
V1/family/composition DTOs omit pin fields. An old unversioned client cannot cook
a pinned component. Historical content uses current household restrictions with
conservative facts from that content. Mutable D1 nutrition/preparation metadata
cannot certify a different version. Archive existence grants no cross-household
access. Known historical mismatches prevent current assessment/shopping.

V3 candidates remain review-only. Saved shopping version/revalidation and approved
publication remain open. Once pinned result JSON exists, a pre-077 strict Worker
cannot decode it; pre-076 composition writers can discard pins. Recovery must use
a certified version-aware Worker from this same source with paired flags OFF.
Retain archives, receipts, pins and user state; never down-migrate. Actual hosted
OFF/recovery and mixed-client certification remain required. Local evidence:
22_COOKING_FOUNDATION_VALIDATION.md,23_SAVED_CONTENT_VALIDATION.md and
24_V1_SAVED_CONTENT_VALIDATION.md.
