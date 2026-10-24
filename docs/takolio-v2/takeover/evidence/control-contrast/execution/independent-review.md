# Independent C12/C13 review

Reviewed 2026-10-24. Scope: current CSS candidate and regression test, source call sites, completed root-owned Chromium outputs. No tracked edits, browser execution, servers, or gates performed by this reviewer.

## Findings

No concrete runtime defect or blocking regression found in the candidate. The following are evidence limits, not reproduced product failures.

1. Selector coverage exceeds the measured controls. `src/web/styles/kitchen-upgrade.css:444` also styles discovery cuisine/category/region selects (`src/web/pages/RecipesPage.tsx:224`, `:240`, `:260`); C13 measures only servings select index 0. `src/web/styles/kitchen-upgrade.css:428` also changes placeholder presentation in `FamilyPreferenceFields` used by onboarding (`src/web/pages/OnboardingPage.tsx:360`) and planner preferences (`src/web/features/planner/PlannerSetup.tsx:339`); C12 measures settings only. Planner locale is shared across planner routes; setup selectors match both legacy and family setup, while this run covers the enabled family `/planner/new` lane. The OFF-switch rule matches all five notification switches; C12 toggles the promotional switch only. Shared implementation supports a bounded inference, not a claim that these sibling instances were measured.
2. Both tests force reduced motion (`tests/e2e/t17-ui/takolio-control-contrast.e2e.ts:92`, `:309`). State name `normal` means unfocused/unhovered. These outputs do not certify `prefers-reduced-motion: no-preference`, animation timing, or normal-motion switch transitions.
3. Keyboard focus uses Tab to select modality, followed by programmatic targeted focus (`tests/e2e/t17-ui/takolio-control-contrast.e2e.ts:59`, `:276`). This proves the selected controls receive visible keyboard-modality focus. It does not prove natural Tab order, complete keyboard traversal, or absence of a keyboard trap. C12 genuinely activates the promotional switch with Space/Enter and checks persistence after real reload (`:141`). C13 does not edit input/select values or activate the filter disclosure through the keyboard.
4. C13 geometry baseline disables only box-shadow in the current candidate (`tests/e2e/t17-ui/takolio-control-contrast.e2e.ts:235`). It correctly checks that the inset stroke itself preserves the current rectangle. It cannot independently detect a separate padding/margin/border change present in both samples, or establish historical geometry equivalence. The inspected runtime diff contains only placeholder color/opacity, OFF-switch background, and inset shadow declarations.
5. Target/reachability evidence is bounded. C12 checks height >=44px and horizontal/document bounds, without a width assertion or trial click. C13 checks width/height >=44px plus a trial click before the state loop (`tests/e2e/t17-ui/takolio-control-contrast.e2e.ts:268`); it does not test occlusion separately in every state or assert vertical viewport bounds. No blanket accessibility certification follows.

## Selector scope assessment

- Explicit control classes avoid decorative cards/panels; native date/number restrictions exclude planner radios/checkboxes. Shopping currently contains exactly the two inputs and unit select measured by C13.
- No targeted class found in the auth credential surface, `PlusPaywallPage`, or payment components. Onboarding family search placeholders are affected as stated above. This is a static selector assessment, not a browser certification of auth/Plus routes.
- No shared primitive, backend, auth, billing/payment, or domain contract code changed in the reviewed runtime diff. Existing focus outlines remain independent of the inset shadow.

## Completed runtime evidence read

Root-owned receipt: `.artifacts/takeover/control-contrast/c12-c13-final-1-receipt.json`.

- Command: `PORT=3303 PREVIEW_API_PORT=8923 PREVIEW_MEAL_PLANNER_ENABLED=true PREVIEW_MEAL_COMPOSITION_V2=true PREVIEW_MEAL_COMPOSITION_V2_SERVER=true PREVIEW_T20_D1=true pnpm exec playwright test -c playwright.t17.config.ts tests/e2e/t17-ui/takolio-control-contrast.e2e.ts --project=mobile-390 --project=desktop-1440 --output=.artifacts/takeover/control-contrast/c12-c13-final-1`.
- Receipt exit 0; browser log ends `4 passed (4.1m)`. Two tests in each of two Chromium projects. Internal viewport resizing does not change a project's touch/mobile input context.
- C12: 63 observations per project; targeted placeholders, OFF/ON switch, focus screenshots, axe checks, shaped disabled exclusion, Space/Enter persistence. Incomplete axe checks remain manual review.
- C13: 44 control/configuration combinations and 132 state observations per project. Four configurations: 320x568, 320x420/root-font 200%, 390x844, 1440x1000. All per-shadow geometry checks true; lowest measured stroke/fill ratio 6.6456 and stroke/parent ratio 6.3520, above 3:1.
- C13 reports empty API-write, external-request, and page-error arrays after fixture reset. Both tests retain equal before/after responses for inventory, shopping list, family preferences, current meal plan, and me. These are five endpoint snapshots, not a full database/production audit.
- C12 uses the shared isolation fixture, which blocks unexpected external application traffic and asserts no uncaught browser errors. The fixture deliberately records/aborts known Unsplash image requests separately; do not translate this into an unconditional claim of no attempted external image requests. C13 has an additional empty external-request assertion after reset.
- Root-font 200% is synthetic text scaling; no physical device, Safari, native browser zoom, VoiceOver, or NVDA evidence is supplied by these runs.

## Regression sensitivity

The assertions should detect removal of the placeholder patch, a low-contrast OFF track/thumb, removal/wrong size/wrong color of the C13 inset stroke, loss of visible focus, insufficient measured target size, horizontal overflow, unexpected API writes, and drift in the five sampled responses. C13 also rejects unexpected external requests/page errors directly.

Limits: no deliberate mutation run was executed; geometry sensitivity is per-shadow only; unmeasured sibling/route contexts and normal-motion behavior remain unverified. These limits do not justify redesign, new cosmetic work, or claims of new defects.

## Disposition

Candidate has bounded regression evidence and no observed blocker. Document the scope above; continue the existing recertification plan. Do not claim complete keyboard, all-route, motion, device, or production certification from C12/C13.
