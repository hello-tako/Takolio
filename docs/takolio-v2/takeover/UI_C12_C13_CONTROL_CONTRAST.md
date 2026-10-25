# C12/C13 control contrast and finite frontend plan checkpoint

Date: 2026-10-24 JST. Status: `LOCAL_FRONTEND_PLAN_BOUNDED_COMPLETE_REVIEW_REQUIRED`.
Implementation: `4afc85804478fa9508b15b1c035da0e10f964822`, branch `codex/takolio-v2-rescue`.
Integration: `/Users/tunbee27/Documents/New project/Takolio-v2-codex-integration`.
Read-only official main: `90b94129113b41e34701d99f51175cfa81cb73de`.

## Change and preserved authority

ADR-064/065 retain Argon's existing layout, components, assets and handlers. C12 restores muted-text placeholder colors and the notification OFF-switch track. C13 adds a 1px inset stroke to scoped existing search/select/filter/date/number/shopping controls. The only runtime delta in this implementation is 31 CSS lines in `src/web/styles/kitchen-upgrade.css`; the existing solid focus outlines remain. One runnable Playwright regression covers the measured states. No missing or poor vector asset was established, so no replacement illustration was invented.

The integration continues from official main with selective Argon salvage. Backend, services, stores, dependencies, schema, auth, household isolation, inventory commands, Week compatibility and payment/Plus authority remain protected. Original Argon workspace is read-only. No push, published PR, merge, deploy, remote migration or production action.

## Browser evidence

Exact command and frozen source hashes: `evidence/control-contrast/execution/c12-c13-final-1-receipt.json`. Playwright: **4 passed**, 249.59s wall; two tests in each of two Chromium projects. Both projects repeat viewport loops, not independent physical devices.

C12: 63 observations per project; 15 axe reports, zero violations, six incomplete reports. Placeholder samples exceed 4.5:1; measured switch boundaries/thumb exceed 3:1. Space/Enter toggles the promotional switch, then real reload retains its local preference. Disabled unavailable controls remain descriptive and excluded from active-control contrast requirements. No domain write; five endpoint snapshots remain equal.

C13: 44 control/configuration combinations and 132 state observations per project. Configurations: 320x568, 320x420/root-font200, 390x844, 1440x1000. Minimum stroke/fill 6.6456:1; stroke/parent 6.3520:1. The 1px inset stroke preserves the measured rectangle, existing focus outline and checked 44px targets. Writes, external-request and page-error arrays are empty after fixture reset; five endpoint snapshots remain equal. Final raw run contains 130 PNG.

Both tests force reduced motion. `normal` means unfocused/unhovered, not normal-motion certification. Keyboard modality uses Tab followed by targeted programmatic focus; no full natural Tab-order or screen-reader claim. C13 does not edit every input/select or keyboard-activate the disclosure. Geometry baseline disables only the candidate shadow, not the entire historical CSS. C12 baseline desktop1440x1000 differs from final1440x900; family baseline is normal-state only. Shared selectors affect unmeasured sibling filters, family onboarding/setup and other notification switches; no all-instance certification. C12 isolation blocks known external image requests; it does not prove zero attempted external images. Independent review found no concrete runtime blocker; its complete limitations are retained in `evidence/control-contrast/execution/independent-review.md`.

## Current recertification of existing UI09/UI04

Both runs used actual isolated local Worker/SQLite and deterministic fixtures. Receipts record HEAD `c50c737d97e4385db90fa9e8a05fb8fbc832edb4`; their 1,104 before/after source entries are equal and include the final C12/C13 CSS hash. Do not relabel the recorded HEAD. Six receipts, archived harnesses and payload hashes verify. Full report: `evidence/control-contrast/execution/recertification-report.md`.

- Group A / UI09: **PARTIAL**, exit1; 51 layout/axe snapshots, 10 journeys, 52 PNG. Canonical adoption, metadata edit/cancel/save-lock/failure/retry/reload, reconciliation and deliberate lazy-module failure through the actual AppErrorBoundary/reload pass. Manual add preserves name, quantity0.25, unit pack, pantry and null expiry, but chosen category `spice` reads back `other`. UI submits category; canonical read authority derives a fallback category. Preserve this failure for a separate inventory-domain packet. The run includes intentional mutations; only its read-only matrix has zero writes.
- Group B / UI04: **bounded harness PASS**, exit0; 29 snapshots, eight journey groups, 51 PNG. Photo/receipt confirm200 and confirmed reopening, rejected/restored rows, fractional scan values and source binding pass. Additional verified gap: manual `Muoi`/`Muối`0.25pack reaches authoritative inventory but is absent from `scan.items`, so reopened scan history omits that manual line. Scan review values do not certify every merged inventory field: milk may retain existing fridge/expiry through merge. Separate scan persistence/domain packet required; no inventory data loss claimed.

