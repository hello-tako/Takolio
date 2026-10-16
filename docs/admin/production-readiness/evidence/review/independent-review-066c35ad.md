# Independent targeted CI-fixture re-review

Exact reviewed candidate: `066c35ad670bc877756150c2055e3844dd7a17ce`.
Reviewed parent: `6c3c68147efb3f95b435b9452df34e76bea17a82`.
Reviewer: delegated independent reviewer `/root/independent_admin_review`; did not implement R2 or this CI-fixture remediation.
Repository: `<local-repository>`.
Final verification window: 2026-10-16T20:52:48Z to 2026-10-16T20:53:28Z (2026-10-17 05:52:48 to 05:53:28 JST); initial source inspection preceded this window.

## Findings and disposition

No new actionable finding was identified in the reviewed six-file delta. This targeted conclusion covers the synthetic-CI startup guard change and its safety boundary; it is not a full final-candidate suite or release approval.

The new private `assertLocalRuntimeAllowed()` contains the unchanged shared restrictions: explicit `--local`, no remote/environment/preview/production flags, development environment only, and no reachable `CLOUDFLARE_API_TOKEN`. `assertLocalProvisioningAllowed()` still calls that boundary and separately refuses `CI=true` or `GITHUB_ACTIONS=true`. The only call sites of the new exported `assertLocalFixtureAllowed()` are `admin-preview.mjs` and `admin-local-d1.mjs`.

The preview binds to loopback, uses in-memory SQLite with synthetic data and the real local Worker code, and replaces external fetch with a rejecting function. The local D1 fixture tool selects fixed local configuration/database names, appends `--local` to Wrangler D1 invocations, rejects remote flags, and supplies a token-free throwaway Wrangler configuration home. The real `admin-provision.mjs` remains unchanged and uses the stricter CI-prohibited guard before provisioning input or Wrangler execution. The new guard is not imported by runtime Workers, release tools, or workflows.

The unchanged workerd check invokes the local D1 fixture tool with a private persistence directory, and the unchanged Playwright web server starts the loopback preview with `ENVIRONMENT=development`. Both paths now reach the synthetic guard while retaining CI flags, addressing the previously reproduced guard-level startup refusal. Full workerd/browser execution is assigned to the owner and is not claimed as independently rerun here.

## Independently executed checks

- Exact candidate identity and clean checkout: `git rev-parse HEAD` returned the full candidate SHA at both inspections. `git status --short --branch` showed a clean tree, two commits ahead of its origin tracking ref. Exit 0.
- Scope: `git diff --stat` and `git diff --numstat HEAD^ HEAD`, plus `git show` and full source inspection, confirmed six changed files: three local scripts, their declaration file, tooling unit tests, and the implementation ledger. No Worker source, migration, release workflow, customer runtime, or deployment configuration changed. Exit 0.
- `git diff --check HEAD^ HEAD`: passed with no whitespace errors, exit 0. An initial manually typed base revision was malformed and failed read-only resolution; the successful parent-relative check supersedes it.
- `rg` call-site inspection established the fixture/provisioning separation described above; inspected `admin-provision.mjs`, `admin-workerd-check.mjs`, `playwright.admin.config.ts`, both local Wrangler configurations, and the complete six-file delta. Searches that referred to a guessed workflow filename reported that the filename did not exist; no workflow change is part of this delta.
- `PATH=/Users/tunbee27/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH TMPDIR=/private/tmp CI=true GITHUB_ACTIONS=true pnpm exec vitest run tests/unit/admin-local-tooling.test.ts tests/unit/admin-config.test.ts --maxWorkers=1 --testTimeout=20000`: completed successfully, 2 files / 25 tests passed, duration 2.66 seconds. Positive coverage includes fixtures under either/both CI indicators; negative coverage includes real operator provisioning under CI, missing local flag, remote/environment/preview/production flags, non-development environments, reachable token, and unchanged deployment/migration isolation checks.
- `node --check` for `admin-local-lib.mjs`, `admin-local-d1.mjs`, `admin-preview.mjs`, and unchanged `admin-provision.mjs`: all passed, combined command exit 0.

No repository source was edited by this reviewer. No build, browser, workerd, or full-suite run was started by this reviewer. No external communication, Cloudflare API access, staging/production operation, environment approval, or remote D1 mutation was performed.

## Evidence attribution and inherited scope

The previous final-candidate report `independent-review-6c3c681.md` remains applicable to its unchanged two-line minimum-roster UI/test delta. The prior backend report `independent-review-ba762a2.md` retains the exact-SHA attribution of its 12 independent local production-policy scenarios and 20 focused tests. Those prior runs are not represented as new executions on this candidate.

The implementation owner reported that CI-mode workerd fixture setup and Playwright preview startup failed on `6c3c68147efb3f95b435b9452df34e76bea17a82`; these remain FAIL for that SHA. The owner explicitly stopped its in-progress full suite with SIGTERM before changing source; that run remains INTERRUPTED and is not PASS. This final delta's execution ledger records that distinction correctly. Owner-run exact-source validation on `066c35ad670bc877756150c2055e3844dd7a17ce` remains separate evidence.

Across the inherited review chain, source review covered Access verification, enrolled identity/session authority, RBAC, CSRF/Origin/CSP/assets, Service Binding HMAC and input-bound capabilities, named bounded read-only facade contracts, bootstrap/approval/audit atomicity, additive migrations, offline recovery verification, and workflow safety. No concrete unresolved finding remains in the targeted remediation scope; coverage is limited to that scope and its local verification assumptions.

## Unresolved technical release blockers

All four release workflows remain offline preparation plans. Live deployment, migration, release, and break-glass adapters are absent or unreviewed. Explicit staging authorization remains absent.

Real Cloudflare Access/JWKS behavior and rotation, actual D1 distributed concurrency, actual staging resource identities, protected GitHub environment settings, real operator independence, staging rollback, production shutdown, deployment and migration execution remain unvalidated. This targeted review is not complete security certification, a staging pass, production readiness, or operator/release approval.
