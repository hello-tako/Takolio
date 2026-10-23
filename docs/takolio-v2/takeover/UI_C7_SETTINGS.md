# UI08 Settings row32 continuation - 2026-10-24 JST

Status: `LOCAL_SETTINGS_PENDING_VERIFIED`; owner acceptance remains PENDING. Implementation: `b7a32b69f19f06bac4dbf7bc6d61ecd3bcce1969`. Integration: `/Users/tunbee27/Documents/New project/Takolio-v2-codex-integration`, branch `codex/takolio-v2-rescue`. Fresh read-only canonical main remains `90b94129113b41e34701d99f51175cfa81cb73de`.

## Existing behavior and bounded change

Reused the existing UI08 SettingsPage, AccountPage, Card, Button, ConfirmDialog and Lucide icons. No missing illustration or SVG was evidenced. The /settings alias already redirects to /settings/app. Existing text describes limited offline availability and a Vietnamese-only interface honestly.

Cache clear operates on CacheStorage only. Private localStorage data caches and the sync outbox are separate. This packet preserves that handler without edits. PWA installation already captures beforeinstallprompt, prevents its default handling, waits for prompt/userChoice, consumes the event on success or error, and offers manual guidance when no prompt is available. Standalone mode already hides the install action.

The corrected browser baseline reproduced a concrete defect: while accepted/dismissed userChoice was held pending, the install action remained enabled and a second click invoked the same prompt a second time. This occurs in both mobile and desktop contexts. The fix adds an installing state, an early pending guard and a finally reset, and passes that state into the existing Button isLoading mechanism. That button already renders a spinner and disabled action. Both accepted and dismissed now call prompt exactly once and unlock afterward; prompt rejection restores the action and existing honest error copy. Manual instructions remain usable after the consumed event.

Only SettingsPage and the new browser test change runtime/test source. No cache, outbox, API, route, copy, shared component, CSS, asset, backend, authentication/security, household/inventory authority, payment, Week compatibility, schema, dependency or production infrastructure change occurs.

## Browser evidence

Three journeys run in separate mobile-390 and desktop-1440 contexts. Each capture state covers requested 320x568, 320x420 with root text200, 390x844 and 1440x900. Reduced motion is explicit.

- Cache/data journey creates an actual pending shopping item through the existing UI (2g) with its exact POST aborted. The route abort remains active across navigation/reload, preventing load-triggered sync from committing that queued item. A harmless CacheStorage entry is created. Real deletion is gated for pending inspection, then released. CacheStorage empties; complete private-cache/outbox snapshots stay equal after clear/reload; the pending shopping projection survives. Server inventory/shopping snapshots remain equal. A second cache entry plus shaped deletion rejection verifies honest failure, no false success, and retained cache/data. Alias and privacy link are checked.
- Manual installation journey verifies initial cancel focus, iPhone/Android instructions, both dialog controls reachable at all configurations, and Escape closing with focus restored to the opener.
- Synthetic PWA journey holds accepted/dismissed userChoice, checks disabled pending state and one prompt call, then confirms the consumed prompt uses manual guidance. A rejecting prompt verifies the error branch and recovery. A shaped standalone media query verifies existing message and hidden install action. Rejected prompt has no held pending phase; its blockedDuplicate summary field does not claim an additional pending duplicate test.

Two automatic queued POST attempts per context occur during the monitored cache journey; both remain aborted. The test permits only that endpoint. This is not a zero-write-attempt claim, and queue creation itself happens before that monitoring interval. Real server stock/shopping equality is separately asserted.

Final browser PASS: 6/6 in 51.4s. Across eight states, 64 final axe reports have zero reported violations and retain incomplete color-contrast. All requested innerWidth values match; scrollWidth fits the requested viewport; no broken images; all 232 measured controls fit and enabled controls pass trial interaction. These counts include disabled pending controls, not 232 enabled clicks. Header/navigation controls are outside the account-body control selection. Four states are cache-related; others are manual-help, install-pending, install-error and standalone.

