# T23 - Quantity-aware fridge suggestions, manual family meals and shopping

Status: LOCAL_IMPLEMENTED_VERIFIED (2026-10-14 JST). Branch codex/vietnamese-family-meals-20261013.
Preceding verified implementation 6b63606d97bb2c9009d620c18c3d91aec76d4870;
T22 documentation checkpoint c465bd1baf94246b8a591d07971343c245ad424a.
ADR-059 records the accepted additive contract and compatibility boundaries.

The user requests deeper research and careful implementation of fridge quantities,
meal scheduling and shopping, especially an explicit manual selection flow. Reuse
T22 Vietnamese-first family templates, actual cooking days, household sizes and
shopping cadence. Research distinguishes observed habits, product decisions and
verified implementation; do not claim nationwide user validation or retention gains.

Acceptance:

1. Create an intentional manual calendar directly. Dates, meal types and servings
   survive reload, no automatic search or stock write occurs, and same-key replay is
   stable while keys cannot cross manual and automatic modes.
2. Picker binds current plan/revision/slot/date/type/servings and swap identity.
   Every dish shows required/from-fridge/missing quantities. Shared ingredients and
   earlier meals use stock once. Unknown quantities/units do not become guessed mass.
3. Add and swap are explicit. A role is chosen from canonical permitted roles and
   a replacement target is named. Manual choices stay locked through completion.
   Cook-now rejects uncovered quantities; restrictions and affected suffixes agree
   between candidate reads and actual mutations. Corrective removal is possible.
4. Scoped read pages detect inventory/profile/catalog/roles/saved/plan races.
   Transactional mutations retain membership and planning witnesses. Both loaded
   and current plan rows match expected revision. Existing strict family/V1 response
   keys remain compatible unless richer assessments are requested.
5. Discovery and detail compute availability for selected servings 1..20 and carry
   that count in links. Recipe detail/saved dishes can select a future destination
   in the existing plan, or preserve recipe/count into a manual-first setup. Board,
   destinations and projection agree on actual time and numeric slot sequence.
6. Shopping comes from composed shortages over the selected trip horizon. Existing
   purchase edits, checked state and manual entries remain durable; no checkbox,
   calendar or suggestion deducts physical stock.
7. Run focused regressions, lint, both typechecks, full tests, migration smoke and
   default/paired builds. Verify actual app/Worker HTTP at phone/tablet/desktop sizes,
   with axe and overflow checks. Record counts, failures and synthetic limitations.
8. Update task/current-state/handoff/board and make coherent local checkpoints.
   No push, merge, migration on remote databases or deployment is authorized.

Implemented refinements include locked manual complete_meal mains selecting a
one-dish template at that slot, fractional measured inventory input and corrections,
exact compatible displayed unit conversion, original quantity/unit draft CAS,
frozen cooking servings/deductions on uncertain replay, chronological mixed boards,
plan-offset elapsed destination filtering, and success-only shopping key retirement.
The full affected stock suffix is checked before accepting a cook-now choice.
No new schema, migration, dependency or protected subsystem change.

Remaining product/data limits: unknown shopping demand has no direct
purchase/resolve/dismiss command; manual purchase cannot certify unknown demand.
No guessed package/bunch/piece mass, leftovers, shared preparation, multi-vendor
allocation, independently verified all-catalog regional provenance or clinical
nutrition/allergy certification. Local synthetic checks do not demonstrate retention.

Continued-week refinement: future V2 meals remain editable after earlier meals
elapse; projected/shopping stock excludes elapsed instants. Family shared shopping
reprojects current stock after inventory/history/time changes while profile, hard
preference, catalog and authority changes still block it. Freshness is not rewritten.
Trip dates use the saved plan offset and max(device, server checkedAt), including
late same-day meals on a device already on another date. Missing/malformed schedule
fails closed. Whole-week regeneration and V1 swapping remain past-horizon gated.
Time is captured at request start; subsequent requests use the new time boundary.

Verified implementation checkpoint: d3952c34b1c217fb695cd551a247c0882c4c01d7.
No important source changes remain uncommitted; status/handoff are a separate
following documentation checkpoint and do not reference their own hash.

Executed local validation (Node v25.9.0, pnpm10.33.2):

