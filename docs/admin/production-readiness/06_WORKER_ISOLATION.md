# Worker isolation

Runtime source: `9395f0e31ea599f1eb7780a8eba36964fed7c483`. Main baseline: `526596a8cd857984ad2b69901a8c7b0e9d6bccc2`.
Prepared by implementation owner `/root` (Codex); independent reviewer is
`/root/independent_admin_review`. Evidence environment: local macOS arm64,
Node v24.16.0, pnpm 10.33.2, Python 3.9.6, `TMPDIR=/private/tmp`.
Evidence timestamps are UTC. Commands, exit codes, log digests and limitations
are in `evidence/verification.json` and `12_REGRESSION_RESULTS.md`.
No live Cloudflare operation or operator approval is implied.

Authority files: `wrangler.admin.jsonc`, `wrangler.admin-facade.jsonc`,
`src/worker/admin-read-facade-worker.ts`, `src/worker/facade/contract.ts`,
`customer-read-service.ts`, `output-contract.ts`, `query-budget.ts` and
`routes/admin/customer-facade-client.ts`.

| Claim | Evidence | Limit |
| --- | --- | --- |
| Admin has no customer D1 or direct customer SQL | Config tests; preflight protected-path checks; client delegates through CUSTOMER_READ | Actual deployed bindings unverified |
| Facade exposes no mutation method | Only RPC `read`; deny write wrapper; negative operation/input/output tests | Platform D1 authority remains writable |
| Credentials never reach Admin | Static projections produce password-presence booleans only; strict output schemas reject credential keys | Deployment/code integrity required |
| Facade HTTP unavailable | Default fetch 404; workerd GET/POST probes; template disables route/preview/workers.dev | Actual Cloudflare route identity unverified |
| Role/reveal flags cannot be supplied freely | Capability HMAC covers actor roles, operation, exact input and 15-second expiry | Capability secret compromise defeats this trust boundary |
| Customer behavior remains compatible | Unchanged protected paths, full suite, customer workerd and additive-schema recovery checks | No live customer query or production smoke |

Named operations: users.list, users.get, users.eligible, users.labels,
households.list, recipes.list, recipes.get, recipes.version, recipes.summary,
billing.summary, billing.transactions, ai.summary, ai.usage, overview, system.
Every input is a strict schema; role-based PII reveal is checked server-side.
Page size is at most 100, page at most 1000; each source table materializes at
most 5001 rows to detect the 5000-row cap; at most 40 prepared queries per
operation; output has bounded schemas and a serialized cap of 512000 characters.
Oversize sources fail closed rather than returning sampled totals as complete.

`workerd` evidence uses the actual Wrangler/workerd multi-Worker topology,
local D1 and Chromium. The suite includes disabled flag/asset checks, foreign
origin, customer isolation, public facade refusal and production bundle removal
of local password authority. Browser preview tests additionally use SQLite
adapters and must not be mistaken for remote workerd/staging certification.
