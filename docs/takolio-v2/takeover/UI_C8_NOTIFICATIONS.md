# UI-C8 notifications continuation

Status: `LOCAL_NOTIFICATIONS_REFINEMENT_VERIFIED`; owner visual acceptance remains PENDING. Implementation: `8c1ad40ec5e63587c8b3b2900d0e683b35a3c794`. Integration branch: `codex/takolio-v2-rescue`; fresh read-only GitHub main: `90b94129113b41e34701d99f51175cfa81cb73de`. This bounded row29 packet continues existing UI08/ADR-051. Full V2 remains partial.

## Measured problem and correction

A notification with an unbroken long Vietnamese ingredient label expands the existing card and grid to their min-content width. Before correction, the requested 320px mobile viewport reports innerWidth1280 and document width1454px; later configurations reach1887px. Across all nine long-content configurations the preferences link fails the viewport-fit check, and several cannot be clicked. Baseline axe reports zero violations despite this measured layout problem.

The only product change adds `.account-notification :is(h2, p) { overflow-wrap: anywhere; }` in `src/web/styles/kitchen-account.css`. Existing NotificationsPage, NotificationPreferencesPage, query keys, service, navigation, icon fallback and assets are reused. No new illustration or SVG is needed. Backend, auth/CSRF, household isolation, inventory authority, revisions/idempotency, Week compatibility, payments, schemas, dependencies and infrastructure retain prior bytes.

Codex-authored `tests/e2e/t17-ui/takolio-notifications-continuation.e2e.ts` adds two browser tests. Actual local Worker/SQLite cases are distinguished from notification-only shaped responses. These are isolated synthetic households, with external fetch and service workers blocked.

## Behavior verified

- Real API: existing native-inventory fixture plus an actual UI-created shopping item produces expiring-stock and shopping-reminder notifications. Card title, message and datetime match the response. Shopping count is one. Inventory and shopping snapshots remain unchanged throughout subsequent reads/preferences navigation; no API writes occur after setup.
- Keyboard: Enter opens the preferences link; Space toggles shopping intent; reload retains false in the existing owner-scoped localStorage key. The explicit device-only disclosure remains visible. Returning to the inbox retains the shopping notification: these preferences do not filter the inbox or schedule delivery. Keyboard back keeps href `/`; the existing home guard redirects the unonboarded fixture to `/onboarding/household`.
- Loading: an actual notification GET is held; the loading status appears without an empty claim.
- HTTP500: notification-only shaping exercises the existing three attempts, inline error and keyboard retry; removing the shaping recovers the actual local API.
- Long/unknown type: a shaped DTO retains its title/body and the current fallback icon, with no clipped measured text or horizontal document overflow after correction.
- Explicit empty and network abort: the current empty/offline caveat appears. A network failure still resolves to the service's existing empty array contract; no new offline guarantee or backend behavior is introduced.

The existing DTO includes isRead but the inspected contract provides no mark-read or notification-action endpoint. None is invented. The inherited backend welcome fallback still names Frigo; changing that protected route is outside this packet. The bounded preference journey is not completion of all row35 states.

## Responsive and accessibility evidence

Both separate mobile-390 and desktop-1440 contexts run both tests. Real/long states each have nine viewport/text configurations:320x568/text100,320x420/text200,320x568/text200,360x800,390x844,430x932,768x1024,1024x768,1440x900. Loading/error/empty/network states each use320x420/text200,390x844/text100,1440x900/text100. Root-font scaling is simulated; this does not certify OS/browser zoom or physical devices.

Final browser:4/4 PASS in58.9s. After evidence has60PNG,60zero-violation axe reports and four summaries. All60axe reports retain incomplete color-contrast checks; manual accessibility and owner visual review remain pending. All60preferences-link measurements fit and are actionable after scrolling. No final document overflow, broken images or clipped measured title/body text is observed. Mobile390, desktop1440 and long320/text200 screenshots were visually inspected. A focused skip link appears in the enlarged full-page long capture after keyboard navigation; it is retained rather than hidden.

An earlier final run measured transient408px overflow on the first desktop1440-to320 resize while its screenshot already showed corrected wrapping. The existing ResizeObserver/rAF shell needs to settle after a breakpoint change. The harness now retains immediate measurements, then waits two animation frames before measured assertions. No shell/product timing change was made. This packet verifies settled layout and does not certify every transient resize frame.

`evidence/notifications/manifest.json` binds143payloads:69PNG,69axe and five summaries. Before evidence retains nine long-content captures, nine axe reports and the state summary. After evidence retains both contexts. SHA256, byte counts, PNG dimensions, exact state/config coverage and behavioral summaries verify. All earlier manifests and receipts remain unchanged.

## Checks and failures

Final lint, web/Worker typecheck, targeted ESLint, local migration smoke, default build and actual paired build PASS. Focused existing units:4files/76tests PASS in1.56s; focused integrations:3files/104tests PASS in6.86s. Final browser/lint/types/ESLint and canonical full suite cover committed source. Builds/focused tests use final product CSS before the final E2E-only two-frame timing adaptation.

Canonical-TMPDIR full suite is PARTIAL:410/412files,9,163/9,168tests PASS in194.75s; five inherited encoded-space CLI failures in production-catalog-continuity/release-check, no timeouts. Protected release scripts/tests remain unchanged. An earlier `/tmp` run retained18failures:five inherited CLI cases,eleven `/tmp` versus `/private/tmp` path failures and two5000ms timeouts. Correcting the environment removes the latter13; it does not make the full suite pass. Audit exits1 with inherited1low/6moderate/1high, including Vite GHSA-587h-7wmj-h5pm. Dependencies remain unchanged.

`evidence/notifications-checks.json` binds14check logs and nine retained attempt logs, commands and committed source hashes. Retained browser failures include the initial incorrect home-guard harness assumption, actual long-content overflow and the transient first-resize measurement. A purported paired-build attempt used the wrong planner variable (`VITE_PLANNER_ENABLED`); its exit0 is retained without paired-build credit. The separately executed actual command uses `VITE_MEAL_PLANNER_ENABLED=true VITE_MEAL_COMPOSITION_V2_ENABLED=true pnpm build` and passes. Raw logs/traces and private recovery paths stay ignored/local.

## Recovery and next action

After implementation, the full private verifier again matched22,763original regular files and772symlinks, bytes/modes/links/HEAD/index/status,zero worktree differences,private parent0700. Original11modified/42untracked files,Git and ignored files remain recoverable. Sanitized receipt:`evidence/notifications-recovery-verification.json`. Protected-main audit verifies5,844unchanged paths outside the explicit UI/test/handoff allowlist;zero failures. The one-path decrease is the newly justified account CSS refinement. Provenance retains69Argon rows,54selected-source paths,12assets;file decisions now86;all38screens remain mapped with owner review PENDING.

Next bounded packet:row30 profile/account under UI08 and the kit's UI-C7. Begin with source review and isolated local browser/API baseline; inspect household/food/application links and logout dialog without invoking the protected payment link/action or production. Reuse current components/assets and preserve existing session/guard contracts. Live push, permission prompts, background delivery, screen readers, full Week-OFF, providers and performance remain open. No push,PR publication,merge,deploy,remote migrations or production actions occurred. Recovery uses a reviewed integration revert while preserving original WIP and private snapshot.
