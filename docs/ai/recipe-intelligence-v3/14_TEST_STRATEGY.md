# Current supplement07 checks

Environment: macOS, Node24.16.0, Python3; isolated V3 worktree; TMPDIR=/private/tmp. Verified data implementation `a578b5696389cdb6afeca7530e33b1f4e384690e`, candidate SHA256 `0f20c30bd52c821a17382e17b858dbfceffbc1a0bc4711f6eefcab4c3ad8bef4`. Documentation-only changes follow this tested data snapshot.

Current supplement07 full local gate: PASS, exit0 observed; Test Files  427 passed (427); Tests  9566 passed (9566); Duration  924.13s (transform 6.86s, setup 2.35s, import 48.82s, tests 800.62s, environment 15.33s); typecheck/lint, Main/Admin local migration smoke, Client/Admin/Worker builds PASS. Command `CI=1 PATH=/opt/homebrew/opt/node@24/bin:$PATH TMPDIR=/private/tmp pnpm check`; log `/private/tmp/takolio-v3-full-check-supp07.log`. This gate includes the persistent artifact test and supplements04-07. Existing Admin font build warnings retain their original scope; see actual log.

| Exact executed command | Observed result |
|---|---|
| `PATH=/opt/homebrew/opt/node@24/bin:$PATH TMPDIR=/private/tmp node scripts/recipe-intelligence-v3-audit.mjs` | PASS500recipes/44edits/25batches; four inherited blockers retained |
| `PATH=/opt/homebrew/opt/node@24/bin:$PATH TMPDIR=/private/tmp node scripts/recipe-intelligence-v3-audit.mjs --check` | PASS exact generated outputs/source hashes/claim ownership/candidate fingerprints |
| `python3 /private/tmp/takolio-v3-supp07-agent/check-proposal.py` | PASS3V2 hashes/5official raw-text hashes/10locators/5proposed edits/32retrieval attempts; proposal-only scope |
| `python3 /private/tmp/takolio-v3-supplement07-review.py` | PASS canonical500V1/500V2,1,319 prior claims/1,180 sources/36 prior edits-history;7incoming claims/208metadata fields/1,190links/5caches/13locators |
| `PATH=/opt/homebrew/opt/node@24/bin:$PATH TMPDIR=/private/tmp node /private/tmp/takolio-v3-independent-review.mjs` | PASS500recompiled/44reversals;1,500provenance/3,937claim pointers/755facts/559frozen inputs |
| `python3 /private/tmp/takolio-v3-review-artifacts.py` | PASS full changed/untracked text/JSON/bounded summaries; protected drift0; four historical tails preserved |
| `python3 scripts/admin-public-scan.py` | PASS added text; binary/manual limits retained |
| `git diff --check b49f3e6c4fc2f1485b77623ed7257d0f8bd31f9a` | PASS full base-to-worktree diff |

Independent technical review PASS on candidate SHA256 `0f20c30bd52c821a17382e17b858dbfceffbc1a0bc4711f6eefcab4c3ad8bef4`: 500 candidates recompiled with complete metadata; 503 V2 files/51 evidence inputs; 1,500 provenance pointers/3,937 claim pointers/755 fact references; 44 exact reversals across29 recipes; 559 frozen inputs unchanged. No concrete findings; human culinary approval0/500. Historical V2 release-check exits1 on RUNTIME_PROJECTION_LOSS, INGREDIENT_RECONCILIATION_INCOMPLETE, SOURCE_CONTENT_VERIFICATION_INCOMPLETE and NUTRITION_EVIDENCE_INCOMPLETE. Historical dependency audit exits1:2high/3moderate, including Zod GHSA-mrhx-c7xc-m3w5 and undici GHSA-xjj6-f33q-929c. Dependencies unchanged; these failures remain open. GitHub push additionally reported48 default-branch advisories (8high/37moderate/3low); this hosted warning is separate from the historical local audit and was not independently re-audited. No additional focused rerun is necessary when the current full gate passes; its29 V3 tests are included.

Supplement07 checker first looked for replaced chicken edit history in the edits packet; corrected to its owning evidence recipe without canonical change. Earlier urllib FDA404 was abuse detection; complete curlHTTP200 was subsequently read. No publisher outage claimed. Raw caches remain private; repository packets retain hashes, summaries and locators.

Source-cache01-06 checks and the full gates below are historical. They do not supersede current07 results. No V3 browser, staging, runtime compatibility or production certification. All four release blockers and human review remain open.