A1-A4 failures remain retained; no assertion weakened. Source drift during each final run is zero. Owned ports3305/8925 closed. Physical camera, live OCR/AI and hosted services were not exercised. Row38's older "ErrorBoundary crash unverified" is superseded for this deliberate crash and actual reload only, not arbitrary crashes.

## Executed gates

Node v24.16.0, PATH `/opt/homebrew/opt/node@24/bin`. Exact commands, exit codes, log bytes and SHA256: `evidence/control-contrast/final-checks.json`. Raw gate logs remain ignored/private; their hashes do not imply logs are copied into the tracked packet.

| Command | Result | Wall time |
| --- | --- | --- |
| `pnpm exec eslint tests/e2e/t17-ui/takolio-control-contrast.e2e.ts` | PASS | 1.40s |
| Focused Vitest command in final-checks receipt | PASS, six files / 125 tests, 2.18s reported | 3.14s |
| `pnpm lint` | PASS | 8.55s |
| `pnpm typecheck` | PASS | 20.63s |
| `pnpm test --maxWorkers=1` | PARTIAL, 410/412 files, 9,164/9,169 tests | 1084.56s, 1083.38s reported |
| `pnpm check:migrations` | PASS | 0.78s |
| `pnpm build` | PASS | 15.13s |
| `VITE_MEAL_PLANNER_ENABLED=true VITE_MEAL_COMPOSITION_V2_ENABLED=true pnpm build` | PASS | 13.14s |
| `pnpm audit --audit-level high` | FAIL, 11 advisories: 1 low / 8 moderate / 2 high | 2.22s |
| `git diff --check` | PASS before implementation commit; repeated for checkpoint | See finalization receipt |

Five full-suite failures remain inherited encoded-space `New%20project` / `MODULE_NOT_FOUND` CLI failures: four in `release-check.test.mjs`, one in `production-catalog-continuity.test.mjs`. No tooling test changed or disabled. Existing Admin font warnings remain. The new dependency audit supersedes older 1/6/1 counts: high Vite `GHSA-587h-7wmj-h5pm` and Zod `GHSA-mrhx-c7xc-m3w5` (patched >=4.6.6). Dependencies unchanged; upgrades require their own bounded compatibility/security work. Local frontend completion does not mean green full suite or release readiness.

## Recovery and evidence integrity

After implementation4afc8580, original and private full snapshot match **22,763 regular files / 772 symlinks** in bytes, modes, links, HEAD, index and preflight status. Snapshot matches its stored workspace baseline and all **116 regular Git baseline files**; zero differences, backup parent0700. Shared Git metadata changes from authorized integration work are disclosed separately. Exact private recovery location stays unpublished. Receipt: `evidence/control-contrast/recovery-verification.json`.

The original selective manifest remains immutable: **67 exact-byte payloads**, including37PNG; **374 retained raw bindings**. Supplemental recovery/protected/final-check/report receipts are bound separately by `evidence/control-contrast/finalization.json`. Failed attempts remain retained; omitted full captures/logs/traces stay ignored/private. All prior report tails, 112 existing file decisions, selected54paths, Argon69rows, asset12rows and38PENDING owner statuses are preserved. New decisions append three rows, total115. Protected-main audit verifies5832unchanged protected base paths; allowed paths are explicitly reviewed, not certified unchanged.

## Finite plan disposition and next action

See `FRONTEND_PLAN_STATUS.md` for UI01-UI15 and external acceptance. C12/C13 and both planned recertification groups have executed. No further frontend runtime change is justified by a reproduced defect in the reviewed packets. Current local frontend execution is complete within the documented bounds; product acceptance remains open. Historical generic FAIL counters and old "next C11/C12/Week" wording remain history, superseded by this checkpoint.

Next work is separately scoped: inventory category readback; scan manual-line history/merge semantics; Week durable offline receipts/replay; inherited CLI path failures; dependency advisories. Preserve backend/domain authority until a concrete packet defines the intended behavior. Owner38screens, media rights/mapping, real devices/Safari/native zoom/assistive technology/live providers and hosted acceptance remain pending. This checkpoint grants no release or production approval.
