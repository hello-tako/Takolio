# PWA and flags recovery validation - 2026-10-31 JST

Status: local recovery checked; production NOT_READY. Branch
codex/recipe-v3-browser-certification, parent
ae68f7e5a4bc987155aaeed577f07f95b893359b. This slice adds checks and documentation
only. Keep approved PR51 HEAD stable. No runtime, schema, payment, authentication,
release configuration, candidate content or review state changes.

## Local checks

Node24.16.0/pnpm10.33.2. Commands run from the repository root with
`PATH=/opt/homebrew/opt/node@24/bin:$PATH TMPDIR=/private/tmp CI=1`.

- `pnpm exec vitest run tests/integration/saved-shopping-content.test.ts`:
  PASS exit0,1file/5tests,4.36s. Log/exit:
  `/private/tmp/takolio-v3-recovery-test.log` and `.exit`.
- `pnpm exec eslint scripts/recipe-v3-cooking-pwa-check.mjs`: PASS exit0.
- `node --check scripts/recipe-v3-cooking-pwa-check.mjs`: PASS exit0.
- `TAKOLIO_SW_EXPECTED_SHA=ae68f7e5a4bc987155aaeed577f07f95b893359b node scripts/recipe-v3-cooking-pwa-check.mjs`:
  PASS exit0,5checks,real service worker enabled. Original log/exit:
  `/private/tmp/takolio-v3-cooking-pwa-check.log` and `.exit`.
  Fresh recheck also PASS exit0,5checks:
  `/private/tmp/takolio-v3-cooking-pwa-recheck.log` and `.exit`.
- Exact-parent-SHA paired-ON `pnpm build:web`: PASS exit0;
  `/private/tmp/takolio-v3-sw-build.log` and `.exit`. Existing upstream Rollup
  annotation warnings retained. No changed runtime bytes in this slice.
- `pnpm check`: PASS exit0;435files/9717tests,973.91s. Both TypeScript
  projects, ESLint, database/Admin migration replay and Web/Admin/Worker builds
  PASS. Remote D1 schema/Week gates were explicitly skipped by the local command.
  Existing Zod Rollup annotations and Admin font-resolution warnings remain;
  the build emitted the font files. Expected ErrorBoundary fixture stderr remains
  in the log. Log/exit:
  `/private/tmp/takolio-v3-browser-recovery-complete-check.log` and `.exit`.
- `git diff --check`: PASS exit0.
- `python3 scripts/admin-public-scan.py`: PASS exit0 (added text only).
  Final diff/untracked review found only this validation slice; runtime, packages,
  migrations, workflows, dependency/lock and Wrangler paths are unchanged.
- `pnpm recipe:refresh:release-check`: FAIL exit1, all four actual data blockers:
  RUNTIME_PROJECTION_LOSS,INGREDIENT_RECONCILIATION_INCOMPLETE,
  SOURCE_CONTENT_VERIFICATION_INCOMPLETE,NUTRITION_EVIDENCE_INCOMPLETE.
  Log/exit: `/private/tmp/takolio-v3-browser-recovery-release.log` and `.exit`.
  Existing port24678 warning retained; the command reached the actual data gates.

The integration test uses the real Worker, SQLite and full500 catalog. It creates
V1 and composition pins, shared demand and an edited purchased amount; captures a
private historical cooking version; disables both planner flags; verifies planner
and share rejection, unchanged saved shopping, and cross-household archive denial;
executes/replays the original cooking command while OFF; reenables flags and
checks exact saved rows, purchases, archive/grants and another receipt replay.
Inventory falls30to29, one cooking receipt/event, no duplicate debit.

The PWA script uses a production-built client stamped ae68f7e5, paired UI flags ON,
390px Chromium, real service worker and the local synthetic SQLite preview API.
It restricts both target origins to exact HTTP127.0.0.1 origins and blocks external
browser requests. Offline completion retains owner, content pin, servings,
deductions and key; server state stays unchanged. Navigation/reload preserve URL
and outbox behind the existing session verification boundary. Cache contains
release JS and no private API responses. Reconnection drains the queue; replay
produces one debit/receipt/event. An unavailable version cannot substitute current
content. No page errors. Evidence, opened for visual inspection:
`.artifacts/recipe-v3/cooking-pwa/observations.json`,
`offline-session-boundary.png`, `reconnected-pinned-cooking.png`.

