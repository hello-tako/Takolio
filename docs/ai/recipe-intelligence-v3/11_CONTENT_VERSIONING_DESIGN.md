# Content versioning design

Stable recipeId and slug remain separate from immutable content identity.
ADR-075 implements cooking, ADR-076 saved compositions, ADR-077 standalone
V1 selections and ADR-078 shared shopping. ADR-072 governs candidate publication.

Migration0046_recipe_content_versions.sql adds a server-owned RuntimeRecipe
archive keyed by the existing single-recipe SHA256, household access grants,
and nullable content/request references on durable cooking receipts. Detail and
start capture trusted, unscaled content before media enrichment. The response
exposes contentFingerprint outside Recipe; scaling servings cannot change it.
The cooking store freezes the fingerprint with the command and offline body.

Completion reads the household-authorized archive or an exact current match.
A committed retry resolves before consulting the mutable catalog. Legacy NULL
references stay unknown; fixed V1 baseline or unambiguous receipt units support
old retries. Unknown aliases and ambiguous omitted units fail closed. New
unversioned commands are limited to the two fixed V1 catalog fingerprints.

Migration0047 pins saved composition components. ADR-077 stores optional nullable
pins in existing V1 result JSON without another migration. New recipe selections
capture unscaled authority content and household access. Composed/family anchors
inherit their component pin, including legacy NULL; family variants remain NULL.
Swaps retain unchanged selections. Explicit regeneration selects current content
and drops stale known locks even if provenance.version is equal. Read-time V1
composition projections resolve household-authorized archives.

ADR-078 copies component pins into persisted shopping contributions. Missing
legacy pins and non-recipe components stay unknown. Existing raw JSON witnesses
bind exact content to demand review and atomic writes. A pin change requests
review again while purchase amounts/history survive. Receipt-first share/review
replay remains valid; a historical mismatch blocks a fresh calculation. Private
offline caches retain pins without authorizing offline demand review.

New clients negotiate Accept: application/json; recipe-content=1. Old strict
V1/family/composition/shopping DTOs omit pin fields. An old unversioned client
cannot cook a pinned component. Historical content uses current household
restrictions and conservative facts from that content. Mutable D1 nutrition or
preparation metadata cannot certify a different version. Archive existence grants
no cross-household access.

V3 candidates remain review-only; approved publication is open. Pre-078 strict
shopping Workers/clients cannot decode pinned JSON/cache; pre-077 strict V1
Workers cannot decode pinned result JSON; pre-076 composition writers can discard
pins. Recovery requires a certified same-source version-aware Worker/client with
paired flags OFF. Retain archives, receipts, pins and user state; never down-migrate.
Actual hosted recovery and mixed-client certification remain required. Local
validation:22_COOKING_FOUNDATION_VALIDATION.md,23_SAVED_CONTENT_VALIDATION.md,
24_V1_SAVED_CONTENT_VALIDATION.md and25_SAVED_SHOPPING_VALIDATION.md.
