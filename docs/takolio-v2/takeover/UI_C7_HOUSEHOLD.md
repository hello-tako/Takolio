# UI-C7 household continuation - 2026-10-24 JST

Status: `LOCAL_HOUSEHOLD_REFLOW_VERIFIED`; owner visual acceptance remains PENDING. Implementation: `d9107856888cafd2dc3d0462f4a03595c7b72fa4`. Integration: `/Users/tunbee27/Documents/New project/Takolio-v2-codex-integration`, branch `codex/takolio-v2-rescue`. Read-only canonical GitHub main remains `90b94129113b41e34701d99f51175cfa81cb73de`. This bounded row31 packet reuses UI08 FamilySharingPage, AccountPage, Section, Surface, StatusBadge, UnavailableState and the existing Users icon. No missing illustration or SVG was identified.

## Evidence and change

The local `/family` alias resolves to `/me/household`. Household identity comes from the actual isolated local `/api/v1/me` session. There is no existing invite/join/member-list/role-mutation contract to expose. The three honest unavailable notes and absence of fabricated actions remain intact.

The pre-change browser baseline reproduced guest layout failure at both 320x568 and 320x420/text200 in both browser contexts. Mobile emulation expanded both innerWidth and document scrollWidth to 330 despite a requested width of 320. Desktop context retained innerWidth 320 but scrollWidth 340. Comparing scrollWidth to innerWidth alone would miss the mobile failure; evidence validation checks both against the requested viewport width. These are four failing captures within two failed guest tests; the six-test baseline had four passing tests. Raw baseline terminal output was not retained. Its `.last-run.json`, before screenshots/axe/summaries, error contexts and traces remain local; no missing log is fabricated.

The existing account grid allowed its Family child to retain an intrinsic minimum width. `src/web/pages/FamilySharingPage.tsx` adds `min-w-0` to that child and two text class hooks. `src/web/styles/kitchen-account.css` appends scoped `overflow-wrap:anywhere` for household ID and membership copy. The prior CSS remains an exact byte prefix, including the notifications correction at `8c1ad40ec5e63587c8b3b2900d0e683b35a3c794`. Its historical receipt remains bound to that immutable Git object; it is not rewritten to describe current tests.

No backend, auth/security, payments, household authority, inventory command, revision/idempotency, Week compatibility, schema, dependency or infrastructure changes occur. Product changes preserve the existing markup, copy, components and assets apart from these layout hooks. No sharing feature is invented.

## Bounded browser coverage

`tests/e2e/t17-ui/takolio-family-continuation.e2e.ts` adds three journeys in separate mobile-390 and desktop-1440 contexts:

- Registered local household: actual session ID matches cached and displayed ID; alias resolves correctly; all three unavailable notes remain; no invite/join/member controls appear. Keyboard Enter follows the existing back link to Profile and browser back returns. Monitored requests issue no writes; inventory and shopping snapshots remain equal.
- Cached long display name: explicitly shape only `frigo_display_name`; server household ID remains authoritative. Final input is an unbroken Vietnamese name repeated twelve times. This journey retains after-only inventory/shopping reads; it does not assert before/after equality or monitor writes.
- Actual local guest: create the session through the existing trial action, then begin write monitoring. Household ID matches the real local session, all unavailable notes remain and no subsequent API writes occur. Session setup writes are outside that monitored interval.

The baseline cached long name contained spaces; final input is unbroken. There is no matched before/after unbroken-name baseline claim. The guest requested-width comparison is supported by both before and after captures.

Each state covers 320x568, 320x420/text200, 390x844 and 1440x900. All 24 final observations retain requested innerWidth, no document overflow, no broken images, both measured text nodes present and unclipped, and no fabricated body links/buttons. The registered journey separately exercises the header back link; body-control counts do not imply measurement of every header/navigation control.

Final browser: 6/6 PASS in 19.3s (runner wall 19.99s). All 24 final axe reports show zero violations; all retain incomplete color-contrast checks. Manual accessibility and owner visual acceptance remain pending. Before guest320, final guest320, final unbroken-name320/text200 and registered desktop1440 screenshots were visually inspected. Root-font scaling, full-page capture and local Chromium do not certify physical devices, OS zoom, screen readers, performance, full Week-OFF, providers or production.

## Verification and provenance

`evidence/household/manifest.json` binds 108 payloads: 48 PNG, 48 axe JSON and twelve summaries. Before and after each contain 24 PNG, 24 axe and six summaries across both browser contexts. The evidence validator checks hashes/bytes/PNG dimensions, exact state/config coverage, four requested-width failures, final fit, server identity/no-write boundaries and incomplete accessibility findings.

`evidence/household-checks.json` binds the three implementation source hashes and eleven final check logs, four retained logs and one baseline run artifact. The retained logs are the earlier three-test passing layout attempt, pre/post-implementation recovery and read-only main check; debug/debug2 artifact directories have no raw terminal logs. Raw local fixtures, traces, logs and private recovery paths remain ignored.

Final targeted ESLint, `pnpm lint`, `pnpm typecheck`, local `pnpm check:migrations`, default build and actual paired build PASS. Existing focused units: four files/76 tests in 1.38s; focused integration: three files/104 tests in 6.67s. Exact commands/exit codes/times/log hashes are in the receipt and `TEST_BASELINES.md`.

Full `pnpm test` under the recorded canonical TMPDIR remains PARTIAL: 410/412 files and 9,163/9,168 tests pass in 192.21s (runner wall 193.09s). Five inherited encoded-space CLI failures remain in production-catalog-continuity/release-check; this run has no timeout. `pnpm audit --json` exits 1 with inherited one low, six moderate and one high finding, including Vite GHSA-587h-7wmj-h5pm. Dependencies, protected release scripts/tests and existing Admin font build warnings remain unchanged.

## Recovery and handoff

Post-implementation private snapshot verification PASS: 22,763 regular files, 772 symlinks, bytes/modes/links/HEAD/index/status, zero original-workspace differences and private parent permissions 0700. Original Argon WIP, Git and ignored files remain recoverable; authorized shared Git metadata differs. Sanitized receipt: `evidence/household-recovery-verification.json`.

Protected-main audit, evidence/source/log verification, changed-text credential/private-path scan, whitespace and historical-tail checks run during documentation finalization. The selected Argon source manifest remains 54 paths; Argon ledger 69 rows, asset ledger twelve rows, file decisions ninety rows. All 38 screen owner statuses remain PENDING. Row31 points to the final guest evidence. Historical reports/receipts retain their original tails/content.

Next bounded packet: row32 App Settings source/API/browser baseline under UI08, preserving cache/outbox/data semantics and existing device-local capability limits. Sharing APIs remain unavailable; implementing backend sharing is outside this packet. No push, PR publication, merge, deploy, remote migration or production action occurred. Local rollback can use a reviewed integration revert while preserving original WIP and private recovery snapshot.