Visually inspected before/after install-pending320/text200, final manual-help320/text200, cache baseline390 and success desktop1440. Full-page screenshots follow control scrolling and can include focus-triggered skip links/fixed navigation over content; they are state evidence, not a pixel/owner acceptance claim. Existing components/assets remain retained.

## Baselines and verification

Initial run: 2 PASS / 4 FAIL in 1.4m. This was a harness failure: the generic navigate helper expected /settings before its valid immediate redirect; the PWA event fired before the lazy Settings listener mounted. Corrected navigation uses page.goto and awaits the install action plus two animation frames before dispatch. Product source had not changed. Initial harness, raw log, error contexts and traces remain ignored.

Corrected baseline: 4 PASS / 2 FAIL in 54.3s. Cache and manual-help pass both contexts; PWA tests fail only pending/duplicate assertions. Both accepted and dismissed record blockedDuplicate=false and promptCalls=2. Rejected records one call and the existing error. Corrected baseline and final harness bytes are identical, SHA256 `93105441d5211130c392ea85c60fc211f82fab3b6fec0bd91a08f0a9ace2f9a3`. The baseline Settings source is byte-identical to canonical main. These copies were preserved and hashed before the fix.

Final targeted ESLint, pnpm lint, pnpm typecheck, local pnpm check:migrations, default build and actual paired build PASS. Existing focused units: four files/76 tests in 1.38s. Existing focused integration: three files/104 tests in 6.85s. Full pnpm test remains PARTIAL: 410/412 files and 9,163/9,168 tests in 200.86s (wall201.70s), five inherited encoded-space CLI failures in production-catalog-continuity/release-check, no timeout. Protected release tests/scripts remain unchanged. Audit exits1 with inherited one low/six moderate/one high finding including Vite GHSA-587h-7wmj-h5pm; dependencies unchanged. Existing Admin font build warnings retained.

Exact commands/exit codes/durations/log hashes are in `evidence/settings-checks.json` and `TEST_BASELINES.md`. The browser shell wall duration was not recorded; only its actual reported test duration is claimed. Eleven final check logs and five retained logs include initial/corrected baselines, pre/post-implementation recovery and main readback.

## Evidence and recovery

`evidence/settings/manifest.json` binds 268 payloads: 128 PNG, 128 axe JSON and twelve summaries across before/after and both contexts. Each phase contains64 PNG/64 axe/six summaries. Raw-source hashes are also bound. Synthetic queued payloads/IDs remain in ignored summaries; published summaries retain count/equality and canonical SHA256. Other evidence bytes match raw output. The validator verifies exact states/configurations, PNG geometry/hash, controls, sanitization, queued data boundaries, duplicate baseline/final outcomes, source/log hashes and recovery.

Post-implementation full private snapshot verification PASS: 22,763 regular files / 772 symlinks, bytes/modes/links/HEAD/index/status, zero original-workspace differences and private parent0700. Full original Argon WIP, Git and ignored files remain recoverable; authorized shared Git metadata differs. Recovery location remains private; sanitized receipt is `evidence/settings-recovery-verification.json`.

Protected-main audit, all historical/current evidence validation, changed-text credential/private-path scan, whitespace and historical-tail verification run during documentation finalization. Protected paths outside the explicit reviewed UI/test/handoff allowlist remain byte-identical to main. Selected Argon source manifest54 paths, Argon ledger69 rows and asset ledger12 rows unchanged. File decisions92; all38 owner reviews PENDING. Mandatory CURRENT_STATE, root TASK_BOARD and root HANDOFF updated by prepending; historical tails remain intact.

## Limits and next action

Synthetic PWA events/userChoice/rejection/standalone verify client handling only. Service workers are blocked; native installation, offline app shell, physical devices, OS zoom, screen readers, full Week-OFF, live providers, performance and production are not certified. Cache success uses real CacheStorage; deletion denial is shaped. Native/device/manual accessibility and owner review remain open.

Next bounded packet: row33 food preferences source/API/browser baseline under UI08. Preserve wire fields, allergy/diet/exclusion semantics, household isolation and persistence. No push, PR publication, merge, deploy, remote migration or production action occurred. Local integration rollback can use a reviewed revert while preserving the original workspace and private recovery snapshot.
