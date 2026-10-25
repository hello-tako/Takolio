# Real Week flags-OFF continuation - 2026-10-24 JST

Status: `LOCAL_WEEK_REAL_FLAGS_OFF_BOUNDED_VERIFIED`; owner acceptance PENDING.

Implementation `c91e0747084013e66f1128fafa168984cf46e3bb` (test only), branch `codex/takolio-v2-rescue`; integration `/Users/tunbee27/Documents/New project/Takolio-v2-codex-integration`. Read-only GitHub main remains `90b94129113b41e34701d99f51175cfa81cb73de`.

## Source and scope

Added one guarded browser journey for the actual paired-flags-OFF preview. All existing runtime code, Week pages/components, icons, assets, API, store and security boundaries remain unchanged. Twenty-two reviewed existing source/config/test paths match canonical main; no new illustration or replacement asset was justified.

Reviewed UI10/ADR-053 contracts: four truthful setup steps, null unlimited budget, session-only settings, existing private-session/idempotency commands, explicit shopping import and conservative offline receipts. Backend/packages, auth/CSRF/tenancy, inventory revision/outbox authority, payments, schema, dependencies and infrastructure are protected. This implementation changes only one test file.

## Actual behavior

Both planner APIs return their disabled 404 codes; five planner aliases reach Week. Four setup stages retain values through back/next. Generation preserves unlimited budget as null and the command/idempotency key, then the actual local Worker returns 201 with seven days/21 slots. Reload/readback, meal tabs, share/swap Escape and return focus, read-only alternatives, shopping list/active zero-selection guard, and session-only settings pass. Per context: one plan creation plus two read-only alternatives POSTs; inventory/shopping/family snapshots and the generated plan after reads/settings remain unchanged. Session settings survive SPA navigation and reset after full-document navigation.

Settings reset was observed through full-document navigation, which resets the in-memory store; the preceding generated-plan reload verifies server readback separately. Opening swap alternatives issues an existing read-only POST without recipeId, not a meal mutation. Share success was not attempted. Shopping imports no stock.

146 bound payloads: 72 PNG, 72 axe JSON, two behavior summaries. Nine states x four viewport/text configurations x two Chromium contexts (mobile-390, desktop-1440). Configurations: 320x568/text1, 320x420/root text200, 390x844/text1, 1440x900/text1. All 512 measured buttons/choices meet the checked 44px and horizontal bounds. All 72 axe reports have zero reported violations; all 72 have incomplete color-contrast. No horizontal document/text overflow or broken image was observed. This is bounded evidence, not complete accessibility acceptance.

Contact sheets for normal mobile, root text200 and desktop were visually inspected. Existing pine/coral layout, typography and original assets remain coherent in the captured states. Fixed chrome and modal framing after scroll/full-page capture are evidence limitations; no pixel-perfect or owner acceptance claim follows.

## Verification

Real-OFF browser: 2 passed (1.4m). Existing synthetic setup compatibility: 2 passed (9.3s); absent-OFF-variable guard: 2 skipped. Focused Week regressions: 7 files/131 tests in 3.91s (wall 4.80s). Final targeted ESLint, pnpm lint and pnpm typecheck PASS; local migration smoke and default build PASS. Correct actual paired-ON build (`VITE_MEAL_PLANNER_ENABLED=true VITE_MEAL_COMPOSITION_V2_ENABLED=true pnpm build`) PASS, final wall 11.23s. Full suite Node v24.16.0: 410/412 files, 9,164/9,169 tests in 234.01s (wall 235.01s); same five inherited encoded-space CLI failures in production-catalog-continuity/release-check. Audit remains 1 low/6 moderate/1 high including Vite GHSA-587h-7wmj-h5pm; dependencies unchanged. Existing Admin font build warnings remain.

Build evidence correction: historical `VITE_FF_MEAL_PLANNER_V2` / `VITE_FF_MEAL_COMPOSITION_V2` names do not drive the actual feature modules. Those successful invocations only prove a default build, not paired-ON. Historical receipts/tails are preserved; the correct-flags final build above supersedes that claim. The real-OFF browser also verifies the actual Worker gates, without feature-module interception.

