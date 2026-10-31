# Saved shopping content validation - 2026-10-30 JST

Status: implementation validated locally; production NOT_READY. Owner deployment
permission remains valid. Branch codex/recipe-v3-shopping-content; parent
5cf2d197f03999dd74fc088c035c40ef4de3899f. Resolve final HEAD/PR from Git/GitHub;
this document cannot identify its own commit.

## Behavior and compatibility

ADR-078 copies trusted saved component contentFingerprint into existing shopping
contribution JSON. Legacy missing/NULL and non-recipe selections stay unknown.
No SQL migration/backfill. GET negotiates existing recipe-content=1 capability;
legacy strict DTOs omit only the new field. Private web caches retain exact pins.
Reads never recalculate saved demand. Changed content invalidates demand review
and stale commands, while selected purchase amounts/history survive. Existing
historical mismatch rejection, receipt-first replay, tenancy, inventory and Week
fences remain. Archive existence confers no new household access.

Pre-078 strict Workers/clients cannot parse pinned contribution JSON/cache.
Recovery requires the same-source version-aware Worker/client with paired flags
OFF, retaining0046/0047, archives, receipts, shopping and plan data. Hosted recovery,
mixed-client/service-worker and approved publication certification remain open.

## Executed checks

Node24.16.0,pnpm10.33.2. Commands use
`PATH=/opt/homebrew/opt/node@24/bin:$PATH TMPDIR=/private/tmp CI=1`.

- `pnpm check`: PASS exit0;435files/9716tests,1156.63s; typecheck,lint,
  Main/Admin migration smoke and production builds PASS. Log/exit:
  `/private/tmp/takolio-v3-shopping-complete-check.{log,exit}`. Existing Admin
  font build-time resolution warnings remain; output contains the font files.
- `pnpm exec vitest run tests/integration/saved-shopping-content.test.ts tests/integration/shopping-demand-review.test.ts tests/unit/shopping-demand-review-service.test.ts`:
  PASS exit0;3files/47tests,9.76s. `/private/tmp/takolio-v3-shopping-focused.{log,exit}`.
- `pnpm exec vitest run tests/integration/family-shopping-reconciliation.test.ts tests/integration/family-shopping-input-fences.test.ts tests/integration/shopping-command-race.test.ts tests/integration/saved-v1-content.test.ts tests/integration/saved-composition-content.test.ts tests/unit/shopping-plan-snapshot.test.ts`:
  PASS exit0;6files/43tests,24.84s. `/private/tmp/takolio-v3-shopping-regressions.{log,exit}`.
- After CLI cache edits: `pnpm exec vitest run tests/unit/recipe-intelligence-v3-artifacts.test.mjs tests/unit/recipe-import-output-policy.test.mjs`:
  PASS exit0;2files/30tests,22.46s. `/private/tmp/takolio-v3-shopping-cli-tests.{log,exit}`.
  ESLint on the four catalog CLIs/security-preview and node --check on all four
  catalog CLIs PASS. Full check began before CLI cache edits; these later checks
  and actual concurrent CLI executions cover the final CLI bytes.
- `pnpm audit --audit-level=high`: PASS exit0;0vulnerabilities.
  `/private/tmp/takolio-v3-shopping-audit.{log,exit}`.
- Concurrent final `pnpm recipe:seed:check`, `pnpm recipe:import:check`,
  `node scripts/recipe-intelligence-v3-audit.mjs --check`: PASS exit0;71runtime/
  media recipes,500imported recipes/2batches,500V3candidates/44edits/25packets.
  `/private/tmp/takolio-v3-shopping-{seed,import,v3-audit}-isolated.{log,exit}`.
- Concurrent final `pnpm recipe:refresh:release-check`: FAIL exit1 at all four
  actual data gates: RUNTIME_PROJECTION_LOSS,INGREDIENT_RECONCILIATION_INCOMPLETE,
  SOURCE_CONTENT_VERIFICATION_INCOMPLETE,NUTRITION_EVIDENCE_INCOMPLETE.
  `/private/tmp/takolio-v3-shopping-release-isolated.{log,exit}`.
- `python3 scripts/admin-public-scan.py`, `git diff --check`: PASS.
  `node scripts/admin-release-preflight.mjs`: PASS configuration validation;
  source5cf2d197,dirty checkout,baselinea1e706c7,readyForDeployment=false,
  remoteExecuted=false. Source manifest5c26ea3737aedc803d5da0e31fffad5463e54211eeb1e03d0496acaa6d2dd449.
  `/private/tmp/takolio-v3-shopping-preflight.json` and `.exit`.

Tests cover static/D1 pins, archived household access, strict legacy shopping
reads, historical calculation409 with unchanged demand/stock, exact replay,
legacy NULL/missing, family component matching, pin-only review invalidation,
stale command rejection and private offline cache preservation.

## Browser and retained failures

```sh
PORT=3233 PREVIEW_API_PORT=8933 PREVIEW_MEAL_COMPOSITION_V2=true PREVIEW_T20_D1=true pnpm exec playwright test -c playwright.t17.config.ts tests/e2e/t17-ui/takolio-shopping-continuation.e2e.ts --project mobile-390 --project desktop-1440 --output .artifacts/recipe-v3-shopping-content-browser-isolated
```

PASS exit0;4tests/1.3m,88PNG,88axe reports,0violations. Axe retains39
color-contrast incomplete findings (serious); no accessibility conformance claim.
88layout observations found no measured overflow,broken images or unreachable
measured controls. Representative mobile/desktop captures were opened directly.
Log/exit: `/private/tmp/takolio-v3-shopping-browser-isolated.{log,exit}`.
Synthetic local SQLite preview, backend outbound disabled, serviceWorkers:block;
not hosted, service-worker, device or publication proof.

Original browser run failed4tests on HTTP504 Outdated Optimize Dep. Preserve
`/private/tmp/takolio-v3-shopping-browser.{log,exit}` and original browser artifacts.
security-preview now isolates Vite cache by port. Original concurrent catalog
release-check failed ENOENT renaming shared node_modules/.vite/deps before reaching
the data gate; `/private/tmp/takolio-v3-shopping-release-check.{log,exit}`.
Four catalog CLIs now use separate cache directories. Concurrent replay reaches
all real data gates without rename failure. Existing HMR24678 port warnings remain.
No test, audit, readiness guard or data gate weakened.

## Release boundary

Candidate SHA256 remains
0f20c30bd52c821a17382e17b858dbfceffbc1a0bc4711f6eefcab4c3ad8bef4.
1395provisional identities/4233lines,2996excluded lines/2860transformations,
nutrition1inherited/288blocked/211null,0/500human approvals and six critical safety
cases remain. Approved publication remains blocked under ADR-072. No source,
nutrition, ingredient or safety approval is inferred from technical checks.

Fresh GitHub mainb49f3e6c remains protected. PR50 exact5cf2d197 Recipe41054707795
SUCCESS; Admin41054707716 IN_PROGRESS when checked. Its checks certify the parent
only. New HEAD requires own Recipe/Admin CI and independent review. Production
requires protected main/exact-main CI, ordered0046/0047 migration certification,
same-source staging/recovery/catalog shadow/canary1/5/25/d1 certification and
normal Environment reviewervn-taphoanhatung approval (self-review forbidden).
No merge, remote migration, flag change or production deployment performed.
