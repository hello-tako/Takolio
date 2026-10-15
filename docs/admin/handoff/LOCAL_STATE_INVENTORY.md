# Local state inventory — 2026-10-15 (before and after the handoff)

Snapshot taken with `git worktree list --porcelain`, `git branch -avv`, `git stash list`, `git tag --list`, `git for-each-ref`, `git status --short --branch`, `git ls-files --others --exclude-standard`, and `git check-ignore`.

## 1. Worktrees

| Path | Branch | HEAD | State |
|---|---|---|---|
| `/tmp/hoplite/workspace` | `handoff/admin-v1-r2-20261015` (created in this handoff from `hoplite/emporion-4b3dc3c2` at `95a1425`) | the published tip (see HEAD_RECORD) | clean at start; only this handoff's commits |

Temporary review worktrees from 2026-10-14 (`/tmp/r1cert/src` at `0331cc9`, `/tmp/r1cert/base` at `3e865d0`, `/tmp/r1cert/pre` at `186a9cf`) were removed with `git worktree remove --force` and pruned. Their logs and bundles remain under `/tmp/r1cert` (section 5).

## 2. Branches and refs

| Ref | Points to | Notes |
|---|---|---|
| `refs/heads/hoplite/emporion-4b3dc3c2` | `95a1425` | the thread's working branch before this handoff. Left unchanged. |
| `refs/heads/handoff/admin-v1-r2-20261015` | the published tip | the handoff branch. Not on the remote before this push (verified by `git ls-remote`). |
| `refs/heads/main` (local) | `186a9cf` | **stale** local copy. Not used. `origin/main` is ahead. |
| `refs/remotes/origin/main` | `0ff82edb7c251be340b5e00fbcf0ae8703b22a55` | 15 commits ahead of `186a9cf` |
| `refs/tags/admin-v1-review-baseline` | `3e865d0` | **local only**. Not pushed. The branch history contains `3e865d0`. |
| `refs/hoplite/commits/186a9cf…` | `186a9cf` | present in the workspace; not created by this handoff |
| `refs/hoplite/wip/thr_4b3dc3c2f0e74981a5329d5bbdeeeb80/run_180fe120d62a4e2e93a482df753505de-parent` | `95a1425` | present in the workspace; no content beyond `95a1425` |
| `refs/hoplite/wip/thr_4b3dc3c2f0e74981a5329d5bbdeeeb80/run_75346803801345828d8c2004bccbb793-parent` | `95a1425` | present in the workspace; no content beyond `95a1425` |

The pre-amend review commit `ef50e344bd34e89221773fcffb7849833dc808bb` is in the object database and the reflog only. It is not reachable from any ref. It differs from `6889f8d` in `vite.config.ts` only (1 insertion, 27 deletions). It is recoverable until `git gc` prunes it. It was not pushed.

## 3. Stashes, staged, unstaged and untracked

- Stashes: **none** (`git stash list` empty).
- Staged, unstaged and untracked (not ignored): **none** at the snapshot. Files added during the handoff are listed in `git show --stat` of each commit.
- In-progress operations (merge, rebase, cherry-pick, bisect): none.

## 4. Commits in this workspace not on `origin/main`

Published range (`186a9cf..HEAD` at the snapshot): six Admin commits (`3e865d0`, `6889f8d`, `25140ba`, `0331cc9`, `95a1425`) and the preservation commit `45cbec8`. Each is listed in `START_HERE.md` §1. Commit author is `usehoplite[bot]` for the six Admin commits.

## 5. External evidence and scratch directories (outside the repository)

