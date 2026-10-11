# B08c Wrangler4 feasibility and separate compatibility-date rollout

Date: 2026-10-11 JST. Status: READ_ONLY_FEASIBILITY; UPGRADE_NOT_EXECUTED.
Base HEAD: `1963c469e2e3bd4819cda6bb9ef8162101ad523a`.

## Observed baseline

Declared Wrangler `^3.114.0`, installed 3.114.17. Vite is installed 6.4.3.
Production and staging use compatibility date `2024-11-01` with `nodejs_compat`.
Both configs bind ASSETS, D1, R2, KV, queue producer/consumer, AI, cron and
observability. Production additionally uses structured `send_email`; staging
has no email binding and uses AI_MOCK_MODE=true. Resource identities and provider
flags are preserved in this packet.

Hosted CI/deploy/migration jobs request Node22/pnpm10 and frozen lockfiles.
The local checks for this packet use Node24, so they do not certify hosted Node22.
Read-only registry metadata at 2026-10-11 shows Wrangler4 candidate 4.149.0:
Node >=22, peer Workers types `^5.20261006.1`, esbuild 0.28.2, Miniflare
5.20261006.1-alpha and workerd 1.20261006.1. Miniflare metadata lists Undici
7.29.1, ws 8.21.0 and sharp 0.35.5. These versions exceed relevant floors from
this audit, but no install or audit of that resolved graph has been performed.
Its alpha transitive dependency and Workers-types major require deliberate
selection; newest registry metadata is not an automatic recommended version.

Feasibility conclusion: a separate Wrangler4 packet is justified by current
Wrangler3 transitive findings. Node22 policy is compatible with this inspected
candidate's engine range. Configuration, local emulator, command outputs,
email types and hosted action resolution remain unverified. Keep the runtime
compatibility date fixed until the toolchain packet has its own receipts.

## B08c1 - Wrangler owner upgrade, fixed runtime date

1. Select and pin a reviewed Wrangler4 version and compatible Workers types in
   an isolated upgrade packet. Record package/lock/tool versions and registry
   source. Do not force Undici/Miniflare major overrides into Wrangler3.
2. Preserve production/staging identity, routes, assets handling, flags, queue
   retry/DLQ settings, email binding and date `2024-11-01`. Use a sanitized
   artifact-only local config for emulator rehearsals. No real email/provider
   calls, remote resources or production credentials enter local tests.
3. Verify `deploy --dry-run` with local assets and explicit artifact output under
   the selected CLI, then local Worker fetch/queue/scheduled/emulated resource
   tests. Capture config warnings rather than accepting dropped bindings.
4. Rehearse every consumed CLI contract with captured fixtures or a local
   adapter: JSON shape, stderr/exit status, noninteractive behavior and explicit
   `--config`. Parser/flag drift blocks promotion rather than invoking a fallback
   mutation. The required matrix is below.
5. Run frozen install, full lint/typecheck/tests/local migration smoke/build,
   recipe/release gates and fresh full/prod audits. Preserve build/server flag
   pairing and final GIT_COMMIT identity. Record candidate SHA.
6. Obtain exact-SHA hosted CI and approved staging rehearsal receipts, then
   verify health/config/CORS/assets, emulator-vs-edge differences and sanitized
   telemetry. Staging must remain mocked for paid AI and no real email is sent.
7. Production promotion uses the existing release workflow, approval and
   exact-SHA proofs. Capture prior Worker version and verify rollback traffic
   and authority with the current rollback helper. A successful upload alone
   is insufficient.

| Consumed command/behavior | Existing consumers | Required compatibility proof |
| --- | --- | --- |
| secret list with `--format json` | deploy staging preflight | Names-only JSON shape, explicit config and failure behavior; no secret values |
| whoami; d1 list/info `--json` | identity/deploy/migration workflows | Account/config/DB identity and parsing; retain bounded d1-info fallback only as presently authorized |
| d1 execute `--remote --yes --json` | schema, catalog and migration certification | Result-array/statement metadata consumed by parsers, multiple statements, errors and strict read-only query gate |
| d1 migrations list/apply | staging/production migration workflows | Ledger/plan textual output, ordering, confirmation and explicit target; fixture/local proof before any remote apply |
| d1 time-travel info `--json` | migration backup receipts | Bookmark/schema/identity parser fixtures; no recovery mutation in upgrade |
| deploy with `--config` / repeated `--var` | cloudflare/wrangler-action@v3 | Selected CLI actually matches lockfile; action resolution recorded explicitly; exact SHA and paired flags preserved |
| deployments status / versions view `--json` | deploy verification and rollback | Deployment/version IDs, 100% version proof, prior bindings/flags and timeout behavior |
| local dev / assets / queue / scheduled | Worker entrypoint and binding types | No changed SPA/API dispatch, local-only resource calls, cancellation and request telemetry |

`cloudflare/wrangler-action@v3` currently has no explicit `wranglerVersion` in
the inspected deployment workflow. Future rehearsal must prove the CLI resolved
by that action matches the pinned package; do not assume a package edit alone
pins action execution.

## Invariants for operational scripts

`release-check.mjs` and migration policy bind immutable current-main SHA, hosted
CI, approved hardening ancestry, environment, catalog mode/canary/cutover and
paired composition flags. Release rechecks occur after approval and immediately
before upload. Migration workflows bind exact ledger and reviewed chain; 0039
also performs pre-mutation rechecks. These checks may not be removed, broadened
or skipped to accommodate a CLI change.

`deploy-check.sh` defaults to local SQL migration replay; remote schema/week
checks only run under explicit environment flags. An upgrade validation must
keep those flags unset locally. Remote read-only checks and any migration/deploy
remain separate operational steps with existing policy and explicit authority.
Changing a CLI does not authorize migration replay, dataset recovery, paid AI,
provider activation, email delivery or resource identity edits.

## B08c2 - Runtime compatibility-date packet

Start only after B08c1 evidence is accepted. Select a target date based on the
actual workerd/platform behavior changes between 2024-11-01 and that date.
Keep Wrangler and lockfile fixed. Review nodejs_compat, fetch/URL/headers/crypto,
streaming/abort/deadline behavior, structured email types, assets dispatch,
D1/R2/KV, queue ack/retry and cron behavior. Re-run focused regression and full
local gates, then approved staging edge tests with exact deployed SHA.

Production canary/observation must record real bounded error/latency samples
and an executable previous-version rollback receipt. Compatibility-date
warnings, dependency audits and seven-day SLO observations are separate gates;
one green result cannot replace another. No date is advanced by this document,
and neither B08c1 nor B08c2 is certified today.
