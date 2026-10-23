# UI-C6 planner continuation

Status: `LOCAL_PLANNER_REFINEMENT_VERIFIED`; owner visual acceptance and production readiness remain pending. Implementation: `30693884c3b66ebe3d4fcd48fb57100853703826`. Integration: `codex/takolio-v2-rescue`; verified main: `90b94129113b41e34701d99f51175cfa81cb73de`. Covers screen rows 23-27 using the existing UI06 and T26 implementation. The filename follows the earlier takeover continuation reports; this is the kit's UI-C6 planner packet.

## Confirmed defect and scoped fix

The real local baseline reproduced inaccessible picker controls at 320x420 with root text scaled to 200%: the role selector and first choose button could not be activated or brought fully into the viewport. A short-height-only correction still failed at 320x568/text200. Ancestor geometry then showed that the Tailwind `overflow-y-auto flex-1` utilities continued to override the result container's scoped rules, leaving a nested scroll area and a choose button about five pixels outside the viewport.

`src/web/styles/kitchen-planning.css` now makes the existing picker panel the scroll container and gives its result selector enough specificity to disable the nested flex/overflow behavior. Filters and results can scroll together. No component, route, API, store, server contract, revision/idempotency rule or asset was replaced. This file is a refinement of main, not a byte-identical Argon port. All selected Argon source and assets remain recoverable with provenance.

Codex-authored `tests/e2e/t17-ui/takolio-planner-continuation.e2e.ts` extends the real isolated Worker/SQLite fixture. It delays a local create request only to inspect pending controls, then forwards it to the actual API. The persisted plan is validated against the existing DTO schema; reload comparison permits only the read-time freshness timestamp to change.

## Observed behavior and evidence

- Automatic family setup: blank day count blocks submission; pending controls disable; one real request creates seven intended slots at revision 1. Board, meal and reload preserve persisted fields.
- Shopping: an explicit three-day trip shares 2030-01-07 through 2030-01-09 using the expected plan revision. The saved shared list survives reload. Inventory stays byte-equivalent at the API boundary.
- Manual setup: one-day empty calendar at revision 1; keyboard opening focuses search, Shift+Tab remains inside the dialog, Escape closes it and restores trigger focus. Role/cuisine controls are exercised; selecting a real recipe increments revision to 2 and survives reload without inventory changes.
- Picker: nine viewport/text configurations, four controls each, 36 measurements all actionable and within viewport after scrolling; measured control heights are at least 44px. Configurations: 320x568, 360x800, 390x844, 430x932, 768x1024, 1024x768 and 1440x900 at text100; 320x420 and 320x568 at text200.
- Setup, pending, board, meal and shopping each have three captures: 320x420/text200, 390x844/text100, 1440x900/text100. Combined with nine picker captures, 24 axe reports record zero violations; all 24 retain incomplete color-contrast checks and 12 retain incomplete aria-prohibited-attr checks. These require manual review and are not accessibility certification.
- `evidence/planner/manifest.json` binds 61 payloads: 33 PNG, 24 axe JSON and 4 summaries, including the retained failing before geometry. No horizontal document overflow or broken images was observed in final captures. The picker screenshot shows its current scroll position; per-control screenshots prove short-screen reachability after scrolling.

## Executed validation

Final browser: 2/2 PASS in 38.3s. Final lint, web/Worker types, targeted E2E ESLint, default build and actual paired planner/composition Vite build pass. Local migration smoke passes. Focused planner units pass 4 files / 43 tests. Exact commands, log sizes/hashes, source hashes and retained attempts are in `evidence/planner-checks.json` and `TEST_BASELINES.md`.

The full unit run remains PARTIAL: 404/412 files and 9,157/9,168 tests passed in 466.01s, with five inherited encoded-space CLI path failures and six 5000ms timeouts. The unchanged failed subset rerun passed 6/8 files and 413/418 tests in 13.76s: all six timeout cases passed; the same five protected CLI cases failed. A subset retry is not a full-suite pass. The full suite preceded the final CSS specificity correction; final browser/static/build checks bind to the committed source. No protected test, timeout or release script was edited. Audit retains 1 low / 6 moderate / 1 high, including Vite GHSA-587h-7wmj-h5pm; dependencies remain unchanged.

Canonical Week redirect passed 1/1 with planner/composition ON before the final picker specificity change; routing source is unchanged. The separate synthetic Week feature-module OFF keyboard setup passed 1/1. That does not certify Week generation, dual-write, all OFF behavior or a real compiled flag-OFF deployment.

Private recovery verification after implementation matches 22,763 regular files and 772 symlinks, all original worktree bytes/modes/links/HEAD/index/status, with zero worktree differences. Sanitized receipt: `evidence/planner-recovery-verification.json`. Protected-main audit verifies 5,845 unchanged paths outside the explicit UI/test/handoff allowlist with zero failures; the one-path count decrease from cooking reflects newly allowlisted planner CSS. Argon ledger stays 69 rows, selected-source manifest 54 paths, asset provenance 12 rows; file decisions now cover 83 paths.

## Limits and next action

Synthetic local fixtures and root-font scaling do not certify physical devices, browser/OS zoom, screen readers, live providers, full hard-constraint/quotas/error/retry matrices, all composition mutations, performance or production. Prior T26 and cooking receipts remain historical evidence, not fresh Planner acceptance. Owner visual review remains PENDING.

Next bounded local packet: row 28 saved shopping list, starting with source review and isolated API/browser baseline of quantity validation, pending/offline/conflict behavior and keyboard/reflow, reusing current UI06/T24 and keeping stock and purchase demand separate. Full Week-OFF and manual accessibility review remain open. Publication, merge, deployment and production actions require explicit approval. No push, published PR, merge, deploy, remote migration or production action occurred. Rollback is a reviewed integration revert; preserve the original WIP and private snapshot.
