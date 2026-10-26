# Ingredient reconciliation policy

V2 preserves 6,766 ingredient lines and 1,438 source concepts. Its reconciliation artifact has 2,515 rows:

- existing canonical: 505 reconciliation rows;
- duplicate alias: 368 reconciliation rows;
- provisional new canonical: 1,642 reconciliation rows;
- reviewed new canonical: 0;
- ambiguous/invalid: 0 in the inherited manifest.

These are reconciliation rows, not distinct concepts or distinct ingredient IDs. The 1,642 provisional rows refer to 1,395 distinct `ING_ENR_` identities. Repeated occurrences or reconciliation states do not create new food concepts. `manifests/ingredient-reconciliation.json` records both counts explicitly.

No V3 semantic mapping or canonical promotion has been approved. These inherited states do not certify line correctness. Every provisional identity remains review-required; no source line is deleted because it cannot be projected.

Allowed outcomes:

`MATCH_EXISTING_CANONICAL`, `REVIEWED_ALIAS_CANDIDATE`, `REVIEWED_NEW_INGREDIENT_CANDIDATE`, `DISTINCT_INGREDIENT_CANDIDATE`, `AMBIGUOUS_NEEDS_REVIEW`, `INVALID_SOURCE`.

The existing V2 release gate remains the authority for promotion. No fuzzy match, nutrition URL or shared spelling creates canonical authority. Fish sauce/salt, scallion/onion, coconut water/coconut milk, pork/cracklings remain distinct unless evidence resolves them.

Preserve source quantity, process role, optionality, shopping inclusion and nutrition role independently. A process-only input is not an eaten amount and does not become shopping demand automatically. Candidate flags preserve source facts; they do not certify those flags as correct.
