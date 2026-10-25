# Computed text contrast audit - 2026-10-24 JST

Status: `LOCAL_COMPUTED_TEXT_CONTRAST_BOUNDED_VERIFIED`; owner acceptance PENDING.
Implementation: `fedf0e7571b659dfdfec916a713b3c9a71be4cf4`, branch `codex/takolio-v2-rescue`, integration `/Users/tunbee27/Documents/New project/Takolio-v2-codex-integration`.
Read-only `git ls-remote origin refs/heads/main` still returns `90b94129113b41e34701d99f51175cfa81cb73de`.

One browser test file added; no product/CSS/asset/dependency changes. Existing Argon work and canonical Week/account implementation retained. No missing illustration or palette defect was established by this audit.

## Observations

| Evidence | Actual result |
|---|---|
| Browser | 4 passed in 48.1s; launcher 48.99s; self-check plus real local journey in each context |
| Coverage | 14 states x 3 configurations x 2 Chromium contexts; 84 PNG and 84 JSON |
| Solid CSS pairs | 4,902 pass; minimum 6.119203774745377:1; smallest margin above applicable threshold 1.619203774745377 |
| Gradient CSS pairs | 516 raw manual-review samples; exact observed CSS bounds reviewed separately; minimum lower bound 5.178275830766979:1 |
| Disabled | Six disabled import text samples exempt from WCAG 1.4.3; not enabled-text passes |
| Axe 4.10.3 | 84 reports with zero reported violations; all 84 retain incomplete color-contrast; 798 checks report bgGradient |
| Runtime | Existing local plan creation returns 201; alternatives read returns 200; inventory snapshot unchanged |
| Product delta | None; evidence does not justify a palette replacement or frontend rebuild |

States: Week empty; four setup stages; board; share; meal; alternatives sheet; shopping list; shopping active; Week settings; Profile; Privacy. Generation pending is not captured by this packet. Configurations: 390x844/text1, 320x420/root text200, 1440x900/text1. Both mobile-390 and desktop-1440 browser contexts run all three; resizing a mobile context is not physical desktop/device evidence.

The collector walks rendered DOM text, including offscreen text. While a dialog is open it inspects that dialog; otherwise it inspects the first `.takosan-rebuild`. It records computed foreground, font size/weight, ancestor backgrounds, opacity, filters, blend and generated backgrounds. It composes solid alpha colors, applies the 4.5:1 normal/3:1 large-text thresholds, and refuses unsupported painting. A runnable self-check covers black/white 21:1, alpha black/white, threshold distinction, gradient/opacity refusal and disabled exemption. All axe incomplete node/check details remain in JSON.

## Gradient review

Only the exact observed declarations receive bounds; other declarations remain manual review.

- Week: `radial-gradient(at 100% 0px, rgb(233, 238, 224), rgba(0, 0, 0, 0) 48%), none` over opaque `rgb(255, 248, 237)`. Every background channel remains between #e9eee0 and #fff8ed. Each sampled text color is opaque and darker in every channel; monotonic luminance gives a conservative contrast lower bound from the darkest endpoint.
- Account: `linear-gradient(rgba(255, 248, 237, 0.96), rgba(255, 248, 237, 0.72) 288px), none` (576px under text200) over the identical opaque cream. Compositing gives constant cream.
- Full recorded ancestor chains have no group opacity, filter, blend, generated background or text shadow for these samples. The nearest gradient's opaque base blocks lower background layers. Raw rows remain `manual-review`; this separate CSS review does not convert axe incomplete results into passes.

Three contact sheets were visually inspected: normal mobile, root text200 and desktop. Captured pine/coral/cream layout, original assets, Week columns and account presentation remain coherent. Text200 viewport crops show scrolling content beyond the frame. Contact sheets are review aids, not pixel approval; no before/after visual improvement is claimed.

## Executed checks

All commands run in integration with `/opt/homebrew/opt/node@24/bin` prepended to PATH, Node v24.16.0, inherited TMPDIR resolved to its real path. Exact launchers, commands, logs and SHA256 receipts: `evidence/computed-contrast-checks.json`.

