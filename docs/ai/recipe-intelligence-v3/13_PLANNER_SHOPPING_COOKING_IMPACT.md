# Planner, shopping, and cooking impact

Forensic review found content-version gaps that block safe promotion:

- Recipe detail reads the current static catalog; no per-content version is
  exposed.
- Cooking start uses a non-persisted synthetic session and completion resolves
  the current catalog.
- Cooking completion receipts retain deductions, servings, and command ID but
  not a recipe content fingerprint.
- Meal composition stores `recipe_id`; catalog changes trigger revalidation
  rather than silently rewriting an existing component.
- Shopping may reproject future demand under allowed stock/history changes but
  rejects catalog changes.
- Existing planner snapshots preserve V1-compatible instructions and
  requirements.

Impact: candidate content remains sidecar-only. A future promotion needs an
explicit content pin and read policy before changing any ingredient, step, or
nutrition value.
