# C11 — Week commands, Home continuation, short viewport readability

Local Chromium verification, 2026-10-24 JST. Implementation: `6bf58f3a0d7c0909b777958fa9cdd5fda4426ddc`; parent documentation checkpoint: `1f36db5d89da13d88706871a3e135bb9991bda4a`. Official main inspected: `90b94129113b41e34701d99f51175cfa81cb73de`.

## Change and reason

ADR-063 precedes runtime changes. Existing Argon layout, assets, components and command handlers remain. Primary Home/discovery/preparation containers no longer fade their text through opacity zero. Normal and reduced-motion samples now stay at effective opacity one. `IngredientRow` identity/status uses intrinsic flex wrapping: an actual Week import exposed a 343px document at 320px/root text200; final title and status chip fit without clipping or hiding overflow.

The historical UI15 237px navigation obstruction does not reproduce on current source. Existing compact-height CSS places navigation/actions in document flow at height <=600px. Navigation remains at the document end on short screens. No shell rewrite or replacement asset was justified. ADR058 already describes family meals; ADR063 supersedes the old packet's suggested number.

Only four runtime files changed: HomePage, RecipesPage, RecipeDetailPage and IngredientRow. Three runnable browser regression files cover the actual local journeys. Backend, inventory authority, Week services/store/outbox, auth, payments, schema, dependencies and production configuration are unchanged.

## Executed browser checks

| Journey | Actual configuration | Result | Evidence |
| --- | --- | --- | --- |
| Home onboarding/current plan | Planner ON, composition ON, local Worker/D1 | 2/2 PASS; 1.2m reported, 70.583s wall | `evidence/readability/home-paired-on` |
| Week commands and stock reflow | Planner OFF, composition OFF | 4/4 PASS; 41.2s reported | `evidence/readability/week-commands-off` |
| Short viewport and motion | Both OFF | 2/2 PASS; 52.77s wall | `evidence/readability/short-motion-off-8` |
| Short viewport and motion | Both ON | 2/2 PASS; 97.4s wall | `evidence/readability/short-motion-paired-on-10` |
| Supplemental short viewport | Planner ON, composition OFF | 2/2 PASS; 40.36s wall | `evidence/readability/short-motion-mixed-7` |

The manifest gives the authoritative payload paths. `run-receipts.json` records exact commands, environments and timing. Preview composition uses `PREVIEW_MEAL_COMPOSITION_V2`, without `_ENABLED`; the supplied `_ENABLED` variable in attempt7 was ignored. That run is supplemental mixed configuration, never final paired-ON evidence. Build composition uses `VITE_MEAL_COMPOSITION_V2_ENABLED`.

Home completes real household/preferences onboarding, reads saved values, generates through the local API (200), reloads the current plan and exercises meal/schedule/Scan/Back. Native Tab reaches the five root destinations; Scan remains actionable. Exactly family PUT, preferences PATCH and plan POST occur; the subsequent read journey has zero writes and unchanged inventory. Twenty state PNG/JSON pairs and twenty motion PNGs cover normal/reduced motion. All 1,358 checked solid text pairs pass; minimum 5.313493755827672:1. Home axe: 20 reports, zero violations; two incomplete color-contrast reports.

Week generation returns 201. Native Chromium clipboard export succeeds; rejection and unsupported clipboard are explicitly synthetic. Actual swap returns 200, survives reload/readback and leaves inventory unchanged. Selected-only shopping import PATCH returns 200; GET confirms one exact quantity/unit row, preserving all existing stock fields. Replaying the exact key/body returns `idempotentReplay:true`; the event count increases once, then stays unchanged. This does not establish durable swap replay or offline behavior. Week covers 42 observations: zero axe violations, 36 incomplete contrast reports. Fridge covers ten observations: zero violations/incomplete reports, zero API writes, unchanged domain snapshots. Final 320px/text200 row bounds pass.

Short viewport configurations: 320x420/text200, 390x420, 768x420, 390x844 and 1440x900. Five roots retain full labels/current state/44px targets; Scan immersive view has no shell navigation. Search keyboard, Tab/ShiftTab, recipe link/Back and detail arrow tabs pass. Direct root focus checks do not certify a complete native Tab traversal. Primary opacity samples at 0, .1, .25, .5, .75 and 1 stay one under normal/reduced motion. Inventory stays equal; zero API writes. Each retained passing run has 20 axe reports: zero violations; ten reports contain 12 incomplete entries (ten aria-prohibited-attr, two color-contrast), requiring manual review.

Screenshots and geometry are complementary observations: Week geometry precedes full-page capture and can have different card heights. Existing fixed Add displacement during full-page mobile capture predates this patch. Do not infer matching pixel coordinates or viewport occlusion from those captures. Final Home mobile/text200/desktop contact sheets and stock320/text200 image were visually inspected.

## Gates

Node v24.16.0; resolved canonical TMPDIR. Exact commands/log hashes: `evidence/readability/run-receipts.json`.

