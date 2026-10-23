# UI-C5 cooking continuation

Status: `LOCAL_COOKING_REFINEMENT_VERIFIED`; production readiness and owner visual acceptance remain pending. Implementation: `6276a6b929304c1c207b3355c3827fdd762ef287`. Integration: `codex/takolio-v2-rescue`; main: `90b94129113b41e34701d99f51175cfa81cb73de`.

## Confirmed regression and scoped fix

The expanded baseline reproduced a concrete serving-loss bug. Completing `tomato-egg-stir-fry?servings=4`, then choosing `Quay lại bước nấu`, produced `/cook/tomato-egg-stir-fry` without its query. The in-memory run masked the loss until reload; reload returned to two people and three eggs. The review page now carries the frozen `recipe.servings` query when it links back to cooking. This is a one-link UI fix in `src/web/components/cooking/CookingReview.tsx`; no store, quantity calculation, API contract, inventory command, backend, auth, security or payment code changed.

The test `tests/e2e/t17-ui/takolio-cooking-continuation.e2e.ts` was added as Codex-authored coverage. It exercises the existing Argon cooking surface instead of replacing it: wall-clock timer pause/resume/deadline/reset and step clearing, alertdialog cancel/focus/Escape behavior, selected-servings return/reload, actual-use validation, explicit confirmation, committed-response-loss retry with the same idempotency command, direct empty completion recovery, and eight viewport/root-font configurations. The real isolated Worker/SQLite fixture is used; the response-loss case forwards the real first request and replaces only the client response with HTTP 503 after the server has committed it.

## Evidence

- Expanded baseline: 4/5 tests passed; the single failure reproduced the missing `?servings=4`, with zero non-read API writes and unchanged inventory. The retained before summary and screenshot are in `evidence/cooking/before/`.
- Final paired run: 10/10 browser tests passed in 1.7 minutes: five cooking-continuation tests, two culinary tests and three recipe-detail tests. Default composition-V1 bounded cooking subset: 4/4 passed in 21.8 seconds.
- Responsive matrix: 8 viewport/text configurations across cooking, exit, review and saved states; 32 axe reports have zero violations. The evidence manifest contains 75 files: 38 PNGs, 32 axe JSON reports and 5 sanitized summaries.
- Actual-use/replay: blank, negative, maximum, overstock, zero and fractional guards run before confirmation; no write occurs before confirm. A committed first request followed by a synthetic lost response retries the identical body and idempotency key; the server reports replay and remaining seeded tomatoes are 2.5.
- Private recovery verification after implementation: 22,763 regular files and 772 symlinks match the source snapshot; bytes, modes, links, HEAD, index and status match with zero worktree differences. The backup path remains private and is not recorded in tracked evidence.

## Validation

`pnpm lint`, `pnpm typecheck`, `pnpm check:migrations`, default `pnpm build`, paired build with `VITE_MEAL_PLANNER_ENABLED=true VITE_MEAL_COMPOSITION_V2_ENABLED=true`, targeted ESLint and the paired/default browser commands passed. The full canonical-TMPDIR suite remains partial at 9,163/9,168 tests in 447.30s: the same five inherited encoded-space CLI path failures in protected release-tool tests remain. `pnpm audit --audit-level=high` remains an inherited 1 low / 6 moderate / 1 high result, including Vite GHSA-587h-7wmj-h5pm; dependencies were not changed.

The synthetic root-font scale does not certify physical device or OS zoom. Device speech, background alarms, screen-reader behavior, Week-OFF routes, live integrations, performance, production and owner visual acceptance remain open. No push, PR publication, merge, deployment, remote migration or production operation occurred.

## Next action

Keep the cooking fix and evidence as a local checkpoint. Begin bounded planner rows 23-27 with a read-only source review and isolated local API/browser baseline under existing UI06/current contracts. Preserve Week compatibility, paired flags, revision/idempotency and stock boundaries. Local continuation is already authorized; publication, merge, deployment and production operations require explicit approval.
