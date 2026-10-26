# Recipe V3 reproducible baseline report

Baseline acceptance: `RECIPE_V3_BASELINE_CERTIFIED` for local repository reconstruction only. Program: `RECIPE_V3_RESEARCH_IN_PROGRESS`; release remains `RECIPE_V3_BLOCKED`. No fresh production certification is implied.

## Repository and authority

- Repository `hello-tako/Takolio`, ID `1422954151`, remote `https://github.com/hello-tako/Takolio.git`.
- Isolated branch `codex/recipe-intelligence-v3`, worktree `/Users/tunbee27/Documents/New project/Takolio-recipe-v3`.
- Base SHA `b49f3e6c4fc2f1485b77623ed7257d0f8bd31f9a`; preserve concurrent worktrees and their uncommitted changes.
- Runtime authority: approved V1 `packages/recipes/src/import/catalog-release.current.json`, release `rel-bd00a4f53fcaeee4`. Static 71 + pilot 30 + scale 399 = 500.
- V2 is immutable research input from `data/recipe-refresh/v2/`; V3 is a candidate sidecar. No runtime cutover, D1 write or production mutation.

## Reproduced identities and hashes

The complete ordered 500 IDs, actual/expected fingerprint and baseline path hashes are in `../manifests/baseline.json`. Per-ID slugs, V1/V2 comparison and validations are in `RECIPE_V3_DATA_QUALITY.json` and `.csv`. The audit rejects identity/slug drift.

| Artifact | SHA-256 / fingerprint |
|---|---|
| V1 expected and reproduced runtime | `f8cf8c7ff59df9fe29e246b9e3c9aad0fd155fa8df35bf671ac4d03fa2b5ab37` |
| V1 release manifest | `fa47d31f344736d338dc0ba50654e4604f793089fe97e44857e7dd5dd0134ac0` |
| V2 canonical artifact | `da87da20475fa8d7ec92c716e899ee572339573258ae6d9cc7f3f8f554f2d695` |
| V2 manifest bytes | `adf1784bb32b5b4fac7e9942dcc85d63339674282565b1dfa8e20c099ad7ea22` |
| V2 provisional, blocked projection | `6d0e3eb85696bb7c31bc54ac62783bc94432aaf008028eca79b17041f3eaed87` |

V2: 500 recipes, 6,766 ingredient lines, 4,938 steps; 503 source-file hashes verified. Provisional runtime has 3,770 lines; 2,996 excluded, including 2,860 requiring reviewed transformations. The provisional fingerprint is not a final publishable V3 fingerprint. Nutrition remains 1 inherited publishable / 288 blocked / 211 null; declared V2 source promotions remain zero.

## Compatibility and constraints

Path-level authority and consumer traces: `RECIPE_V3_AUTHORITY_MATRIX.csv`, `RECIPE_V3_CONSUMER_MAP.md`; relevant design: `../12_RUNTIME_COMPATIBILITY.md`, `../13_PLANNER_SHOPPING_COOKING_IMPACT.md`. Existing hydration, canonical registry, household isolation, inventory commands and Week compatibility are unchanged. Cooking content-version pinning remains a prerequisite; existing saved plan/shopping/cooking history must not silently consume candidate content.

No migration/schema constraint was modified. Existing migration smoke and complete repository tests passed locally; this establishes regression evidence at this checkout, not new V3 runtime integration or remote schema proof. Rollback of the candidate-only checkpoint is code rollback; user data is not written.

## Executed reproduction and limitations

Exact commands/results are in `../14_TEST_STRATEGY.md`: V1 seed/import checks, V2 refresh check, ingredient audit, V3 audit `--check`, scanner self-check/check and deterministic rebuild passed. Full `CI=1 PATH=/opt/homebrew/opt/node@24/bin:$PATH TMPDIR=/private/tmp pnpm check` passed typecheck/lint, 426 files / 9,565 tests, Main/Admin migration smoke and Client/Admin/Worker builds. Read-only technical review resolved 1,500 provenance pointers and reversed all 12 edits without findings.

`pnpm recipe:refresh:release-check` correctly exits 1 with all four inherited release blockers. Dependency audit separately fails with 2 high / 3 moderate advisories. No gate was weakened. Full culinary verification 0/500, human approvals 0/500. Browser/staging acceptance, final projection and production authority remain absent.

Reproduce from the isolated worktree using Node 24 and Python 3. `node scripts/recipe-intelligence-v3-audit.mjs --check` validates the pinned baseline without regenerating it. No baseline or source file should be edited to make that check pass.
