# T26 - Family planner response and recovery incident

Status: DEPLOYED / AUTHENTICATED_HOSTED_ACCEPTANCE_NOT_TESTED (production release and independent verification complete).
The user reports that "Takosan gợi ý cả bữa" loads indefinitely in production
and requests a comprehensive review. This packet supersedes T25's release
closeout for current product work; previous release receipts stay historical.

## Scope and expected behavior

Trace setup/profile save -> authenticated V2 create -> 500-recipe deterministic
planner -> atomic persistence -> DTO -> browser acceptance. A normal Vietnamese
family week must complete promptly with full meal roles, current quantities and
hard restrictions intact. A stalled network/body must release the loading UI and
explain uncertain delivery; retry must reuse the exact create intent/key.

Preserve household/session isolation, chronological stock projection, private saved
recipes, manual locks, Week compatibility, shopping demand and schema0043. No
payment/auth redesign, dependencies, applied migrations or production config changes.

## Initial evidence - 2026-10-15

Production public readiness at 2026-10-15T10:33:00.967Z serves0ff82edb with DB/queue
ok, full D1/500/no fallback. This does not test authenticated generation. Existing
T25 acceptance explicitly left hosted authenticated household flows NOT_TESTED.

Frontend confirmed defect: fetchJson has no deadline. usePlanner.perform clears
busy only after the operation settles. A pending transport or body permanently
leaves setup disabled. New regression tests reproduced this before the fix.

Backend confirmed performance defect: search diagnostics count selected components,
but omit full recipe-pool scoring. Scratch 500-recipe measurements:
7 slots 15,685 actual recipe evaluations,3.447s Node wall;
14 slots33,052,6.704s;42 slots82,981,16.085s. Per-slot trusted-context creation
reclones/revalidates/fingerprints the whole catalog; overlapping beam branches
rebuild equivalent pools, and family eligibility is filtered after pool truncation.
Production CPU-limit exhaustion is a hypothesis, not a captured production trace.

Native workerd + cloned local D1 full authenticated create before fix:
7 slots5.243s,14 slots9.796s,42 slots20.085s (36 complete/6 unplanned/search limited).
7/14 replay119/133ms;42 replay lost native connection. Preserve that failed local
run in work/t26-native-before.log; do not classify it as a production error or PASS.
No user data, production credentials or remote database was used.

## Implementation decisions

ADR-062 retains the accepted synchronous deterministic architecture. Reuse only
immutable trusted inputs and exact request/slot pool states; prefilter existing
family eligibility before scoring, retaining T02 quantity and T03 hard checks.
Keep sequential stock and locked identities. Bound browser requests including body
reads, preserve uncertain create keys and discard late aborted responses.

## Acceptance and verification

1. Meaningful failing-to-passing tests prove stalled transport/body releases busy,
   localized recovery appears, retries use the same body/key, and late success/401
   cannot replace data or clear another session.
2. Full500-catalog default week and supported bounds retain hard safety/quantity,
   regional/cuisine policies and full roles where feasible, with measured reduced
   work. Cover equivalent-state reuse and non-reuse after stock/serving/time changes.
3. Native workerd/D1 authenticated create, idempotent replay and reload are tested;
   actual running UI is exercised on mobile/desktop, including timeout recovery.
4. Run pnpm lint, pnpm typecheck, pnpm test, pnpm check:migrations, pnpm build;
   record exact failures and counts. Inspect final diff/protected boundaries.
5. Update CURRENT_STATE/TASK_BOARD/HANDOFF with evidence and limitations, make a
   coherent checkpoint. Hosted/production repair remains unverified until protected
   release receipts and actual supported generation acceptance are obtained.

## Local implementation and final evidence - 2026-10-15

Source changes are complete locally; protected hosted release is still pending.

- `planner-http.ts` adds a30s complete-response deadline for planner,
  composition and family-profile requests. It rejects even when a transport
  ignores abort. `http.ts` rejects late aborted success/401 before data/session
  acceptance. Setup releases busy, shows localized uncertainty and exposes retry
  plus current-plan access.
- Setup fingerprints selection mode + validated intent + family preferences for
  key reuse without changing server bodies. A timed-out profile PUT is read back
  on explicit retry; exact newer content can continue, concurrent conflicting
  content requires reload.
- Trusted derived contexts reuse frozen catalog/inventory/reference inputs.
  Exact per-slot pools reuse only full projected stock/eligibility state.
  Existing family eligibility now precedes pool ranking/truncation.
- Full-pool and selected checks count actual candidate attempts. Generated work
  is capped at32768 weighted units: max(1,ceil(lots/32),ceil(feedback/128)).
  This is a deterministic bound, not CPU-time certification. Locked safety
  checks remain active after generated work exhausts.
- No migrations, dependencies, Wrangler flags, payments or unrelated auth
  changes. Existing session acceptance boundaries are extended only for abort.

