# UI-C6 saved shopping continuation

Status: `LOCAL_SHOPPING_REFINEMENT_VERIFIED`; owner visual acceptance remains PENDING. Implementation: `9dad1494dab2719eb3f787ab161ab49748bd30d4`. Integration branch: `codex/takolio-v2-rescue`; fresh read-only GitHub main: `90b94129113b41e34701d99f51175cfa81cb73de`. This bounded row28 packet continues existing UI06/T24. The complete V2 scope remains partial.

## Evidence and product change

The baseline rendered a checked item with the inherited `.shopping-saved-row.is-checked { opacity: 0.72 }`. Seven viewport/text captures reported real color-contrast failures on the row behind the delete dialog: the name measured 2.83:1, the amount 3.29:1 and the unavailable action 2.71:1. These were row-content findings, not delete-button findings. Removing row opacity fixed the name/amount but left the unavailable action at 4.44:1. The final change sets checked-row opacity to 1 and darkens `.shopping-cannot-buy` from `#996023` to `#87551f` in `src/web/styles/kitchen-family.css`.

Only these two CSS values change product behavior. Checked background and strike-through remain; earlier saved-recipe responsive/icon rules remain unchanged. Existing ShoppingPage, ShoppingDemandReview, forms, dialogs, outbox, services, domain contracts and assets are reused. No new SVG/illustration was needed. Backend, inventory authority, tenancy/auth/CSRF, revision/idempotency, Week compatibility, payments, schemas, dependencies and infrastructure retain their prior bytes.

Codex-authored `tests/e2e/t17-ui/takolio-shopping-continuation.e2e.ts` adds two meaningful end-to-end tests using the existing isolated local Worker/SQLite fixture. It forwards mutations to the actual local API; the uncertain-response case commits the actual POST through `route.fetch()` before aborting its response.

## Verified behavior

- Saved list: blank/zero/negative amounts make no add request. Adding 0.125kg disables pending controls; reload retains it. Editing to 0.5pack survives reload. Long Vietnamese names wrap without document overflow.
- Keyboard: Enter opens edit/review; focus stays in the dialog through Shift+Tab where exercised; Escape restores trigger focus. Space checks an item. Delete cancel retains the item and restores focus; explicit confirmation deletes it.
- Offline: 125.5g is owned by the durable outbox, visibly marked device/pending. The overlay survives reload while the real server GET returns an empty saved list and writes remain blocked. This does not certify reconnect/flush or every outbox conflict.
- Unknown demand: a real seven-day plan and explicit three-day trip produce the actual unknown-demand DTO. Its review input begins blank. Invalid inputs send no review mutation. A committed 0.5pack response is deliberately lost; retry uses identical payload/key, receives the real receipt replay and leaves one purchase row. Statuses are [200,200], replay flags [false,true]. Contributions stay unchanged; the unresolved DTO still has no aggregate `quantity` field.
- Stale review: another action in the same household changes the real review revision while the dialog keeps its older snapshot. Submission returns real 409, disables inputs and requires explicit reload. Reload reads the concurrent skipped state.
- Both flows compare inventory before/after and observe no stock mutation. Focused existing tests additionally retain validation/input fences and reconciliation coverage; this browser packet does not exhaust the contract matrix.

## Screenshots and accessibility scope

Separate mobile-390 and desktop-1440 projects each run both tests. Within each project, saved/edit/checked/delete/review states have seven viewport/text configurations: 320x568, 390x844, 768x1024, 1024x768 and 1440x900 at text100; 320x420 and 320x568 at text200. Offline/uncertain/stale have the compact three configurations (320x420/text200, 390x844/text100, 1440x900/text100). Changing viewport inside a mobile context retains mobile emulation; the separate desktop project covers desktop context.

The final run has 88 screenshots and 88 zero-violation axe reports, with 154 enabled dialog-control measurements reachable/actionable after scrolling. Thirty-eight reports retain incomplete color-contrast checks; manual inspection is still required. No horizontal document overflow or broken images is observed in the final captures. Full-page screenshots of dialogs are taken before per-control scrolling and may show clipped content at the current scroll position; reachability summaries record each control after scrolling. Root-font scaling is synthetic and does not certify OS/browser zoom, screen readers or physical devices.

`evidence/shopping/manifest.json` binds 195 payloads: 95 PNG, 95 axe reports and 5 summaries. The retained before set comprises seven screenshots, seven failing axe reports and one saved-flow summary. The after set comprises 88 screenshots, 88 axe reports and four summaries across both projects. Hashes, sizes and PNG dimensions are verified. A sampling of checked mobile, short/text200 edit and desktop stale-dialog captures was inspected visually.

## Executed checks and retained failures

Final frozen browser: 4/4 PASS, reported 1.4m. Focused existing units: 4 files /61 tests PASS (2.62s). Focused integration: 3 files /53 tests PASS (8.12s). Final lint, web/Worker typecheck, targeted ESLint, local migration smoke, default build and actual paired Vite build PASS. Both builds use final product CSS; final lint/types/browser also cover the last harness adaptations.

Full suite: PARTIAL, 410/412 files and 9,163/9,168 tests PASS, 360.97s test duration. Five inherited CLI tests still resolve the encoded-space path `New%20project` incorrectly; no timeouts in this run. Protected release scripts/tests remain unchanged. Audit exits1 with eight inherited findings (1 low /6 moderate /1 high), including Vite GHSA-587h-7wmj-h5pm. No dependency change was selected.

`evidence/shopping-checks.json` binds 14 check logs and 12 retained attempt logs, exact commands and source hashes. Retained attempts include selector/startup failures, the actual contrast failure, an incorrect harness assumption about unknown-demand contributions, the insufficient first CSS correction, a narrower passing mobile run and a 3pass/1fail desktop extension interrupted by Vite reload when evidence files were written. The final frozen 4/4 run supersedes that interrupted capture; the failure remains recorded. Raw logs/traces stay ignored and local. No broader pass is inferred from partial runs.

The saved-recipes receipt remains historical and unchanged: its kitchen-family CSS hash is checked against its implementation commit, while the new receipt binds current CSS. All other unchanged historical source hashes still match the current worktree.

## Recovery and next action

After implementation, the full private verifier again matched 22,763 original regular files and 772 symlinks, bytes/modes/links/HEAD/index/status, zero worktree differences, private parent0700. Original 11 modified and 42 untracked files remain recoverable; shared Git metadata differs only through authorized worktree/fetch/local commits. Sanitized receipt: `evidence/shopping-recovery-verification.json`. Protected-main audit retains 5,845 unchanged paths outside the explicit UI/test/handoff allowlist, zero failures. Argon ledger69, selected source54 and assets12 stay intact; file decisions now84 and all38 screens remain mapped. Prior payloads and historical handoff tails remain intact.

Next bounded local packet: row29 notifications. Start with read-only source review and isolated local browser/API baseline of existing notification state, actions, keyboard and reflow; inspect current contracts before proposing any change. Do not assume synthetic notifications verify live push, permission prompts or background delivery. Existing manual accessibility, Week-OFF, live providers and performance gaps remain open. Local continuation is authorized; publication, merge, deploy, remote migrations and production require explicit approval. None occurred. Recovery uses a reviewed integration revert; preserve original WIP and private snapshot.