| Check | Result | Wall time |
| --- | --- | --- |
| Targeted ESLint | PASS | 2.31s |
| Focused 14 files / 274 tests | PASS, 4.95s reported | 6.52s |
| `pnpm lint` | PASS | 13.80s |
| `pnpm typecheck` | PASS | 37.17s |
| `pnpm test` | PARTIAL: 407/412 files, 9,161/9,169 tests | 356.52s (355.39s reported) |
| `pnpm check:migrations` | PASS | .53s |
| `pnpm build` | PASS | 12.91s |
| `VITE_MEAL_PLANNER_ENABLED=true VITE_MEAL_COMPOSITION_V2_ENABLED=true pnpm build` | PASS | 12.26s |
| Three timing files, unchanged, `--maxWorkers=1` | PASS, 3 files / 46 tests, 18.96s reported | 20.03s |

The full suite retains five inherited `New%20project` MODULE_NOT_FOUND CLI failures in production-catalog-continuity/release-check. Three further failures were timing-related: admin-r2-auth (5s), family-planner-native-d1 (11.384s against 8s), t21rc2t-production-approval (5s). Their isolated single-worker rerun passes unchanged; family generation takes 2554ms with 14 slots/500 catalog entries and unchanged replay/stock checks. The full run remains partial. Dependency audit was not rerun; inherited 1 low/6 moderate/1 high including Vite GHSA-587h-7wmj-h5pm remains open. Dependencies unchanged. Existing Admin font build warnings remain.

## Failed and intermediate attempts retained

Home's earlier run exposed real opacity failures; final run above supersedes it. Week attempts: 1 selector mismatch; 2 clipboard/resize geometry; 3 actual 343px overflow; 4 port collision before tests; 5 two passing tests with a clipped status chip, rejected on visual inspection; 6 final four passing tests with intrinsic wrapping. Attempt1 runner log was not saved; available artifacts remain bound.

Short attempts: 1 port conflict; 2 escaped-query regex; 3 real opacity failures; 4 harness sidebar/navigation geometry; 5 passing before the OFF fixture helper; 6-off one pass/one axe context failure during live IngredientRow reload; 7 supplemental mixed; 8 final OFF; 9 paired-ON setup failed before UI checks with HTTP504 `Outdated Optimize Dep` for zustand.js; 10 final paired ON. Different Vite feature configurations now run sequentially because they share dependency cache.

All available earlier/failure PNG, JSON, traces, harness revisions, launchers and logs are separately hash-bound in `source-bindings.json`. Traces/logs remain private. Historical C10 failed-run evidence loss remains disclosed in its unchanged report; no new claim reconstructs missing bytes.

## Evidence and recovery

`evidence/readability/manifest.json` binds 367 payload files: 212 PNG, 152 compact raw-JSON equivalents and three derived JSON files; manifest makes 368 files. PNG copies are byte-exact. Public raw-JSON equivalents parse equal to originals; raw/public hashes remain distinct. `source-bindings.json` binds 1,072 available raw/source files. At validation, 1,071 remain current-byte-exact; one running diagnostic server appended 1,795 bytes to its log. Its original 2,858-byte prefix matches the bound hash exactly and is preserved separately, alongside the full 4,653-byte observation and explicit append receipt. No packet hash was silently updated. Collector SHA256: `1dde0c19c299396117ed59cac59511c5dbc5fb039eff0bd11b816d6cb4b6c05e`. All eight implementation Git blobs match current bytes.

`evidence/readability-recovery-verification.json` confirms the original read-only workspace and full private snapshot: 22,763 regular files/772 symlinks, matching bytes/modes/links/HEAD/index/status, zero differences. Stored snapshot worktree baseline and all 116 regular Git baseline files match; private parent mode0700. Authorized integration work changes shared Git metadata, separately disclosed. Recovery locations and credentials stay private.

During finalization, the unchanged historical recovery script initially targeted its old receipt. Both old public/raw receipts were restored byte-exact from the committed parent object. The new result is retained privately. An adapted verifier then wrote the uniquely named current receipt and verified snapshot Git baseline integrity. No historical receipt change is carried in this checkpoint.

Historical document tails, existing ledger rows and all 38 PENDING owner reviews remain. FILE_DECISIONS grows105 to112. Selected-source manifest retains all54 paths and original Argon hashes; current hashes change only for the three approved primary-container deltas. Asset ledger remains12 and Argon ledger69.

## Next action and limits

C12: fix measured placeholder and notification OFF-switch contrast with narrow existing-style changes, preserving working solid focus outlines. A separate input-boundary assessment remains pending; no global token rewrite. Week durable offline requires its own domain packet/ADR. Media rights/owner review, physical devices, native zoom, Safari, screen readers, hosted behavior and production acceptance remain external or separately scoped. Local evidence does not certify the whole product. No push, published PR, merge, deployment, remote migration or production action.
