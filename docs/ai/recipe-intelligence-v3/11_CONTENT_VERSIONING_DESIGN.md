# Content versioning design

Stable `recipeId` and `slug` remain separate from immutable content identity.
ADR-075 implements cooking compatibility; ADR-072 still governs publication.

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

Historical content uses current household restrictions with conservative facts
from that content. Mutable D1 nutrition/preparation metadata cannot certify a
different version. Archive existence alone grants no cross-household access.

V3 candidates remain review-only. Version-pinned saved planner/shopping and
publication/recovery integration remain release prerequisites. Before serving
changed content, certify a version-aware recovery Worker; an old Worker can
ignore the new field and reinterpret changed-catalog offline commands. Retain
archives, receipts and user state through rollback; never down-migrate.
