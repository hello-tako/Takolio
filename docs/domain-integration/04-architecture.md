# Architecture Decision

Keep one combined Worker per environment: React/Vite Static Assets plus Hono API routes in `frigo`, and the isolated equivalent in `frigo-staging`. Add reviewed Worker custom domains; do not create competing Workers or Pages projects.

- `takolio.app` and `www.takolio.app` use production `frigo`.
- `api.takolio.app` uses that same Worker and accepts API paths only.
- `staging.takolio.app` and `api-staging.takolio.app` use isolated `frigo-staging` only after safety/access checks.
- `admin.takolio.app` remains reserved and inactive.
- Legacy hosts remain reachable during migration; only `www` document requests redirect.

The default Wrangler files remain byte-identical to the verified base. `scripts/domain/prepare.mjs` emits ignored, local candidate configs after complete typed binding and compatibility checks. `assets.run_worker_first=true` is required so Static Assets cannot bypass host boundaries. The candidate is not a deployment artifact until generated from a clean audited commit and all operational settings are reverified.

`APP_URL` remains the canonical browser/session/payment origin. The current frontend uses same-origin `/api`; API aliases are operational/API surfaces, not a promise of shared apex cookies. Host/origin values are exact allowlists; forwarded headers are never used to construct redirects.
