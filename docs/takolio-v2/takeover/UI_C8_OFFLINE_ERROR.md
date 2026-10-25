# Offline/error row 38 continuation - 2026-10-24 JST

Status:`LOCAL_OFFLINE_ERROR_REFLOW_VERIFIED`; owner acceptance PENDING. Implementation `d44b98ca292b24baf954a7bf3c6b1039661cfd95`, branch `codex/takolio-v2-rescue`, integration `/Users/tunbee27/Documents/New project/Takolio-v2-codex-integration`. Read-only canonical main remains `90b94129113b41e34701d99f51175cfa81cb73de`.

## Source and bounded change

Retained the existing OfflineBanner, WifiOff/RefreshCw icons, copy, subscriptions and retry handler. Added flex wrapping with a flexible status span, the existing 44px tap-target token and a polite atomic status region. The previous retry measured 24px at normal text and pending text intersected the button at 320px/text200. No new illustration was evidenced; no asset replacement or frontend rebuild.

Source/caller review covered sync.ts ownership fencing, serialized outbox flushing, api.retryPendingWrites owner verification and reconciliation, http cookie/expected-owner handling, stable shopping IDs, notifications read behavior, AsyncState and shell ResizeObserver measurement. These source bytes remain canonical main. The outer direct div required by the shell is retained; there is no shell or backend fix. ErrorBoundary exists but is outside this bounded recovery test.

No payment, Admin, authentication, CSRF, tenancy enforcement, inventory revision/idempotency, Week contract, schema, dependency, configuration or infrastructure change. No storage key, request shape, API path or retry ordering change.

## Actual recovery and appearance

Actual local network abort queues one shopping write; reload retains its owner, operationId and exact body. Automatic online 500 and held manual 500 preserve that queue and an empty server list. Focus+Enter retry disables the button and prevents duplicate activation; next retry reaches the real local Worker and stores exactly one item with its original ID/body. Queue and banner clear, and reload retains that one server item. Inventory, family, current-plan and onboarding snapshots remain unchanged. Separate shaped notifications 500 shows the existing InlineError, distinct from offline; keyboard retry recovers actual local notifications with no monitored API writes and unchanged domain snapshots. InlineError requires no source change.

136 bound payloads: 64 PNG, 64 axe JSON and 8 behavior summaries. Comparable baseline and final each cover four states at 320x568, 320x420/root text200, 390x844 and 1440x900 in both mobile-390 and desktop-1440 contexts. Baseline: 2 failed / 2 passed in 34.7s: 24 missing status semantics, 12 short retries and 2 text overlaps; final zero instances of these defects. All 32 final axe reports have zero reported violations; 8 have incomplete color-contrast. All 24 final retry measurements meet 44px and viewport reachability; disabled pending state and measured shell offset pass.

Final pending 320x420/text200, 390x844 and desktop 1440 captures were visually inspected: the narrow enlarged-text message and retry wrap onto separate rows while regular mobile/desktop remain compact. All observed text stays clear of the retry, assets load, and the measured banner height leaves the existing header unobscured. The before/after comparison uses the same test and baseline source copied before the edit.

Isolated Chromium/local Worker/SQLite with reduced motion and root-font scaling; not OS zoom, physical-device, screenreader, performance, live-provider or production certification. navigator.onLine/events and 500 responses are explicitly shaped; API abort, durable storage, owned queue and local server replay are real. Keyboard coverage uses focus+Enter and does not certify full Tab traversal or announcements in assistive technology. Eight final incomplete contrast results require manual review. Full-page mobile capture can show fixed-navigation artifacts. No AppErrorBoundary crash or adversarial cross-tenant certification; full planner flag-OFF Week remains open.

## Verification and retained attempts

Final browser 4/4 in 30.3s; focused sync/query/services/Week/navigation/shell regression: 6 files / 160 tests in 1.57s (wall 2.42s). Targeted ESLint, pnpm lint, typecheck, local migration smoke, default build and paired planner/composition build PASS. Full suite Node 24.16.0/resolved TMPDIR: 410/412 files; 9, 164/9, 169 tests in 202.40s (wall 203.32s); same five inherited encoded-space CLI failures in production-catalog-continuity/release-check. Dependency audit retains 1 low / 6 moderate / 1 high including Vite GHSA-587h-7wmj-h5pm; dependencies unchanged. Existing Admin font warnings remain on builds.

Initial browser attempt: 4 failed: real target/status/layout defects plus harness measuring shell before ResizeObserver settled and incorrectly assuming empty notifications. Refined only the harness to await measured height, detect text-range/button intersections and compare recovery against actual server notifications. The unchanged banner was rerun with that refined harness as the comparable baseline; the identical harness passes after the narrow fix. Initial harness, 79 raw artifacts and complete logs remain bound and ignored. No failure evidence was discarded.

Exact commands, times, environment, source SHA256 and ignored-log hashes:`evidence/offline-checks.json`. `evidence/offline/manifest.json` binds all 136 raw/public payload pairs, dimensions, state coverage, defect counts and implementation identity. `evidence/offline-recovery-verification.json` is sanitized. Initial traces, diagnostics and private recovery locations stay ignored/private.

## Recovery and next action

Post-implementation private recovery verification matches original Argon WIP: 22, 763 regular files / 772 symlinks; bytes, modes, links, HEAD, index, status; zero worktree differences; private parent 0700. Authorized shared Git metadata changes are disclosed separately; exact recovery location remains private. Selected salvage 54 paths, Argon ledger 69 rows, asset ledger 12 rows intact; file decisions 103; all 38 owner statuses PENDING.

Eight handoff/checkpoint documents prepend this checkpoint while preserving historical bytes. SCREEN_PROGRESS changes only row 38; FILE_DECISIONS appends two decisions. The historical evidence validator is extended with complete before/after state coverage, summary parity, geometry, source identity, retained attempts and command-log hashes. Protected-main, evidence, credential/private-path, whitespace and historical-tail checks run before the separate documentation checkpoint.

Next bounded packet: cross-screen regression and evidence-gap audit, prioritizing true planner flag-OFF Week compatibility and manual accessibility/device review. All 38 screen rows now have bounded runtime evidence, including protected Plus presentation, while all 38 owner reviews remain PENDING; this is not product completion or release approval. Inherited CLI/dependency findings remain open. No push, PR publication, merge, deploy, remote migration or production action.

Finalization executed: protected-main audit PASS with 5, 837 unchanged protected base paths; evidence, credential/private-recovery-path and whitespace validation PASS. All eight historical document tails and the previous 101 file decisions are preserved; only SCREEN_PROGRESS row 38 changed. These results precede the separate local documentation checkpoint.
