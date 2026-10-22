# Remote main verification

After full backup verification: `git fetch origin --prune` exit 0.
`origin/main` = 0322a9197bee4a4a42d95cc150f8d4fff6d53ba8.
`git rev-list --left-right --count origin/main...HEAD` = 4 5.

Main-only: 274d5ad4 contained Admin migration; c7417120 PR24 merge;
ec5c6760 responsive Admin coverage; 0322a919 narrow overflow/accessibility.
All retained from main. No protected backend/Admin/config change is ported.
Local-only five commits and all dirty/untracked source paths are classified in
FILE_DECISIONS.csv. Main/local path overlap is documentation only; no application
path conflict requires accepting an older main implementation.

G2 PASS for source divergence; runtime comparison completed with explicit inherited failures in TEST_BASELINES.md. Baselines use
Node v25.9.0, pnpm10.33.2 and the unchanged main lockfile. Dependency installation:
`pnpm install --frozen-lockfile --ignore-scripts`, exit0, 312 packages; no lockfile
change. A minimum Node>=22.13 is required by repository SQLite tests.

Final read-only `git ls-remote https://github.com/hello-tako/Takolio.git refs/heads/main` before checkpoint again returned `0322a9197bee4a4a42d95cc150f8d4fff6d53ba8`. No remote write occurred.
