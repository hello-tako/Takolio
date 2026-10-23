# UI-C5 recipe detail continuation

Status: `LOCAL_RECIPE_DETAIL_REFINEMENT_VERIFIED`; full UI-C5 and owner visual acceptance remain pending. Implementation: `61150c83e5a97882aaf31d700f01a28f52ed8393`, based on main `90b94129113b41e34701d99f51175cfa81cb73de`. Source changes are exactly CookingModePage, kitchen-recipes.css and a new recipe-detail E2E file. All work is in the integration worktree; original Argon WIP remains unchanged.

## Reproduced problems and bounded fixes

1. Detail with servings=4 opened cooking with four people and six eggs, including after reload. Confirmed exit omitted the servings query, returning detail to its base two people/three eggs. After correcting the harness from `dialog` to the component's actual `alertdialog`, the failing test independently reproduced this navigation loss. The shared return URL now includes the frozen recipe servings in confirmed exit and the existing zero-step fallback link. No store, quantity calculation, backend or inventory command changed. The zero-step fallback shares the fix but was not independently exercised in this packet.
2. At 320x420 and synthetic root-font 200%, the fixed cooking action split the word `phut)` across lines (Vietnamese label in the UI). Overflow, axe and vertical bounds alone did not expose it. Text-node Range rectangles now check whole nonspace words. Scoped button padding/gap and arrow-SVG dimensions leave enough text space; existing layout, typography, brand assets and Argon components remain.

The retained before images distinguish the original exit defect from the later pre-CSS layout baseline. No mockup crops or new runtime artwork were required.

## Verified behavior

The real isolated Worker/SQLite fixture `gl-03` / `tomato-egg-stir-fry` has a two-person base of three eggs, two tomatoes, one bunch scallions and 15ml oil; stock contains two eggs. Required eggs/shortage/readiness are 1.5/none/1-of-4 at one person, 3/1/0-of-4 at two, 6/4/0-of-4 at four and 30/28/0-of-4 at twenty. The UI correctly displays Vietnamese decimal `1,5`; twenty people and quantities survive reload.

Four-person detail -> cooking -> reload -> ingredient drawer -> confirmed exit returns `?servings=4` and six required eggs. During this path, zero non-read API requests occur and the complete inventory response remains unchanged. The planner dialog links to the existing manual-first setup with recipe and servings=4; the destination retains four people. No planner/inventory mutation is needed for that check.

Three tabs and the planner dialog are exercised at 320x568, 320x420/root-font 200%, 360x800, 390x844, 430x932, 768x1024, 1024x768 and 1440x900. Checks cover overflow, >=44px action targets, vertical text bounds, whole words, tab Home/End/ArrowRight/Enter and dialog Escape/focus restoration. Twenty-four axe reports have zero violations; their incomplete items remain in JSON rather than being counted as passes.

## Checks and evidence

- Final lint, web/Worker typechecks, customer/Admin migration smoke and both default/paired builds pass.
- Final paired browser: 5/5 in 30.9s (three new detail tests plus two existing culinary tests); default composition-V1 detail subset: 2/2 in 8.1s. The existing culinary completion test deliberately mutates only isolated synthetic stock and verifies idempotent replay; the new exit test performs no stock writes.
- Focused transcript checks: 27 unit tests / four files and 69 integration tests / three files pass. These transcript-only results are supporting evidence; final full regression also includes their files.
- Full canonical-TMPDIR suite: 410/412 files and 9,163/9,168 tests pass in 267.91s, exit 1. The same five inherited CLI cases use `New%20project` instead of decoding the filesystem path. No Admin timing failures recur in this run. Protected release tooling is unchanged; full regression remains PARTIAL.
- Repeated dependency audit:1 low/6 moderate/1 high, exit 1. High Vite GHSA-587h-7wmj-h5pm is fixed in >=6.4.4; unchanged dependencies retain this inherited finding. No dependency remediation is bundled.
- Initial typecheck caught duplicate `height` in test measurement JSON. The correction puts viewport size under `viewport`; final lint/types and browser were rerun after it. Product/build/full-unit graph did not change.

Exact final commands, outcomes, source/log hashes and retained failed attempts: `evidence/recipe-detail-checks.json`; details: `TEST_BASELINES.md`. Raw logs/traces stay under ignored `.artifacts/takeover/recipe-detail/`. `evidence/recipe-detail/manifest.json` verifies 66 files: 38 PNGs, 24 axe reports and 4 summary JSONs. All after files come from the final `verified-paired` run. Full-page screenshots retain fixed overlays at the original viewport position; this is disclosed capture behavior. Narrow action evidence, desktop tabs, handoff and exit screenshots were visually inspected.

After implementation, private snapshot verification again matches 22,763 regular files and 772 symlinks, all original bytes/modes/links/HEAD/index/status, with zero worktree differences. Backup parent remains0700. The protected-main audit verifies 5,846 unchanged main paths outside the reviewed UI/test/handoff allowlist. Ledgers now contain 69 Argon rows, 80 file decisions and 12 asset entries. Original Argon hashes remain alongside refined source hashes.

## Limits and next action

Evidence is local/synthetic, with mock AI and external fetch blocked. Root-font scaling is not physical-device or OS-zoom certification. Owner acceptance, Week-OFF browser verification, live AI/OTP/integrations, screen reader, full meal-mutation E2E and LCP/CLS/load/production certification remain open. No push, published PR, merge, remote migration, deployment or production action occurred. Historical release permissions do not extend this task.

Next bounded packet: SCREEN_PROGRESS rows 21-22, cooking controls/timer, exit cancellation, confirmation and completion. Begin with the existing actual API/browser baseline and preserve the stock/replay boundaries before deciding whether further UI changes are needed. Local continuation is authorized; publication/release requires approval.