Reproduction requires a paired-ON production web build with
GIT_COMMIT=ae68f7e5a4bc987155aaeed577f07f95b893359b,
VITE_MEAL_PLANNER_ENABLED=true,VITE_MEAL_COMPOSITION_V2_ENABLED=true. Start
`scripts/security-preview.mjs` with PORT3234,PREVIEW_API_PORT8934,
PREVIEW_MEAL_COMPOSITION_V2=true,PREVIEW_T20_D1=true, then serve that build through
Vite preview on127.0.0.1:3334 with VITE_API_URL=http://127.0.0.1:8934. The full
repository check builds default flags, so rebuild paired-ON before repeating PWA.
These local synthetic mutations do not certify hosted staging, real devices,
an older Worker/client or a version upgrade. Registered cold offline reload
requires session verification; offline cooking UI availability across that boundary
is not claimed. hostedRecoveryCertified=false. Both preview servers were stopped
after the successful recheck.

## Retained failures

The initial PWA exploration expected cold offline cooking access. Existing
SessionBoundary correctly denied it; the final check asserts preserved queued
work and safe reconnection without changing auth. The initial recovery test
expected another household to be denied an exact current public recipe pin;
current public content can legitimately be captured by that household. The final
test uses private historical content and proves denial. Initial failing test log:
`/private/tmp/takolio-v3-recovery-test-initial.log`. No product guard was changed.

## Existing production observation

Executed read-only, with the same Node PATH:
`EXPECTED_RECIPE_CATALOG_MODE=d1 bash scripts/post-deploy-smoke.sh https://frigo.tungjpstore.net b49f3e6c4fc2f1485b77623ed7257d0f8bd31f9a`:
PASS exit0. Log/exit:
`/private/tmp/takolio-v3-recovery-existing-production-smoke.log` and `.exit`.
Root/liveness200; auth and SW no-store; immutable JS; three consecutive ordinary
and revalidated SW observations match b49f3e6c; D1/500/no fallback,
release rel-bd00a4f53fcaeee4. Readiness reports degraded/database ok.
Fresh public GET at2026-10-30T16:08:46.537Z confirms the same SHA, queue ok,
configuration ok with CONFIG_RECIPE_CATALOG_D1_AUTHORITY warning. Email delivery
is unverified. This proves existing production only, not a new V3 deployment.

## GitHub and release boundary

PR51 at exact ae68f7e5 has independent approval by vn-taphoanhatung
(2026-10-30T12:59:32Z). Recipe V3 CI41059010571 and Admin CI41059010747 SUCCESS;
those checks cover the parent, not this new slice. PR33-50 remain Draft/open,
without independent approval; all have requested review from vn-taphoanhatung.
PR51 approval does not approve ancestor slices. Its body records exact hosted
results without changing its approved HEAD. See the exact-head review/CI
[matrix](handoff/PROTECTED_REVIEW_MATRIX.md): PR34-44 lack checks on their own
HEADs; PR48's Admin failure remains recorded despite descendant fixes.
Main remains protected at b49f3e6c4fc2f1485b77623ed7257d0f8bd31f9a. Fresh GitHub
reads confirm strict validate/validate-admin, last-push/stale review and admin
enforcement. Production Environment requires vn-taphoanhatung, prevents
self-review, and accepts protected branches. CLI identity remains hello-tako.

Unresolved:1395provisional IDs/4233lines,2996excluded lines/2860transformations,
nutrition1inherited/288blocked/211NULL,six critical safety cases,0/500human culinary
approvals and approved versioned publication. The V3 candidate remains
0f20c30bd52c821a17382e17b858dbfceffbc1a0bc4711f6eefcab4c3ad8bef4.
Human content approval and code approval are separate requirements.

Next: genuine ancestor/slice review and protected main integration/exact-main CI;
finish content evidence/publication; certify exact-source hosted staging and
flags-OFF recovery; apply ordered0046/0047 using the0047 dispatch; certify changed
foundation in shadow/canary1/5/25/d1, then normal Environment-approved deployment
and verify its real receipt/SHA/traffic/health. Owner deployment authorization
already exists. No merge, remote migration, flag change or deployment occurred.