Executed gates (Node25.9.0, existing frozen dependencies):
`pnpm lint` PASS (`work/t26-lint-final.log`);
`pnpm typecheck` PASS (`work/t26-typecheck-final.log`);
`TMPDIR=/private/tmp pnpm test --maxWorkers=2` PASS362 files/8465 tests,
429.67s (`work/t26-full-tests-final.log`);
`pnpm check:migrations` PASS (`work/t26-migrations-final.log`);
default `pnpm build` PASS (`work/t26-build-default.log`);
paired-ON `VITE_MEAL_PLANNER_ENABLED=true VITE_MEAL_COMPOSITION_V2_ENABLED=true
pnpm build` PASS (`work/t26-build-paired-on.log`). Compiled composition/planner
flags both true. `git diff --check` PASS.

Native full500 recipe Worker+D1 create after fix, matching sparse-stock4-serving
input:7 slots1.724s,14 slots2.178s,42 slots3.805s. Replay121/127/181ms,
exact identities, stock unchanged. Evidence `work/t26-native-final.log` and
`work/t26-native-1792061610173/receipt.json`.7/14 are complete; the42-slot
sparse-stock case still has36 complete/6 unplanned due existing selected search
limit, as it did before. Do not claim every supported input is complete.

Committed native regression replays all43 migrations into an isolated local D1,
uses actual cookie/tenancy/CSRF middleware and500 catalog, creates14 complete
Vietnamese lunch/dinner meals with four roles, retries same key, reloads the same
plan, proves one persisted plan and unchanged stock/events. Full-suite native
measurement2118ms. Bounds stock fixture reaches7/14/42 complete with no search
limit and work4273/9898/24438 units in the final full run.

Actual browser acceptance: `work/t26-front-browser-frozen.log` PASS4/4 using
real30s wall-clock deadlines,390/1280 widths. Stalled transport -> feedback ->
exact key/body retry -> real7/7 board, and stalled successful body -> bounded
feedback. Final `work/t26-front-browser-contrast-final.log` PASS4/4 using
Playwright clock advancement of the same deadline, timeout setup axe0 violations
at both widths, no horizontal overflow/page errors. A pre-existing small-text
contrast ratio4.43 failed the initial axe audit; narrow color change to#5f6d62
fixes it. Final screenshots `work/t26-timeout-390.png`,
`work/t26-retry-board-1280.png` and mobile board were visually inspected.

Retained unsuccessful checks: initial deadline regressions reproduced the hang;
initial native helper TypeScript inclusion conflicted DOM/Cloudflare Headers
types, corrected by a test-only.mjs entry; initial browser scripts had relative
config/locator/HMR interruptions before the final frozen passes. First full run
failed3 scratch suites discovered during file rename and11 pre-existing macOS
capture path/parser assertions (/var versus /private/var). Scratch artifacts now
use.proof names and are not committed. Canonical TMPDIR isolated capture
rerun79/79PASS and final full run8465/8465PASS; no production capture logic was
changed. Original logs remain under work/.

Latest read-only production readiness at2026-10-15T11:04:26.260Z still serves
0ff82edb, DB/queueok, full D1,500 expected recipes/no fallback. Informational
CONFIG_RECIPE_CATALOG_D1_AUTHORITY warning remains. This is not authenticated
generation acceptance and no T26 production repair claim is made.

## Remaining release acceptance

Finish independent diff review and coherent commit, normal PR/exact-head and
exact-main CI, then protected staging/production procedures with paired flags ON
and unchanged D1 catalog continuity. No remote migration is needed. Hosted
authenticated generation and production CPU traces remain unavailable in this
session; record this explicitly unless a supported signed-in test is obtained.
Browser keys are retained only for the mounted setup; after navigation/reload,
current-plan access recovers accepted plans. Legacy Week flag-OFF requests remain
unbounded; production flag-ON entry routes redirect to the repaired planner.

Final read-only root/backend/frontend reviews found no blocking correctness issue.
Residuals: the generic derived-context helper relies on its server-owned caller
to preserve hard policy monotonicity; current only caller contextForSlot retains
the existing hard policies. The work cap does not include finite pool filtering,
serialization/projection/context overhead or locked safety checks. The native8s
wall-time assertion has local headroom but may vary under hosted contention.

Release-readiness review:22 protected D1 catalog continuity source blobs, Zod
dependency/lock, migrations, Wrangler configs and deploy workflow are unchanged
from production0ff82edb. The existing d1-to-d1 continuity path therefore applies,
subject to actual protected preflight receipts. Repo canonical name is now
lol-vn/Tako-san (same repository ID1385308553; old hello-tako URL redirects).
Use the canonical repo for release commands; keep explicit d1/0 and
meal_composition_v2_enabled=true inputs. No production secrets were read.

## Hosted release checkpoint - 2026-10-15

PR78 https://github.com/lol-vn/Tako-san/pull/78 merged normally to main
03428467cdd5e93d27a3a27e5edaf7d512eef71d. Exact-head CI38725963888 PASS362files/
8465tests,556.32s (native14-slot6529ms); exact-main CI38727424674 PASS362files/
8465tests,582.26s (native5708ms), with lint/types/migration/build PASS.
Raw logs are work/t26-ci-head.log and work/t26-ci-main.log. Hosted native D1
remains an isolated test, not a signed-in product-session proof.

