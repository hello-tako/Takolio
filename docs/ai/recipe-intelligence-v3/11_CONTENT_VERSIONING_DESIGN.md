# Content versioning design

Stable identity and mutable content remain separate:

```text
recipeId + slug
  -> approved content version
  -> candidate versions
  -> source and review history
```

The current application does not expose a durable content version in every
recipe/cooking path. Cooking creates a synthetic session and later resolves
the current catalog; saved planner data retains V1-compatible recipe identity
and requirements. Therefore V3 does not promote content or alter cooking
deductions in this checkpoint.

A future promotion must pin the selected content fingerprint/version in
planner, shopping, and cooking snapshots. Old snapshots must remain readable;
new plans may opt into a newer approved version. Rollback restores the prior
approved version without deleting user state.