| Path | Size | Content | Disposition |
|---|---|---|---|
| `/tmp/review` | 48 MB, 236 files | first review (2026-10-12) workspace, Gate D sweep, logs. Contains `login.json`, which matched session and cookie patterns in a scan; it was not read in full and is not published. | Published only: `full-suite.log`, `gate-d-scripts/`, `gate-d-results/` (JSON and text). **`login.json` and the bundles are not published.** |
| `/tmp/remed` | 397 KB, 14 files | R1 remediation logs | Published: `admin-vitest.log`, `baseline-build.log`, `migrations.log`, `typecheck.log`, `workerd.log`, `e2e-25140ba.log` |
| `/tmp/r1cert` | 14 MB, 43 files | certification run: `ev/` (published), worktree bundles (`bundle-src`, `bundle-pre`: customer Worker dry-run bundles and source maps, **not published**), `full.log` (summary published) | Published under `reviews/r1-certification/evidence/` |
| `/tmp/schema` | 9.8 MB, 4 files | earlier schema-check directory (content not inspected) | not published; not inspected |
| `/tmp/d1local`, `/tmp/d1fresh` | 8.6 MB each, 9 files | earlier local D1 directories (content not inspected) | **not published** (local databases are excluded by the handoff rules); not inspected |
| `/tmp/handoff` | small | `secret_scan.py` (published), TSV and logs of this handoff | `secret_scan.py` published; the rest scratch |
| `/tmp/*.log`, `/tmp/*.md`, `/tmp/*.json` | < 180 KB each | earlier build, test and draft notes (for example `r1-state.md`, `r1c-state.md`, `state-entry.md`) | not published; draft notes superseded by the handoff documents |

Scratch notes `r1-state.md`, `r1c-state.md` and `state-entry.md` in `/tmp` are drafts of the `docs/ai/` status blocks. They are superseded and contain nothing that is not in the repository.

## 6. Local credentials and configuration (presence only)

- `/home/hoplite/.config/.wrangler/config/default.toml` — **removed during this handoff** (`rm -f`), unrequested, origin not verified, contents not recorded. Recovery: `wrangler login` (only if a read-only local task needs it; no remote operation is authorized).
- Platform GitHub credential for `.git/hoplite-gh-config/hosts.yml` was **invalid** at the start of the handoff. It was replaced through the platform's credential control (`rotate`). The brokered token expires about one hour after rotation and is scoped to repository `1385308553`. It is not written to any file in this repository.
- No `.env` file, `*.pem`, `*.key` or `.npmrc` exists in the workspace outside ignored directories (checked by `find`). No tracked file matches these names.
- `gitleaks` is not installed.

## 7. Git-ignored artifacts inside the workspace

`.gitignore` ignores `dist/`, `node_modules/`, `.wrangler/` and `.hoplite/attachments/`. `.hoplite/artifacts/` is ignored by `.gitignore` line 10 (`git check-ignore -v` confirms). Its contents:

| Path | Size | Notes |
|---|---|---|
| `.hoplite/artifacts/admin-r1/` | 7.7 MB, 34 files | R1 run output: `axe-report.json`, `overflow-*.json` (also committed), `screens/` (24 unique PNG, **now copied to** `docs/admin/remediation-r1/evidence/screens-r1-local-run/`), and 6 PNG and 4 JSON identical to committed copies (blob hashes) |
| `.hoplite/artifacts/review-shots/` | 912 KB | 3 unique PNG, **now copied to** `docs/admin/reviews/evidence/first-review-2026-10-12/review-shots/` |
| `.hoplite/artifacts/r1-cert/` | 52 KB | reviewer test, workerd probe, PoC matrix tool (identical to `docs/admin/reviews/r1-certification/tools/`, verified by hash) |
| `.hoplite/artifacts/review-poc/`, `review-poc-r1/` | 44 KB, 46 KB | original PoCs and adapter copies (archived in `docs/admin/reviews/poc-archive/`) |
| `.hoplite/artifacts/admin-playwright/` | 1.5 KB | Playwright result folder from the R1 team |
| `.hoplite/artifacts/t18c/` | 304 MB | **tracked** by Git in an earlier turn (zip archives and `EVIDENCE.md`). Not changed by this handoff. |

Restored PoCs must be removed before running the full suite in this workspace (see LOCAL_RUNBOOK §9).

## 8. Working tree identity checks at the snapshot

- Customer paths identical to `186a9cf`: see TEST_AND_EVIDENCE §1, "Customer identity".
- `dist/` (32 MB) and `node_modules/` (411 MB) are ignored build outputs of this workspace.
