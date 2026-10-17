# Local runbook — clean clone to a working admin console

Commands were executed during the 2026-10-14 review (EXEC-REVIEW-0331cc9) unless marked otherwise. Full command list and expected outcomes are in `TEST_AND_EVIDENCE.md`. The existing admin setup note is `docs/admin/LOCAL_SETUP.md`; this runbook adds the handoff steps and the troubleshooting list.

## 1. Prerequisites

- Node **≥ 22.13** (CI uses Node 22; the reviewer used v24.21.0). UNVERIFIED on 22 in this register.
- pnpm **10** (CI pins 10; the reviewer used 10.31.0). There is no `packageManager` field.
- `sqlite3` CLI (used by `check:migrations`; reviewer 3.45.1).
- Chromium for Playwright 1.63.0: `pnpm exec playwright install chromium`. If your browser cache is elsewhere, set `PLAYWRIGHT_BROWSERS_PATH`.
- Git. Network access is needed only for `pnpm install` and the browser download.

## 2. Clean clone and install

```sh
git clone https://github.com/hello-tako/Tako-san.git takosan
cd takosan
git fetch origin handoff/admin-v1-r2-20261015
git switch -c handoff-local origin/handoff/admin-v1-r2-20261015
pnpm install --frozen-lockfile
```

Do not check out `main` for this work; it has moved on (see TRAPS in `START_HERE.md` §8).

## 3. Environment

No environment file is required. The local tooling sets `WRANGLER_SEND_METRICS=false`, an empty `CLOUDFLARE_API_TOKEN` and a throwaway config home, so a stored `wrangler login` is never used. Do not run `wrangler login` for this work.

## 4. Baseline gates (run first; compare to TEST_AND_EVIDENCE)

```sh
pnpm lint
pnpm typecheck
pnpm test          # about 11 minutes on a 4-vCPU sandbox; run in a clean clone
pnpm build         # customer web build + admin build + Worker type-check
pnpm check:migrations
```

## 5. Admin preview — isolated, in-memory (Option A)

```sh
pnpm build:admin
pnpm admin:preview           # http://127.0.0.1:8790/admin/ ; set PORT to change it
```

Both databases are in-memory SQLite with the customer migrations, `migrations-admin` and the synthetic fixture (`synthetic-admin-v1`). Every screen shows the synthetic-data banner. `POST /__admin-preview/reset` restores the fixture. Fixture accounts and the local fixture password are listed in `docs/admin/LOCAL_SETUP.md`; they are valid only in this local preview.

## 6. Real workerd, loopback (Option B)

```sh
pnpm admin:local:reset -- --yes   # deletes local D1 state; migrations and fixture
pnpm build:admin
pnpm admin:dev                    # http://127.0.0.1:8799/admin/
```

`wrangler.admin-local.jsonc` is the only config that compiles the local password login. Never deploy it.

Two real local accounts instead of the fixture (one-time; refuses outside development, in CI, with `--remote`/`--env`, or when `CLOUDFLARE_API_TOKEN` is set):

```sh
pnpm admin:provision -- --local --create-accounts --password '<12+ characters>' --email a@example.test --email b@example.test
```

## 7. Admin tests

```sh
pnpm exec vitest run tests/unit/admin- tests/integration/admin-
pnpm test:admin:e2e               # builds the admin bundle, then Playwright; see F8 and F9
pnpm admin:workerd:check          # real workerd routing evidence; needs pnpm build
pnpm admin:migration:matrix       # offline migration and rollback matrix; pinned to the 41-file ledger
```

After `test:admin:e2e`, restore the tracked screenshots unless you intend to update them: `git checkout -- docs/admin/screenshots`.

## 8. Reviewer probes

```sh
# Baseline worktree at the pre-admin customer commit (for parity checks)
git worktree add --detach ../takosan-186a9cf 186a9cf
(cd ../takosan-186a9cf && pnpm install --frozen-lockfile && pnpm build:web)
pnpm build
node docs/admin/reviews/r1-certification/tools/workerd-probe.mjs ../takosan-186a9cf /tmp/workerd-independent.json
```

The probe starts `wrangler dev --local` processes on high ports, uses Chromium through Playwright, and writes JSON. It sends no requests to Cloudflare. Expected: `workerd-probe: PASS 1169/1169`. It takes about two minutes.

## 9. Reviewer PoCs and tests (restore first; do not commit the restored copies)

The archived sources are `.txt` so that `pnpm test` does not collect them from `docs/`.

```sh
mkdir -p .hoplite/artifacts/r1-cert .hoplite/artifacts/review-poc .hoplite/artifacts/review-poc-r1
cp docs/admin/reviews/r1-certification/tools/r1-independent.test.ts.txt .hoplite/artifacts/r1-cert/r1-independent.test.ts
for f in docs/admin/reviews/poc-archive/original-3e865d0/*.txt; do cp "$f" ".hoplite/artifacts/review-poc/$(basename "$f" .txt)"; done
for f in docs/admin/reviews/poc-archive/adapter-25140ba/*.txt; do cp "$f" ".hoplite/artifacts/review-poc-r1/$(basename "$f" .txt)"; done
pnpm exec vitest run .hoplite/artifacts/r1-cert/ --reporter=verbose   # expect 18/18
pnpm exec vitest run .hoplite/artifacts/review-poc-r1/ --silent       # expect 22 pass / 29 fail (by design)
```

The restored copies are under the git-ignored `.hoplite/artifacts/`. Remove them before running the full suite in the same workspace, or the review PoCs will run as part of `pnpm test`.

## 10. Migration smoke

`pnpm check:migrations` runs `scripts/migration-smoke.sh` (customer ledger) and `scripts/admin-migration-smoke.sh` (admin schema and trigger invariants). Both must print `ok`.

## 11. Common errors and fixes

| Symptom | Cause | Fix |
|---|---|---|
| `Cannot find module '../../../src/worker/routes/admin/access'` when running the reviewer test from `docs/` | The `.ts` file is archived as `.txt` precisely to avoid this. Running it from the wrong folder breaks its relative imports. | Restore it into `.hoplite/artifacts/r1-cert/` (§9). |
| `wrangler dev` fails to start a generated config | Worker names must be lowercase. The reviewer probe lower-cases names for this reason. | Use lowercase names in any custom config. |
| `browserType.launch: Executable doesn't exist` | Playwright browser not installed or cache path differs. | `pnpm exec playwright install chromium`; or set `PLAYWRIGHT_BROWSERS_PATH`. |
| `Refusing: --remote is not allowed; provisioning is local-only.` | Intentional guard. | Do not work around it. Remote operations are out of scope. |
| `reset deletes local D1 state; re-run with --yes` | Intentional guard. | Add `--yes` only for local reset. |
| Keyboard E2E fails with `expected 0 to be > 0` | F8 flake. | Re-run; the product scrolls correctly. Fix tracked as F8. |
| `git status` shows modified `docs/admin/screenshots/*.png` after E2E | F9: E2E overwrites tracked screenshots. | `git checkout -- docs/admin/screenshots`. |
| Migration matrix fails on a clean `origin/main` checkout | Ledger has 43 files, the matrix pins 41. | Expected until WP0 re-pins the matrix deliberately. |
| `pnpm install --frozen-lockfile` fails | Lockfile out of sync with a different Node or pnpm version. | Use pnpm 10 and Node ≥ 22.13. |
