# T27 - Compact kitchen UI and clear daily workflows

Status: DEPLOYED / AUTHENTICATED_HOSTED_ACCEPTANCE_NOT_TESTED (2026-10-16 JST)

Verified implementation checkpoint: `34421382`.

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
real-user retention. This paragraph records the local checkpoint; the production
release receipt below supersedes its deployment status.

## Retained failures

The initial full suite had a stale shopping-copy assertion (8,466 PASS / 1 FAIL);
that assertion was updated to check the final future-meal/current-fridge contract.
An initial E2E attempt used two Vite instances sharing a dependency cache and did
not complete synthetic sign-in. A later run was 11/12 because source/docs editing
triggered a Vite reload during generation. After the source was frozen, 12/12
passed. Logs remain in `work/`; no failing test was skipped or weakened.

The broad heuristic `ux_audit.py` run reported 39 issues/1,505 warnings from
128 checks across the repository including tests/scratch. This is not a PASS;
targeted UI review and existing E2E axe/overflow assertions found no remaining
introduced blocker. The Wrangler timeout in the final full run is preserved;
the isolated PASS does not turn that full run into an aggregate PASS.

## Next action

The protected release is complete. Retain the deployed candidate and receipts;
no T27 approval or rollout gate is pending. Hosted signed-in household acceptance,
native iOS/200% zoom and real-user retention remain unverified.

## Production release (2026-10-16 JST)

The user explicitly requested deployment. Release candidate is merge
`f7386e6a8d9ef8955cc314daebf4d1aeecf4e5a1` through PR80; source34421382 and
hardening3a24808b ancestry are independently verified. Exact-head CI38792223988
passed362files/8467tests525.60s; exact-main CI38793721402 passed362files/8467tests
554.80s. The earlier local Wrangler timing failure remains a retained local result;
no test budget or assertion was weakened to obtain hosted PASS.

Staging Deploy38795229534 SUCCESS. Artifact and independent verification are at
`work/t27-staging-38795229534-1/release-manifest.json` and its T27 verifier sibling.
`work/t27-staging-public-final.json` and `work/t27-staging-compact-assets.json`
PASS. Stage SW propagation briefly observed the exact priorT26 SHA then converged
within the existing bounded verifier; no extra deploy was needed.

Production Deploy38795680975 SUCCESS, with actual required Environment approval
from vn-taphoanhatung (comment: Approved by Tun bee). Production local gates
passed lint, types, 362 files / 8,467 tests in 556.32s, migration smoke and build.
Native14-slot fixture7756ms and 500-recipe bounds19446ms PASS; these isolated
CI timings do not measure production household latency. Explicit inputs retain
d1/0, cutover and paired ON. No migration: authority22paths, Zod dependency/
integrity and schema43 are byte-identical to T26. Rollback was NOT_USED.

Active Worker `0c99a435-7e7d-43fe-97a3-8e05ebc723d4`, deployment `21c45ed0-9e3d-462e-8d5c-d40109a070eb`
binds the canonical D1. Previous exact T26 Worker/deployment join, remote43/tip0043,
FK/quick-check, catalog500/fingerprint/no fallback, paired flags and unchanged-D1
continuity were independently verified. Inactive same-candidate OFF recovery
`5911a565-d000-4f2b-8c4f-ecc5a8c85731` and its compiled HTML/module assets are certified;
recovery traffic was NOT_REHEARSED. Recipe-media R2 was not reverified by this release.

Production artifact12003052751 (90-day retention) is downloaded to
`work/t27-production-38795680975-1/release-manifest.json`; root verifier sibling
`release-manifest.json.t27-independent-verification.json` PASS. Independent agent
also recomputed the verifier in memory and re-read GitHub approval/hosted jobs.
Source audit03428467..f7386e6a is 21 files: 6 docs,11 frontend TSX/CSS,4 tests;
no backend/schema/dependency/runtime flag/config/workflow/payment/auth changes.

Final public verification `2026-10-15T20:04:34.798Z` PASS. Readiness exactSHA before/after,
auth no-store, immutable main `/assets/index-Bw_UlFCV.js`, protected SW hash,
three ordinary/revalidated observations and D1 post-deploy smoke all PASS.
Compact stylesheet `/assets/index-JCj7nCEo.css` is 211206 bytes,
SHA256 `5d88e46b7fa476a5a4b43fe08d7293b47a1a41c067159300c3de28b1ee759bd2` with immutable caching and compact markers.
Database OK; only existing informational CONFIG_RECIPE_CATALOG_D1_AUTHORITY
warning remains. Marker checks prove delivered assets, not computed signed-in UI.

Executed final commands:

```sh
node work/t27-verify-deploy-receipt.mjs f7386e6a8d9ef8955cc314daebf4d1aeecf4e5a1 work/t27-production-38795680975-1/release-manifest.json production
node work/t25-verify-production-public-adjusted.mjs f7386e6a8d9ef8955cc314daebf4d1aeecf4e5a1 work/t27-production-public-final.json work/t27-production-38795680975-1/release-manifest.json
node work/t27-verify-compact-assets.mjs https://frigo.tungjpstore.net f7386e6a8d9ef8955cc314daebf4d1aeecf4e5a1 work/t27-production-compact-assets.json
```

All three PASS. Sanitized hosted gate log:
`work/t27-production-38795680975.log`. Public receipts:
`work/t27-production-public-final.json`, `work/t27-production-compact-assets.json`.
Hosted signed-in flows remain NOT_TESTED per the user's automated/public-smoke
choice. No claim of native iOS/200% zoom/retention or recovery traffic rehearsal.
No further T27 release gate remains pending.
