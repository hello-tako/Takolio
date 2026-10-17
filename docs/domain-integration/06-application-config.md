# Application Configuration

`config/domain-profiles.json` is the central host contract. `src/worker/config/domains.ts` requires exact environment and APP_URL when `PUBLIC_DOMAIN_ROUTING=true`; invalid activation returns a sanitized 503. The fence is absent in unchanged default Wrangler files, so ordinary releases keep existing behavior.

| Environment | APP_URL | API alias | Legacy |
| --- | --- | --- | --- |
| production | `https://takolio.app` | `https://api.takolio.app` | `https://frigo.tungjpstore.net` |
| staging | `https://staging.takolio.app` | `https://api-staging.takolio.app` | `https://frigo-staging.tungbipdz.workers.dev` |

The frontend keeps same-origin `/api/v1` and `/api/v2`. API aliases expose API routes and reject SPA/static content. Split-origin browser clients would need to authenticate against the API host itself: host-only apex cookies are not shared. That extra client flow has not been certified and is not required by the current frontend.

Only WWW safe document requests redirect. Legacy app and API requests continue on their old host without redirect, preserving existing host-only sessions and pending callback URLs. Nested SPA pages remain available and noindex. Admin and unverified native association endpoints return 404.

## Candidate preparation

1. Commit source and require a clean checkout, including untracked files.
2. Refresh `node scripts/domain/capture-runtime.mjs` read-only evidence in a controlled audit commit.
3. From that clean audited commit, run `node scripts/domain/prepare.mjs staging` or `production`.
4. Inspect ignored `.artifacts/domain/<environment>/wrangler.json` and `plan.json`.

Generated configurations preserve observed public flags and complete supported typed bindings, compare compatibility settings, preserve source routes, and add the reviewed domain routes. They explicitly enable `assets.run_worker_first=true` so asset serving cannot bypass host/noindex controls. Paired planner/T20 Vite flags come from the same observed version. No secrets enter Vite variables or evidence.

These are local candidates, never deployment authorization. Live routes, workers.dev exposure, crons, queue consumers, observability and provider isolation remain operational audit blockers; their source values must not be assumed equal to live state. Refresh/review them before any upload. Generated files from an earlier dirty checkout are stale and must be replaced after commit.

No auth protocol, payment rules, schema, feature activation or dependency was changed.