- pnpm lint: PASS; final log work/t23-lint-verified.log.
- pnpm typecheck: PASS, web and Worker; root confirmed exit0 in
  work/t23-typecheck-calendar-confirmed.log and .exit.
- TMPDIR=/private/tmp pnpm test --maxWorkers=4:354 files/8,332 tests PASS,
  232.84s; work/t23-full-test-calendar.log. Earlier 8,329/354 and8,289/353 are
  prior snapshots. The sole subsequent source change was an E2E URL matcher;
  runtime/full unit+integration graph is byte-identical, verified by hash.
- pnpm check:migrations: PASS,42 migrations; work/t23-migrations-frozen.log.
  No migration/schema bytes changed after that smoke; no T23 D1 apply necessary.
- pnpm audit --audit-level=high: PASS, no known vulnerabilities;
  work/t23-audit-frozen.log. Dependencies unchanged.
- GIT_COMMIT=local-t23-family-planning pnpm build: PASS exit0;
  work/t23-build-default-verified.log.
- GIT_COMMIT=local-t23-family-planning VITE_MEAL_PLANNER_ENABLED=true
  VITE_MEAL_COMPOSITION_V2_ENABLED=true pnpm build: PASS exit0;
  work/t23-build-paired-verified.log.
- PORT=3101 PREVIEW_API_PORT=8891 pnpm exec playwright test -c
  playwright.family.config.ts:8/8 PASS at320/390/768/1280,3.5m;
  work/t23-family-browser-calendar.log. Actual app/Worker HTTP with synthetic
  SQLite D1/catalog, no business API interception; fridge quantity correction,
  servings4/manual calendar/rice320g/add+replace/locked completion/one-dish reload,
  shopping3->7->3 and actual changed-stock sharing verified; stock unchanged by
  planning/shopping actions. Axe/overflow assertions pass, screenshots reviewed.
- PORT=3104 PREVIEW_API_PORT=8894 pnpm exec playwright test -c
  playwright.t20.config.ts:42/42 PASS at390/768/1280,3.7m;
  work/t23-t20-browser-verified.log. Negative load/fallback cases explicitly
  intercept selected responses. Targeted --grep 'load failure|warm V2':6/6 PASS,
  32.9s, work/t23-t20-assessment-routes-focused.log.
- Focused backend38tests and latest UI/calendar150tests PASS. Final independent
  backend/UX review found no remaining confirmed finding. UI review's last150/
  ESLint/typecheck are in tool transcript sessions8115/75255/57383; root full
  suite, lint and typecheck logs include their source. git diff --check and staged
  new-file check PASS; protected payment/auth/infrastructure/config/dependencies/
  migration paths unchanged. No combined pnpm check or hosted CI claim.

Failures retained and addressed: earlier full inventory UI unit-only versus
explicit-measurement assertions; Vite504 Outdated Optimize Dep/zustand during
concurrent browser/tests, interrupted runs exit130; optional price-form and fixture
role/cuisine/idle selectors; first continuation import/router/fixture typecheck
failures. An earlier build was interrupted after Vite, not reported passed.
Final T20 failed attempt retained2failed/1interrupted/20passed/19notrun (exit130)
in work/t23-t20-browser-calendar.log: interceptors matching only URLs ending with
/compositions missed includeAssessment=true. Exact pathname match plus assertion
that a500 was intercepted fixed the cause; targeted6 then full42 PASS. Independent
review's cross-device trip-date defect fixed with exact payload/minimum, midnight
and invalid-clock regressions. Failed logs remain; no test assertions were weakened.

Evidence copies and hashes: calling chat outputs/t23-verified/verification.json,
logs/ and screenshots/. Research: calling chat outputs/
TAKOSAN_PANTRY_MANUAL_RESEARCH_T23.md. These are local synthetic artifacts;
not hosted workerd/D1, regional catalog provenance, user-study or retention proof.
T22's0042 remains a release prerequisite; no remote operation executed.

Next action: separately authorized PR/exact-head+main CI and migration-first staging
with hosted smoke before production. Product next: explicit unknown-demand review
commands, validated regional metadata and multi-region household task/diary study.
Retain limitations listed here; no future-only whole-week regeneration yet.
