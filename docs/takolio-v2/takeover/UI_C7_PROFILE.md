# UI-C7 profile continuation

Status: `LOCAL_PROFILE_REFINEMENT_VERIFIED`; owner visual acceptance remains PENDING. Implementation: `6cb0d462813482b8137d975b207d8b530fc55776`. Integration: `/Users/tunbee27/Documents/New project/Takolio-v2-codex-integration`, branch `codex/takolio-v2-rescue`. Read-only GitHub main verification still returns `90b94129113b41e34701d99f51175cfa81cb73de`. This bounded row30 packet continues UI08/ADR-051. Full V2 acceptance remains partial.

## Existing behavior and correction

The source/runtime baseline already provides the profile identity, guest fallback, grouped account links, responsive wrapping, Plus target and logout confirmation. These components, assets, styles, services and handlers are reused. No replacement illustration or SVG is needed.

One metadata string in `src/web/pages/ProfilePage.tsx` changes from `Lựa chọn trên thiết bị và kênh gửi` to `Lựa chọn nhắc nhở trên thiết bị`. Notification preferences currently save device-local intent; there is no active delivery-channel capability to advertise. Plus link JSX/targets and logout behavior remain byte-identical within the page. Backend, auth/security contracts, payments, household isolation, inventory authority, revisions/idempotency, Week compatibility, schema, dependencies and production infrastructure remain unchanged.

`tests/e2e/t17-ui/takolio-profile-continuation.e2e.ts` adds three isolated browser journeys. Synthetic registered households and actual local guest sessions use the existing Worker/SQLite fixture. Cached long identity and held/HTTP500 session reads are explicitly shaped. External API fetch and service workers are blocked by the fixture; no live provider or customer data is used.

## Behavior verified

- Registered profile: `/profile` redirects to `/me`; name/email match the actual local `/api/v1/me` response before the long-name scenario. A long Vietnamese cached name and synthetic email wrap through nine viewport/text configurations. This is client-cache shaping, not a server profile update.
- Navigation: keyboard Enter opens all six existing destinations and verifies their current headings, then browser back returns to Profile. These are destination/read checks, not completion of each destination's forms, persistence or permissions matrix.
- Plus: registered href remains `/plus`; guest href remains `/auth?mode=login&returnTo=%2Fplus`. Registered link focus/trial actionability is checked without activation. No upgrade, checkout or payment action is invoked; Plus entitlement/provider states remain untested.
- Registered logout: keyboard opens the existing alertdialog, initial Cancel focus and Tab wrap are verified, both buttons are measured, Escape closes it and focus returns to the trigger. Guest logout opens with Space and cancels with Enter. Neither journey commits logout or changes its authority.
- Guest: the real local landing trial action creates the session before write monitoring starts. Profile retains `Phiên dùng thử` and `Chưa liên kết email`. No writes occur in either monitored registered/guest journey after setup. Registered inventory/shopping snapshots remain unchanged.
- Session: holding the actual session GET displays loading without private profile content. Shaping only that GET to HTTP500 displays the existing verification error without private profile content. Removing shaping and keyboard retry recovers the actual local profile. No authentication implementation is changed; this is bounded guard/read coverage.

## Responsive and accessibility evidence

Final browser: 6/6 PASS in 42.2s across separate mobile-390 and desktop-1440 contexts. Each context captures 24 state/config combinations: nine long-identity configurations, plus three each for real registered, guest, logout dialog, session loading and session error. Long identity uses 320x568, 360x800, 390x844, 430x932, 768x1024, 1024x768, 1440x900, 320x420/text200 and 320x568/text200. Compact states use 320x420/text200, 390x844 and 1440x900.

All 48 final document measurements retain the requested width, no horizontal overflow or broken images, and unclipped measured account links. Across both contexts 192 account-link/dialog-button measurements are actionable after scrolling, at least 48px high and within horizontal bounds. Session states have no account-link controls; the retry is keyboard exercised separately. The measurement set does not include every control on the page.

All 48 final axe reports have zero reported violations; all retain incomplete color-contrast checks. Manual accessibility, screen-reader and owner visual review remain pending. Registered mobile390, long identity desktop1440 and logout320/text200 screenshots were visually inspected. Full-page screenshots retain keyboard focus/skip-link states and fixed navigation; modal captures are not whole-page viewport-fit certificates. Root-font scaling simulates enlarged text and does not certify OS/browser zoom, physical devices or every transient resize frame. Session-state captures do not explicitly set reduced motion; registered/guest journeys do.

`evidence/profile/manifest.json` binds 153 payloads: 72 PNG, 72 axe JSON and nine summaries. Before: 24 PNG/axe and three summaries from the corrected three-test mobile baseline before the product-copy change. After: 48 PNG/axe and six summaries across both contexts. SHA256, byte counts, PNG signatures/dimensions, exact state/config coverage, source identity and behavior summaries verify. Existing packet manifests/receipts remain historical and unchanged.

## Checks and retained failures

`evidence/profile-checks.json` binds the implementation's two source hashes, 11 check logs and seven retained logs. Final targeted ESLint, lint, web/Worker types, local migration smoke, default build and actual paired build PASS. Existing focused units: four files/76 tests PASS in 1.30s. Existing focused integration: three files/104 tests PASS in 6.64s. Browser: 6/6 PASS in 42.2s. Commands and exact log hashes are in the receipt and `TEST_BASELINES.md`.

Full `pnpm test` under the recorded canonical TMPDIR remains PARTIAL: 410/412 files and 9,163/9,168 tests pass in 185.62s, with five inherited encoded-space CLI failures in production-catalog-continuity/release-check and no timeouts. Protected release scripts/tests remain unchanged. `pnpm audit --json` exits 1 with inherited one low, six moderate and one high finding, including Vite GHSA-587h-7wmj-h5pm. Dependencies remain unchanged; no full-suite or security-gate pass is claimed. Existing Admin font warnings remain in build logs.

Retained attempts include the initial narrower passing baseline, two 2-pass/1-fail runs caused by incorrect harness expectations for the actual household/planning headings, and the corrected 3/3 pre-copy baseline. The paired flag selects `Thói quen bữa nhà`; navigation already worked. These harness corrections do not conceal a product failure. Pre/post-implementation recovery checks and read-only remote-main output are also retained. Raw logs/private recovery locations stay local and ignored.

## Recovery and next action

The full private snapshot verifier passed again during documentation finalization: 22,763 original regular files and 772 symlinks match bytes/modes/links/HEAD/index/status, with zero worktree differences and private parent permissions 0700. Original 11 modified/42 untracked files, components, assets, Git and ignored files remain recoverable. Authorized shared Git metadata differs. The sanitized post-implementation receipt is `evidence/profile-recovery-verification.json`.

Evidence verification, protected-main audit, changed-text credential/private-backup-path scan and whitespace validation run before this documentation checkpoint. The source manifest retains 54 selected paths; Argon ledger retains 69 rows, asset ledger 12 rows, file decisions now 88. All 38 screen rows retain owner review PENDING; row30 points to the new evidence. Prior report and mandatory handoff tails are preserved byte-for-byte.

Next bounded packet: row31 household/family source review and isolated local API/browser baseline. Inspect actual membership/role/sharing capabilities before changing presentation; preserve server authority and describe unavailable functions honestly. Full destination mutation/permissions coverage, logout commit, live providers, Week-OFF, physical devices, screen readers, performance and production remain open. No push, PR publication, merge, deployment, remote migration or production action occurred. Recovery uses a reviewed integration revert while preserving original WIP and private snapshot.