| Command | Result |
|---|---|
| `PORT=3297 PREVIEW_API_PORT=8917 PREVIEW_MEAL_PLANNER_ENABLED=false PREVIEW_MEAL_COMPOSITION_V2=false pnpm exec playwright test -c playwright.t17.config.ts tests/e2e/t17-ui/takolio-computed-contrast.e2e.ts --project=mobile-390 --project=desktop-1440 --output=.artifacts/takeover/contrast/initial` | 4 passed; exit 0; wall 48.99s |
| `pnpm exec eslint tests/e2e/t17-ui/takolio-computed-contrast.e2e.ts` | PASS; 1.38s |
| `pnpm lint` | PASS; 8.09s |
| `pnpm typecheck` | PASS; 21.82s |
| `pnpm test` | PARTIAL; exit 1; 410/412 files, 9164/9169 tests; reported 260.71s, wall 262.19s |
| `pnpm check:migrations` | PASS; 0.75s; local smoke only |
| `pnpm build` | PASS; 11.89s |
| `VITE_MEAL_PLANNER_ENABLED=true VITE_MEAL_COMPOSITION_V2_ENABLED=true pnpm build` | PASS; 13.20s |

The same five inherited CLI failures in production-catalog-continuity/release-check reference `New%20project` instead of the filesystem space. Existing Admin font build warnings remain. Dependencies unchanged; last dependency audit still records 1 low/6 moderate/1 high, including Vite GHSA-587h-7wmj-h5pm. That dependency audit was not rerun in this packet. No backend, packages, auth, security, stock authority, schema, PayOS, payment or infrastructure change.

## Evidence integrity and limitations

`evidence/computed-contrast/manifest.json` binds 169 payloads: 84 PNG, 84 raw JSON and one reviewed summary. PNG raw/public bytes match. Public JSON uses compact serialization with identical parsed content; immutable raw and public sizes/SHA256 are bound separately. PNG dimensions and complete state/config/context coverage are checked. The checks receipt binds 31 committed source objects (30 existing, 26 identical to canonical main), eight check logs, final harness, collection scripts, contact sheets, receipts and 13 retained partial-collector artifacts. All existing reviewed sources match the implementation parent.

Initial browser attempt: 2 failed/2 passed, wall 88.88s. Home's `.home-workspace` was absent because the preview fixture reached onboarding. Final bounded audit excludes Home; it does not change auth or domain guards. The first attempt's log/output destination was accidentally reused by the passing run; original failed-run raw files are NOT retained/hash-bound. Only the tool-transcript result and explicit disclosure remain. Passing raw evidence is retained and bound. This is an evidence-handling limitation.

The first collector assertion incorrectly required exactly one gradient ancestor; corrected to inspect the nearest opaque layer, with partial output preserved privately. Initial recovery verifier used `dir` while the baseline schema uses `directory`; corrected comparison reports zero worktree differences. PIL was unavailable; installed Sharp produced contact sheets without a new dependency.

No pixel sampling, occlusion, background-overlap, icons, borders, focus ring, hover/pressed, placeholders, native zoom, physical-device, assistive-technology, performance, all-38-screen or full WCAG certification. Screenshots are viewport captures, not full content/reachability proof. No successful stock import, actual swap, clipboard/native share or Week durable-offline guarantee is added. All 38 owner reviews remain PENDING.

## Recovery and next action

Fresh post-implementation verification: original Argon workspace and private snapshot match 22,763 regular files/772 symlinks, bytes, modes, links, HEAD, index and preflight status. Snapshot worktree also matches its stored baseline; zero differences; private backup parent 0700. Authorized shared Git metadata changes are disclosed separately. Exact recovery location stays private. Sanitized receipt: `evidence/computed-contrast-recovery-verification.json`.

FILE_DECISIONS appends one test decision (104 to 105). Only SCREEN_PROGRESS rows 23,24,26,27,30,36 append bounded contrast evidence; row25 generation-pending has no new capture. Previous fields remain prefixes; all owner statuses remain PENDING. Eight handoff documents retain historical tails byte-for-byte. Implementation and documentation checkpoints are separate; this report cannot name its own commit.

Next unblocked packet: isolated local Week flags-OFF selected-only stock import, actual swap/readback and clipboard success/error verification, preserving command/idempotency and stock authority. Home's onboarding fixture path and wider manual contrast/control-state/device review remain open. Week offline durability needs its own domain packet/ADR. No push, PR publication, merge, deploy, remote migration or production action.

Finalization executed: protected-main scope PASS with5,837unchanged protected paths; historical and computed-contrast evidence validation PASS; current source objects/logs/captures and all eight historical tails verified; 104 prior file decisions preserved; only rows23,24,26,27,30,36 append contrast notes. Credential/private-recovery-path pattern scan and whitespace check PASS. Private snapshot Git baseline also matches all116regular Git files; full snapshot baseline integrity verified. All38owner reviews remain PENDING. Local documentation checkpoint follows separately.