---

The following supplement06 record is historical; its current/final wording applies only to that earlier snapshot.

<!-- supplement06-history -->
# Test strategy and observed results

Environment: macOS, Node24.16.0 (`/opt/homebrew/opt/node@24/bin`), Python3, TMPDIR=/private/tmp, isolated V3 worktree. No remote database or deployment checks.

## Current checkpoint

Full gate completed on the pre-supplement04-06 snapshot before the new persistent artifact test. It passed427 files/9565 tests/923.26s. Final06 focused29 tests cover subsequent data/test changes. No current-snapshot full-suite claim. Existing Admin font build warnings retained.

| Exact command | Observed result |
|---|---|
| `CI=1 PATH=/opt/homebrew/opt/node@24/bin:$PATH TMPDIR=/private/tmp pnpm check` | PASS, exit 0 observed; Test Files  427 passed (427); Tests  9565 passed (9565); typecheck/lint, Main/Admin migration smoke, Client/Admin/Worker builds PASS; log `/private/tmp/takolio-v3-current-full-check.log` |
| `CI=1 PATH=/opt/homebrew/opt/node@24/bin:$PATH TMPDIR=/private/tmp pnpm test tests/unit/recipe-intelligence-v3.test.mjs tests/unit/recipe-intelligence-v3-artifacts.test.mjs` | PASS2files/29tests; session91061, final06 rerun4.07s; log /private/tmp/takolio-v3-focused-final06.log |
| `PATH=/opt/homebrew/opt/node@24/bin:$PATH TMPDIR=/private/tmp node scripts/recipe-intelligence-v3-audit.mjs` | PASS rebuild500 recipes/36edits/25batches; no source promotion |
| `PATH=/opt/homebrew/opt/node@24/bin:$PATH TMPDIR=/private/tmp node scripts/recipe-intelligence-v3-audit.mjs --check` | PASS exact generated artifacts, V1/V2 hashes, claims, edit pointers, candidates and four retained blockers |
| `node scripts/recipe-intelligence-v3-source-scan.mjs self-check` | PASS parser and URL/address boundaries; no network |
| `node scripts/recipe-intelligence-v3-source-scan.mjs check` | PASS500 discovery attempts/488 initial URLs; persisted evidence only |
| `python3 scripts/recipe-intelligence-v3-ingredient-exact.py` | PASS45 registry entries/204 keys; exact0, unresolved1395; pending/no-promotion |
| `python3 /private/tmp/takolio-v3-gap-research-01-check.py` | PASS10 reviews/15claims/9 proposed edits; historical supplement01 cache scope |
| `python3 /private/tmp/takolio-v3-gap-research-02-check.py` | PASS30 reviews/47claims/10 proposed edits; exact edit-pointer source support |
| `python3 /private/tmp/takolio-v3-gap-research-03-check.py` | PASS57 reviews/175claims/0edits;75 bounded reads/85fact refs; hashes/locators/PDF extraction |
| `PATH=/opt/homebrew/opt/node@24/bin:$PATH TMPDIR=/private/tmp node /private/tmp/takolio-v3-independent-review.mjs` | No concrete technical findings on current snapshot 16d8f05ae328184dcaa5797c733271692fa5d804b4d7c7ab9fd8dffc32f09838; recompiled500, provenance1500, claim pointers3914, fact refs741, reversed36 edits. Human culinary approval remains0. |
| `python3 /private/tmp/takolio-v3-gap-research-04-check.py` | PASS8 reviews/46source records/17locators/36fact refs; retained retrieval history |
| `python3 /private/tmp/takolio-v3-gap-research-05-check.py` | PASS4 reviews/17claims/12fact refs; exact V2 formulations verified0 |
| `python3 /private/tmp/takolio-v3-gap-research-06-check.py` | PASS28raw/text hashes/10locators/10fact refs/6V1+6V2 hashes/4oldValue pointers; appliedEdits0 describes temp research before integration |
| `PATH=/opt/homebrew/opt/node@24/bin:$PATH pnpm exec eslint tests/unit/recipe-intelligence-v3-artifacts.test.mjs scripts/recipe-intelligence-v3-audit.mjs` | PASS |
| `python3 /private/tmp/takolio-v3-supplement-final-review.py` | PASS final post-apply preservation review;500V1/500V2 hashes,682prior claim prefixes,583prior sources,64incoming claims,1316metadata fields,42facts,1181reciprocal links |
| `python3 /private/tmp/takolio-v3-supp06-review-check.py` | PASS4cached official raw/visible hashes,3cited documents,4exact edits,2unmodified critical salmon pointers |
| `python3 /private/tmp/takolio-v3-review-artifacts.py` | PASS full changed/untracked text/JSON/bounded-summary review; protected drift0; all4 historical tails preserved |
| `python3 scripts/admin-public-scan.py` | PASS added text; binary/manual-review limits retained |
| `git diff --check` | PASS; final result recorded in audit/TECHNICAL_REVIEW.md |