Retained attempts: initial 1 failed/1 passed from a harness focus-return assertion after capture blurred focus; the harness now reopens the sheet before checking return focus. A later run was interrupted during test-file reload. The next attempt failed both contexts with an empty Vite preview following 504 Outdated Optimize Dep during concurrent Vite activity. Final isolated run passes with the committed harness. Initial invocation-only typecheck has no completed-result claim. Six logs, both harness versions and 213 earlier artifacts remain hash-bound and ignored. Browser reproduction commands are reconstructed where the complete launcher was not recorded; no unrecorded wall time or Node version is invented.

`evidence/week-off/manifest.json` binds every raw/public payload pair, size, SHA256, PNG dimensions and complete state/config/context coverage. `evidence/week-off-checks.json` binds 23 committed source objects, 17 check logs, six retained logs, harness versions and earlier artifacts. Sanitized recovery: `evidence/week-off-recovery-verification.json`. Raw traces, logs, local fixtures and exact recovery locations stay private/ignored.

## Remaining evidence gaps

| UI10 area | Current packet | Still open |
|---|---|---|
| Actual feature gates/routes | Both actual flags OFF, disabled APIs and five planner aliases verified | Broader negative routes/other flag combinations |
| Setup/generation | Four stages, back retention, null budget, exact command, real 201/readback | Complete validation/error/private-session/StrictMode matrix |
| Meal/swap | Tabs, alternative reads, Escape/return focus | Actual swap command/retry/readback |
| Export | Dialog open, Escape/return focus | Clipboard/native share success, rejection and cancellation |
| Shopping | List/active rendering, zero-selection import disabled | Explicit selected-only import and exact stock readback |
| Session settings | SPA retention, full-document reset, no plan/stock mutation | No durable settings promised |
| Accessibility | 72 zero-violation axe reports; 512 measured targets | 72 incomplete contrast; full Tab/announcements, devices/native zoom |
| Offline | No guarantee added by this test | Week queue durability/projection domain packet required |
| Release/owner | Local evidence only; all 38 owner reviews PENDING | Hosted/release/production approval separate |

No stock import, actual swap mutation, successful clipboard/native share, Week offline durability, full Tab traversal, native zoom, physical-device, screen-reader, performance, live-provider or production certification. Generation transport is held only for pending appearance, then released to the real local Worker. Root-font scaling and reduced motion are simulations. Full-page capture after control scrolling can show displaced fixed navigation/skip-link/modal framing; screenshots do not prove viewport occlusion or pixel acceptance. Manual contrast review remains open. Existing ON evidence is preserved separately; this packet does not complete all UI10 acceptance.

## Recovery and handoff

Private full recovery verification after the implementation matches original Argon WIP: 22,763 regular files/772 symlinks; bytes, modes, links, HEAD, index and status match; zero worktree differences; private parent 0700. Authorized shared Git metadata changes are disclosed separately. Recovery location remains private. Selected salvage 54 paths, Argon ledger 69 rows and asset ledger 12 rows remain intact; file decisions 104; all 38 owner statuses PENDING.

Only SCREEN_PROGRESS rows 23-27 receive appended OFF evidence; existing ON evidence/values are retained. FILE_DECISIONS appends one test decision, preserving all previous 103 rows. Eight handoff documents prepend this checkpoint while retaining historical tails byte-for-byte. Evidence and protected-main scope checks run before a separate documentation checkpoint; this report cannot name its own commit.

Next unblocked packet: manual contrast/evidence-gap audit on existing Week and cross-screen text/control colors, using reproducible computed-color pairs and honest treatment of gradients, opacity and capture artifacts. Also queue explicit local-only selected stock import, actual swap and clipboard success/error coverage under UI10 before claiming complete flag-OFF behavior. Week durable offline service risks require their own domain packet/ADR. Owner review, native devices/assistive technology, inherited CLI failures and dependency findings remain open. No push, PR publication, merge, deploy, remote migration or production action.

Finalization executed: protected-main audit PASS with 5,837 unchanged protected base paths; historical/current evidence, changed-text credential/private-recovery-path and whitespace validation PASS. All eight historical document tails and the previous 103 file decisions are preserved; only SCREEN_PROGRESS rows 23-27 changed, retaining previous field values as prefixes. All 38 owner reviews remain PENDING. These results precede the separate local documentation checkpoint.
