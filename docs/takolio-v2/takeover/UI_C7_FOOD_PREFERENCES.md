# UI08 Food preferences row33 continuation - 2026-10-24 JST

Status: `LOCAL_FOOD_PREFERENCES_SESSION_VERIFIED`; owner acceptance PENDING. Implementation `793ade743aecc4cafd0c39f8e1bd3e457f75bc50` on `codex/takolio-v2-rescue`; integration `/Users/tunbee27/Documents/New project/Takolio-v2-codex-integration`. Read-only canonical main remains `90b94129113b41e34701d99f51175cfa81cb73de`.

## Confirmed behavior and change

Existing UI08 FoodPreferencesPage retained. Corrected two offline-only messages to disclose that choices apply to this session and disappear on reload. Added one unit case and three browser journeys across two contexts. No persistence/API/store/handler/CSS/component/asset or protected system changes. Legacy tastes `/preferences` remain separate from hard safety `/family-preferences`.

The baseline page is byte-identical to canonical main. Offline guest selections update the existing in-memory Zustand state only. They survive route changes but reset on reload; the former success text said they were saved and the note implied device persistence. The identical before/after browser harness reproduces that mismatch in both contexts. Product changes are limited to the offline note and conditional success text. Online success remains unchanged. This packet deliberately retains the existing session lifetime and does not introduce a second persistence mechanism.

Existing AccountPage, Button, StickyActions, fieldsets/chips, icons and account CSS remain reused. No missing illustration or SVG was evidenced. Backend, auth/security, payment, inventory/outbox, hard-safety rules, Week compatibility, schema, dependencies and production infrastructure remain unchanged.

## Browser and unit verification

Three journeys execute in each mobile-390 and desktop-1440 context. Each state captures requested320x568,320x420 with root text200,390x844 and1440x900. Actual innerWidth is asserted before overflow checks. Enabled account-body buttons pass trial interaction; disabled pending controls still fit. This is a bounded account-body control audit, not a claim about every global control.

The registered journey seeds synthetic size7, spicy hot, italian/vegetarian and languageen. Keyboard changes issue the exact four-field PATCH while retaining unknown tags and size7 through5+. A held real PATCH keeps the entire draft disabled and server unchanged until release. Real reload proves persistence and preservation of language. A shaped500 PATCH focuses the existing error without success, then retry reaches the real API. A later unsaved choice disappears after reload. Three monitored PATCH attempts include one shaped failure; setup writes occur before monitoring. Family hard safety, inventory, shopping and onboarding stay equal.

The read journey holds a real GET, confirms the draft is hidden while loading, then shapes500, confirms the editor remains hidden, and retries via keyboard to real API data. No writes occur. The offline journey enters through the actual failed guest-start fallback with all API calls aborted, applies choices, confirms they survive navigation, and confirms reload resets them. No monitored writes occur. The new unit case checks the honest note/status, no API calls, store-only changes, unchanged onboarding and success clearing after further edits.

268 bound payloads: 128 PNG, 128 axe JSON and twelve summaries. Four viewport/text configs x eight states x two contexts per phase. All 64 final axe reports have zero reported violations with incomplete color-contrast; 1,256 measured controls including disabled actions. Real local PATCH/reload preserves size7, unknown vocabulary and language; pending lock, shaped500 retry and unsaved-discard checks pass. Hard safety, inventory, shopping and onboarding snapshots unchanged. Read/offline monitored journeys make no writes; offline selections survive navigation and reset on reload.

Visually inspected before/after offline-applied320/text200, final offline desktop1440 and save-error320/text200. Text wraps and controls remain reachable. Root-font text200/reduced-motion Chromium and shaped read/write500 do not certify OS zoom, physical devices, screen readers, live providers, full Week-OFF, performance or production. Full-page captures follow trial-control/focus scrolling and can include fixed chrome/skip links; no pixel or owner acceptance claimed.

## Actual baselines and gates

Pre-fix browser:4 PASS/2 FAIL in2.1m; only the offline note/status assertions fail, one journey per context. Final:6/6 in2.4m. Harness SHA256 `9a3ac3ae0d106849d6447fde1862ad36e6bb800e8cea6e0ae76ad7806c0a7b53` is identical before/after. The old page and harness copies are retained and hashed. No failing assertion was removed or weakened.

Browser 6/6 in 2.4m; focused 5 files/103 unit tests (2.19s) and 3 files/104 integration tests (7.63s); targeted ESLint, lint/types, local migrations and default/paired builds PASS. Full suite rerun under v24.16.0: 410/412 files, 9,164/9,169 tests; duration 197.54s (transform 15.86s, setup 4.53s, import 95.05s, tests 1175.07s, environment 24.69s), wall 198.76s. Same five inherited encoded-space CLI failures remain. Initial Node25 suite was interrupted after a stalled synchronous Python child; no completed count claimed for that attempt. Audit retains inherited 1 low/6 moderate/1 high including Vite GHSA-587h-7wmj-h5pm.

Focused command included nonexistent `tests/unit/family-preferences-api.test.ts`; Vitest selected five actual files/103 tests, not six. Exact commands, environment overrides, log hashes, outcomes and wall times are in `evidence/food-preferences-checks.json`. Node25 full suite stalled in recipe-catalog-recovery's Python subprocess; read-only samples show child read / parent SyncProcessRunner wait. Ctrl-C ended that process group. This is an observed runner stall; Node25-specific causation is not proven. Both samples and incomplete raw log remain ignored and hash-bound. Node24 rerun uses unchanged source/config/tests.

## Evidence, recovery and next action

The manifest binds268 payloads and raw output parity:128 PNG,128 axe JSON and twelve summaries. Synthetic fixed preferences and PATCH bodies contain no customer data, credentials or household IDs; raw traces/error contexts/logs stay ignored. Validator checks exact state/config completeness, hashes/PNG dimensions, roundtrip fields, write bodies, no-write journeys, honest before/after text, committed source/log hashes and sanitized recovery receipt.

Post-implementation private recovery verification matches original Argon WIP: 22,763 regular files / 772 symlinks, bytes/modes/links/HEAD/index/status, zero worktree differences, private parent0700. Exact backup location stays private. Selected source54 paths, Argon ledger69 rows and asset ledger12 rows intact; file decisions95; all38 owner statuses PENDING.

Mandatory state/board/handoff and five takeover checkpoints prepend current facts while retaining historical tails. Protected-main audit, all historical/current evidence validation, changed-text credential/private-path scan, whitespace and historical-tail validation run during finalization. No new concrete regression was found in the reviewed three-file product/test diff; remaining uncertainty is listed above. Next bounded packet: row34 planning settings source/API/browser baseline; preserve revision conflict handling, hard allergen/exclusion authority, current meal plans, household isolation and legacy flag compatibility. Owner/device/manual accessibility review remains open. No push, PR publication, merge, deploy, remote migration or production action.
