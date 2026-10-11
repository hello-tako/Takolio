# B00 - Reproduce evidence

Source pin `652e0d7632745e9b77cda4b5b3caac83a3ec1015`, repository ID1385308553. Local logs remain under `.artifacts/backend-b00`; portable command/outcome/digest records are in baseline.json/LOCAL_VALIDATION.md. Never use checkout legacy to claim results for this source.

## Source and migration checks

Read baseline manifest, checkout its exact baseSHA, verify lockfile and each migration SHA256. Migration chain digest uses Node-equivalent `JSON.stringify([{name,sha256},...])` sorted by filename, SHA256 of UTF-8 bytes. At B00 source count39/tip0039; chain digest `321e59c716a6eb16b2375ae878b81c23fe0917ac1b25c53499b65afb8231f52b`. Compare source list to timestamped hosted receipt; do not call that a new production ledger checksum measurement.

Explicit route registrations are GET/POST/PUT/PATCH/DELETE in13route files plus recipe-media HEAD, mount `/api/v1`; method+path unique79. `slotPath` template and media ROUTE_PATH resolved; OPTIONS middleware/SPA wildcard excluded. Validate registered source line/method and current caller/test paths. Group metadata is dependency superset, not per-route executed query graph.

## Local commands

Use Node24.16.0 path `/opt/homebrew/opt/node@24/bin`, pnpm10.33.2, sqlite3CLI3.51.0. Install frozen; preserve lock. Set `NODE_OPTIONS=--no-experimental-webstorage` and canonical TMPDIR under `/private/tmp` on macOS; remote gate variables unset. Commands/outcomes are recorded individually; B00 did not run aggregate `pnpm check`, browser E2E or paid provider evaluation.

```sh
pnpm install --frozen-lockfile
pnpm lint
pnpm typecheck
pnpm exec vitest run --maxWorkers=2
pnpm check:migrations
pnpm build
pnpm recipe:seed:check
pnpm recipe:ingredient-v2:audit
pnpm recipe:refresh:check
pnpm recipe:refresh:release-check
pnpm audit --json
pnpm audit --prod --json
```

Audit exit1 means findings present; V2 release-check exit1 is expected blocked eligibility with4explicit blockers, not a green release. Full-suite initial failure and diagnostic environment must be preserved separately from rerun result.

## Wrangler timing diagnostic

Original failing test at `tests/unit/staging-d1-catchup-check.test.mjs:169` runs actual `pnpm wrangler d1 migrations list ... --local` with isolated prefix/config/state. CI/metrics-only rerun still spends ~57seconds and fails5second timeout. No timeout/source change in B00.

Wrangler3.114.17 bundled update-check1.5.4 awaits registry data before banner; cache file `<TMPDIR>/update-check/wrangler-latest.json` format `{latest,lastUpdate}`. Diagnostic fetches actual public `https://registry.npmjs.org/wrangler/latest` via curl (observed4.149.0), uses current timestamp, and writes cache into a new task-owned directory under `/private/tmp`. This does not change installed package version, global user cache/config or any assertion. Run tests with TMPDIR pointing at that canonical task directory, `CI=true`, `WRANGLER_SEND_METRICS=false`. Cache skips only ancillary update lookup; local D1 prefix listing remains actual.

Focused cached32/32PASS; Wrangler test1.204seconds. Uncached direct CLI banner24.216s/list24.691s/exit59.225s versus cached0.833s/1.764s/1.787s. The lingering update request also delays process exit; full rerun results are recorded in LOCAL_VALIDATION. Never use invented latest-version metadata or increase timeout and label original gate passed. An enduring harness fix belongs B08; B00 records environmental reproduction. Cache expiry1hour means rerun needs fresh registry evidence.

## Hosted/public evidence

Read-only GitHub metadata endpoints: repository ID/name, commit/main, CI38098775083, deploy38103079308, artifact11688468304, main protection, production environment and PR20/29/63. Whitelisted metadata is saved in github-evidence.json. Download ZIP via authenticated GitHub artifact API; verify SHA256 equals API digest `6629461766b13f6f2cf36fc5a0fd7ebcc91e30f9fa4fd38ee0023bb92d9ac804` before extracting release-manifest.json. Do not log credentials or API auth headers. Timestamped receipt is historical observation, not direct current Cloudflare query.

GET public ready via curl without auth; keep returned commit/timestamp/config/issues/services/authority. Python urllib received403 in B00; curl subsequently200. This collection difference is recorded, not a production readiness incident. Full current CF vars/version/D1 ledger/AI flags/R2 bytes/adoption/inbox/SLO require their own read/operator evidence at release gate.