Staging Deploy38728806704 attempt1 SUCCESS. Artifact11968907373,
release-staging-38728806704-1, downloaded to work/t26-staging-38728806704-1.
Root independent receipt verification PASS against actual run/jobs, exact CI,
main SHA, source schema43/tip0043, D1/0/500/fingerprint/no fallback, paired
build/upload guards and3 exact SW observations. Source schema43 is unchanged;
staging Deploy does not freshly read remote migration ledger, so T25 staging
migration certification is inherited rather than falsely claimed as new.

work/t26-staging-public-final.json PASS: GET-only exact candidateSHA, auth shell
no-store, one immutable local main module (external Insights allowed), SW hash
0d98be20d41893c50c518b0cbc7a510287e650b024c2eb1c1a911a4e2ef47ad9
joined to protected receipt and3 ordinary/revalidated observations. Additional
EXPECTED_RECIPE_CATALOG_MODE=d1 smoke PASS (work/t26-staging-smoke.log).
Staging hosted signed-in creation remains NOT_TESTED, in line with the user's
earlier automatic/public-smoke choice; no login bypass, real-user fixture or
production session credential was introduced.

Production Deploy38729311534 was dispatched with explicit d1/0, rollbackfalse,
pairedON and approved hardening3a24808b. GitHub initially WAITING; API confirmed
takovn2 cannot approve and required reviewervn-taphoanhatung. User was shown the
exact run/required GitHub action, then API observed approved by that reviewer.
As of2026-10-15T11:46:44Z, production job is in progress at Local gates. No T26
production serving/ledger/Worker/recovery receipt is certified at this checkpoint.

## Production deployment and final public proof - 2026-10-15

Production Deploy38729311534 attempt1 SUCCESS after required reviewer approval.
All362files/8465tests passed again in the production job,375.79s; native14-slot
D1 regression4227ms. Lint/types/migration/build, schema/catalog/tenancy and
continuity preflights, paired build flags, recovery preparation, exact-main
rechecks, upload and protected post-deploy proof all SUCCESS. Rollback skipped.

Artifact11969744595 release-production-38729311534-1 is downloaded under
work/t26-production-38729311534-1. Root verification
release-manifest.json.t26-independent-verification.json PASS against exact
candidateSHA03428467cdd5e93d27a3a27e5edaf7d512eef71d and real CI/Deploy jobs.
The proof joins exact previous production0ff82edb/25b4008f-3444-4b48-b7e3-071dfc706664/
f37b8645-44fd-4ab4-9975-494ef73a0238 to the new Worker via unchanged_d1_continuity,
all22 authority blobs and identical Zod dependency/integrity.

Current production Worker3ce9750e-244f-4a34-90ef-7d65bf3a60c6, deployment
65109b89-1b23-4bb6-b163-ac7fc2de0476, binds canonical D1
f975ec39-b2c8-4a2a-80e1-0366054599d3. Fresh protected ledger43/tip0043,
FK[]=healthy, quickCheckok, catalog500/fingerprint/no fallback/pairedON PASS.
Same-candidate inactive flags-OFF recoveryf6c92374-423b-4868-b4e6-b637958631f3
has matching DB binding and compiled OFF HTML/module proof. Recovery traffic is
NOT_REHEARSED; rollback NOT_USED. No migration was applied for T26.

Public verifier work/t26-production-public-final.json PASS completed
2026-10-15T11:57:18.726Z. It confirms exact deployedSHA before/after, D1/0/500
no fallback, healthy DB, no-store auth shell, immutable local main
/assets/index-nVdrWEoj.js, and3 ordinary/revalidated SW observations. SW hash
0d98be20d41893c50c518b0cbc7a510287e650b024c2eb1c1a911a4e2ef47ad9
matches the protected receipt. EXPECTED_RECIPE_CATALOG_MODE=d1 smoke PASS.
Readiness is degraded only by existing informational
CONFIG_RECIPE_CATALOG_D1_AUTHORITY. This is public deployment proof.

Deployment is complete; the original symptom still needs signed-in hosted
acceptance because no supported account was supplied and the user selected
automated/public verification. Local browser + isolated native hosted CI cover
the actual generation/recovery behavior, but do not establish latency or success
inside a real production household. No production CPU-exhaustion trace was
captured. Preserve these limits; never label the public smoke an authenticated
planner success. All changes/evidence are checkpointed on the release-receipts
branch; runtime main remains the deployed03428467 candidate.


Final independent review also verified the protected production receipt in memory
against the actual hosted run and checked current public GET responses against
that receipt. Exact SHA, approval, D1 continuity, catalog, active Worker, recovery
identity and public assets all PASS; no blocking finding. Signed-in production
household acceptance remains NOT_TESTED.
