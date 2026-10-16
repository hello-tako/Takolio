# Takolio mascot and app visual upgrade

Date: 2026-10-16 JST. Follow-up baseline: `0db4ce2f4c5823eaf7fd085921e3b3a7ba0d8608`.
Canonical repository: `lol-vn/Tako-san`, ID `1385308553`.
Live main: `f7386e6a8d9ef8955cc314daebf4d1aeecf4e5a1`.
Draft PR: https://github.com/lol-vn/Tako-san/pull/79.

The operator authorized both a stronger genuine 3D mascot and visual consistency across the app. This follow-up preserves the accepted contract, routes, source SVG fallbacks, business behavior and protected-system boundaries. It remains a review candidate, with no merge/deploy/release authorization.

## Implementation

`source/3d/` retains the genuine eight-arm Blender model and 33-bone starter rig. The updated builder softens skin highlights, smooths the matte chef hat, simplifies authored eye highlights and distributes tapered suckers along arc length/local surface normals. The pose renderer uses multiple bone segments and IK for distinct silhouettes: wave, cooking, thinking, excited, completed and cheering. Actual object references and evaluated world matrices preserve scale when attaching facial parts and bowl/spoon contents; a bone-parented holder moves each prop with its supporting arm. Nearest-vertex contact assertions are smoke checks, complemented by actual-size visual review. Six 2048px alpha PNG masters feed the unchanged deterministic Sharp pipeline and 18 responsive WebP paths. Blender/native files remain local handoff files; no WebGL dependency is introduced.

`kitchen-upgrade.css`, imported after the existing compact layer, adjusts shared spacing, readable headings, card surfaces and focus. Existing palette variables remain the sole color authority. Navy marks the active navigation state over Blush; Coral remains an accent. Short compact viewports put bottom navigation in document flow so enlarged copy is not covered. `/plus` does not have compact density and is excluded from these rules.

The landing page uses a responsive mascot scene and three clear workflow steps while retaining the exact existing guest/login callbacks. Unplanned Home separates copy and mascot in a grid. Narrow missing-recipe images keep the full accessible name and use a compact visual caption. The empty fridge presents the existing manual-add modal entry below its scan action, hiding the duplicate floating add control only while the empty-state block is present. Error/retry and populated inventory behavior are preserved.

## Evidence

Fresh matrix, contact sheets, command receipts, source/runtime hashes and protected-path comparisons live in `evidence/upgrade/`. `source/3d/render-manifest.json` pins the new render masters, settings and authoring/native provenance. The local delivery receipt records the final published SHA and automatic hosted CI, so committed documents do not claim their own future commit hash.

Retained failed attempts include the intermediate world-matrix render bug, stale authoring-hash unit failure, a concurrent fixture reset that invalidated the partial browser capture, initial font injection that read computed styles before they settled, and an unsupported Vite outDir override rejected by the existing service-worker build hook. These attempts are not PASS evidence. Fresh runs isolate fixture servers and assert the captured route matches the requested route. The font stress check waits until the computed font is actually doubled and checks navigation occlusion and indicator contrast.

## Open Limits

`PREMIUM_MASCOT_FINISHING_PENDING`: this is an original 3D candidate, not a 100% concept-board reproduction. Full facial controls, production deformation/weights and natural encircling grip refinement remain future authoring work. Legal/trademark clearance, native store publication, physical-device installs and hosted signed-in/offline household-data behavior remain unverified. Twenty-five protected legacy source-copy locations remain deferred under the existing inventory; no payment/Worker copy is changed.

## Rollback

Revert this follow-up to restore the prior render bytes and presentation without changing runtime URLs, API/session/storage identifiers or database state. A reviewed rollback release must retain both asset trees, use the existing immutable release build ID for service-worker cache rotation, and rerun the PWA and protected-flow checks. The vector fallback stays available. Any merge/deploy/store/domain/legal release needs separate owner authorization.

## Final Local Checkpoint

Implementation `dae71688bde863608a20855b56351ccd51d99c34`. Full unit rerun 365 files / 8,479 tests PASS; 94/94 E2E PASS. The initial Wrangler timeout is retained with its passing unchanged-file/full-suite reruns. See `VERIFICATION.md` and `evidence/upgrade/receipts.json`. Independent implementation review has no concrete findings; final published-head CI/review binding is recorded in the PR and local delivery receipt after commit. Current runtime 87 entries/996,320 bytes; 18 WebPs replaced, 69 prior entries unchanged.
