# Repository baseline

## Authority

- Repository: `hello-tako/Takolio` (ID `1422954151`)
- Remote: `https://github.com/hello-tako/Takolio.git`
- Base and `origin/main`: `b49f3e6c4fc2f1485b77623ed7257d0f8bd31f9a`
- Worktree: `/Users/tunbee27/Documents/New project/Takolio-recipe-v3`
- Branch: `codex/recipe-intelligence-v3`
- Production mutations: `0`

## V1 runtime

V1 remains the live catalog authority. The release manifest is
`packages/recipes/src/import/catalog-release.current.json`. It declares 500
stable IDs and expected fingerprint
`f8cf8c7ff59df9fe29e246b9e3c9aad0fd155fa8df35bf671ac4d03fa2b5ab37`.

The audit reconstructs the runtime catalog through the existing Vite/import
compiler, including approved batches. It does not write or replace that catalog.

## V2 sidecar

V2 is read from `data/recipe-refresh/v2/`. Its manifest is preserved. The
provisional projection remains non-publishable because the existing release
compiler reports four blockers. The audit records V2 hashes in
`manifests/baseline.json`.

## Reproducibility

Run:

```sh
node scripts/recipe-intelligence-v3-audit.mjs
pnpm recipe:seed:check
pnpm recipe:import:check
pnpm recipe:refresh:check
pnpm recipe:refresh:release-check
pnpm recipe:ingredient-v2:audit
```

The audit requires Python 3 for the research snapshot hash algorithm.
The first command is deterministic for a fixed checkout and source tree. The
release-check command is expected to exit non-zero while the four blockers exist.
