# T27 - Compact kitchen UI and clear daily workflows

Status: LOCAL_COMPLETE / NOT_DEPLOYED (2026-10-16 JST)

## Outcome

This pass makes the existing Takosan kitchen surfaces denser and easier to scan
without changing API contracts, planning rules, household isolation, payments,
authentication, migrations, runtime flags or production infrastructure. It keeps
editable controls at 16px and action targets at least 44px while reducing oversized
headings, repeated card chrome, panel padding and secondary copy.

## Implemented

- Added scoped `data-kitchen-density="compact"` presentation for kitchen routes;
  `/plus` remains outside the scope. Onboarding uses its existing page scope.
- Reduced page titles to 22-28px, sections to 18px, card titles to 15-16px and
  ordinary UI copy to 14-15px. Mobile header is 64px and the scan action remains
  available with an accessible name.
- Planner setup now separates whole-meal suggestions from an explicit manual
  calendar, collapses saved habits into an editable summary, keeps allergies and
  forbidden ingredients visible, and uses contextual headings/copy.
- Shopping prioritizes the purchase list, labels manual additions clearly and uses
  a native disclosure that is closed on mobile/open on desktop without overwriting
  the user's state or an active draft during resize.
- Favorites, recipe discovery, planner shopping and onboarding use shorter copy,
  clearer next actions and less competing visual weight. Planner dish rows use quiet
  dividers while saved/locked actions retain emphasis and touch targets.

## Verification

- `pnpm lint` PASS (`work/t27-lint-frozen.log`).
- `pnpm typecheck` PASS (`work/t27-typecheck-frozen.log`).
- Paired build with `VITE_MEAL_PLANNER_ENABLED=true VITE_MEAL_COMPOSITION_V2_ENABLED=true`
  PASS (`work/t27-build-paired-frozen.log`); default build also PASS.
- `pnpm check:migrations` PASS (`work/t27-migrations-final.log`).
- `git diff --check` and scoped Prettier check PASS.
- Family E2E PASS: 12/12 across 320/390/768/1280 projects in 4.9m
  (`work/t27-family-e2e-frozen.log`). This covers manual calendar, servings,
  exact selected dishes, picker quantity visibility, favorites, generated family
  meals, shopping share/edit/reload and unknown-quantity review/skip/reopen.
- Full Vitest: 362 files, 8,466 passed, 1 failed, exit 1 in 504.34s
  (`work/t27-tests-final.log`). The only failure is the existing Wrangler local
  migration-list test timing out at 5.326s against a 5s test budget before its
  assertions. The same file passes 32/32 in 6.47s when run in isolation
  (`work/t27-staging-catchup-focused.log`); no source or assertion failure was
  found.
- Local isolated preview was manually checked at 320px and desktop size. The
  shopping disclosure opens with Enter/Space, keeps draft text and open state
  across 320px -> 1280px -> 320px, and reports no horizontal overflow. Planner
  setup exposes the compact summary, Vietnamese labels, meal structure and
  allergy/forbidden-ingredient summary in the accessibility tree.

## Evidence and limits

Screenshots from the final E2E run are in `.wrangler/family-meals/`, including
`board-viewport-390.png`, `board-viewport-320.png`, `setup-390.png`,
`favorites-390.png` and `onboarding-390.png`. Local synthetic preview checks do
not certify hosted signed-in behavior, native iOS rendering, 200% browser zoom or
real-user retention. No production deployment was performed for T27.

## Next action

Review the compact surfaces with product/design stakeholders, then run the normal
protected CI/staging/production release workflow only if this local checkpoint is
accepted.