Current research reports contain shared runnable audit --check. Original fixed-count Python/sh fences are explicitly historical text. The earlier14 embedded checks passed their initial snapshot; they are not current supplement validation. Temporary raw HTML/PDF/text caches are session evidence only; canonical packets retain hashes, bounded summaries and exact fact locators.

## Historical completed checks

Before test splitting and supplements, full local `CI=1 PATH=/opt/homebrew/opt/node@24/bin:$PATH TMPDIR=/private/tmp pnpm check` PASS exit0:426files/9565tests/942.89s, typecheck/lint, Main/Admin migration smoke, Client/Admin/Worker builds. Log `/private/tmp/takolio-v3-full-check-resumed.log`, completed41961. Not exact-current dataset proof. Earlier attempt `/private/tmp/takolio-v3-full-check-final.log` failed/incomplete during Vitest; retained.

With `PATH=/opt/homebrew/opt/node@24/bin:$PATH TMPDIR=/private/tmp`: `pnpm recipe:seed:check` PASS59Vietnamese+12global/71runtime; `pnpm recipe:import:check` PASS500/2batches; `pnpm recipe:refresh:check` PASS500, canonical artifact da87da20475fa8d7ec92c716e899ee572339573258ae6d9cc7f3f8f554f2d695; `pnpm recipe:ingredient-v2:audit` PASS6766/2996excluded/2860review. Source paths remain unchanged.

## Failures and limits

`PATH=/opt/homebrew/opt/node@24/bin:$PATH TMPDIR=/private/tmp pnpm recipe:refresh:release-check`: exit1, `RECIPE_REFRESH_RELEASE_BLOCKED`; four inherited blockers; `/private/tmp/takolio-v3-release-check.log`. Expected refusal, not release acceptance.

`PATH=/opt/homebrew/opt/node@24/bin:$PATH pnpm audit --audit-level=high`: exit1,2high/3moderate; `/private/tmp/takolio-v3-dependency-audit-final.log`; high Zod GHSA-mrhx-c7xc-m3w5, undici GHSA-xjj6-f33q-929c. Dependency/lockfile unchanged.

The old supplement05 pre-apply integration checker fails against integrated canonical state at its prior-source assertion; post-apply preservation assertions now pass. Supplement06 reviewer check first assumed all four cached documents must be canonical citations; only three were cited. Correcting the checker assumption passed without canonical changes. Corrected CI mutation reproduction uses each fixture as process.cwd(); earlier --root-only evidence is superseded. See audit/TECHNICAL_REVIEW.md.

Supplement06 first integration failed a linked-source count assertion before writes; removed that unnecessary hardcode. Audit then rejected overly broad source ownership; narrowed four source recipeIds to actual linked claims and rebuilt successfully. The unchanged audit guard caught the issue. Persistent CI artifact check closes the previously uncovered unchanged-candidate/generated-artifact drift gap; mutation reproduction and final review are recorded in audit/TECHNICAL_REVIEW.md.

Supplement02 initially lacked exact field support for3 edits; added3 source claims before integration, checker now enforces exact pointers. Supplement05 initial integration assertion raised KeyError for recipe-level runtime flag; corrected to established packet-level flag, checker PASS. Supplement03 initial salmon locator missed an anchor; expanded lines30-52, removed unsupported fresh-only assertion. Historical UnicodeEncodeError is retrieval failure, not publisher outage. Neither issue is relabeled source confirmation.

PR33 hosted validate40385562918 and validate-admin40385562692 SUCCESS; REVIEW_REQUIRED. Stacked PR34-43 have no hosted CI acceptance; documentation PR must be checked separately. No human culinary approval, V3 browser acceptance, same-source staging certification or production action. Full culinary and safety review, ingredient decisions, nutrition evidence, runtime snapshots, saved-plan/shopping/cooking/offline/rollback compatibility and fresh release gates remain required.
