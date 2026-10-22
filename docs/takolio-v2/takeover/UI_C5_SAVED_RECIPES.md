# UI-C5 saved-recipes continuation - 2026-10-23 JST

Status: LOCAL_SAVED_RECIPES_REFINEMENT_VERIFIED; full UI-C5 remains PARTIAL. Implementation: `f11a244ca0964a63618c1fc3a3f30b8a670ec90a`, exactly three source paths and one new browser test file. Work is isolated in `/Users/tunbee27/Documents/New project/Takolio-v2-codex-integration`, branch `codex/takolio-v2-rescue`, on verified main `90b94129113b41e34701d99f51175cfa81cb73de`.

## Bounded plan and observed defects

SCREEN_PROGRESS row 19 and T23 acceptance #5 require the chosen servings to survive recipe-to-planner navigation. Existing Argon RecipesPage, favorites hooks/API, RecipeMealDialog and main family styles were inspected before editing. The initial real local API baseline showed that saving persisted correctly, but switching to saved recipes dropped servings=4; saved-detail navigation and the empty-calendar dialog also lost that selection.

After the servings refinement, direct visual review found two additional defects at narrow widths: the fixed-height action cut off its wrapped text at root-font 200%, and the dialog close SVG shrank to 11.140625px at 320px. New rendered-text and SVG bounds assertions captured the layout regression before the scoped CSS correction. Axe and overflow checks alone had not detected these defects.

The authorized sequence was baseline interaction and screenshots, smallest source refinement, real local API regression checks, responsive/keyboard/axe evidence, required gates, protected-main/recovery validation and separate local implementation/documentation commits. No redesign, architecture change or new dependency was needed.

## Changes and provenance

RecipesPage retains the existing validated servings value in both library tabs and passes it to FavoritesCollection. That existing component now preserves servings in guest returnTo, empty-collection discovery, saved detail and its existing RecipeMealDialog defaultServings input. The dialog's mutation logic, meal scope checks and API contracts are unchanged.

Scoped kitchen-family.css allows the saved actions to wrap, gives their buttons flexible height with a 44px minimum, and reserves 44x44px for the recipe-dialog close button. The shared Button is unchanged. The recipe dialog is also used by recipe detail; the new class applies the same close-button correction there.

RecipesPage is an Argon refinement and keeps both Argon and integration hashes in selected-source-manifest.json. FavoritesCollection and kitchen-family.css are refinements of existing main code, explicitly classified MAIN_REFINEMENT in FILE_DECISIONS.csv. The new E2E file is Codex-authored. ARGON_WORK_LEDGER remains 69 rows, FILE_DECISIONS is now 79, asset provenance remains 12 rows. Original Argon components, icons and artwork remain recoverable; no new image or mockup crop was necessary.

## Behavior and visual evidence

Four saved-recipe browser tests verify real local Worker/SQLite behavior: save, reload, search, empty-search recovery, remove, reload, resave and reload; tabs, detail and empty-calendar navigation keep servings=4; the planner opens in manual mode with four servings. API revisions progress 1 -> 2 -> 3 and inventory is identical before/after. No business response DTO is mocked.

Eight viewport/text configurations cover 320x568, 360x800, 390x844, 430x932, 768x1024, 1024x768 and 1440x900, plus 320x420 with root-font 200%. Collection and handoff states verify overflow, >=44px card buttons, rendered text fitting vertically, close SVG >=20px, Enter, Tab/Shift+Tab focus trapping, Escape and focus restoration. Seventeen axe reports have zero violations. Human agent review covered phone, desktop and both narrow text200% states; owner acceptance remains pending. Root-font scaling does not certify OS zoom or a physical device.

`evidence/saved-recipes/manifest.json` hashes 56 files: 37 PNGs, 17 axe JSONs and two behavior summaries. Baseline semantics are explicit: before/saved-tab.png and before/saved-handoff.png precede the servings fix; the 16 responsive before images follow the servings fix but precede the layout fix. After images are from the final verified-paired run. Raw traces and logs stay ignored locally.

## Verification and limits

Lint, both typechecks, local migration smoke and default/paired builds pass. Focused family/favorites/manual-draft tests pass 49/49; discovery/presentation/inventory regressions pass 88/88. Final paired browser run passes six tests (four saved plus two discovery). Default composition V1 persistence/tab subset passes two tests; composition V2 is explicitly enabled for handoff coverage.

The first canonical-TMPDIR full run had 9 failures: five inherited encoded-space CLI path failures and four Admin 5000ms timeouts. The complete final run with --maxWorkers=4 passes 9,163/9,168 in 286.03s; only the same five inherited CLI path failures remain. Admin was not edited, timeouts were not raised, and a timeout fix is not claimed. TEST_BASELINES.md records commands and both outcomes. Prior dependency audit found eight inherited findings including high Vite GHSA-587h-7wmj-h5pm; that audit was not rerun in this packet and dependencies remain unchanged.

Protected-main audit passes for 5,846 paths outside the explicit allowlist, with zero failures. The count decreases by one because FavoritesCollection is now explicitly reviewed; kitchen-family.css was already selected by the prior audit. After implementation, full private snapshot verification passes: 22,763 original regular files, 772 symlinks, bytes/modes/links/HEAD/index/status match, zero worktree differences, private parent 0700. Only authorized shared Git metadata differs.

No push, published PR, merge, deployment, remote migration or production action occurred. Week OFF, live AI/OTP, screen-reader acceptance, packet-specific LCP/CLS/capacity and full planner meal-mutation E2E coverage remain uncertified. Existing unit/integration meal-mutation coverage passed. Next bounded local packet: row 20 recipe-detail readiness, servings changes and cooking handoff, with a real baseline before deciding whether any further UI change is needed. Local continuation is authorized; publication and release require approval.
