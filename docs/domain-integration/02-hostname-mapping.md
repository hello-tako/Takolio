# Hostname Mapping

| Hostname | Environment | Intended Worker behavior | Current live status |
| --- | --- | --- | --- |
| `takolio.app` | production | SPA landing and same-origin `/api`; canonical metadata | NOT_CONNECTED; DNS absent |
| `www.takolio.app` | production | 308 document redirect to apex, preserving encoded path/query; API, callback and mutating requests return 404 | NOT_CONNECTED; DNS absent |
| `api.takolio.app` | production | Same Worker, API paths only; no SPA/static fallback | NOT_CONNECTED; DNS absent |
| `staging.takolio.app` | staging | Staging SPA, noindex, isolated resources | NOT_CONNECTED; DNS absent |
| `api-staging.takolio.app` | staging | Staging API paths only, noindex | NOT_CONNECTED; DNS absent |
| `admin.takolio.app` | reserved | No route or activation in this task | Intentionally 404 in prepared Worker |
| `frigo.tungjpstore.net` | legacy production | Existing app and API remain available without forced redirect during transition | LIVE; probe reached app/readiness |
| `frigo-staging.tungbipdz.workers.dev` | legacy staging | Existing staging app/API remains available | LIVE; probe reached readiness |

The legacy app is deliberately preserved to avoid breaking host-only cookies and old callback/webhook clients. The branch never redirects legacy documents. All new hosts require custom-domain attachment and DNS before live verification; no new-host TLS PASS claim exists.

`run_worker_first` is enabled only in generated candidates so host checks, API boundaries and noindex headers run before Static Assets. `.well-known` association files remain 404 until mobile identifiers are verified.
