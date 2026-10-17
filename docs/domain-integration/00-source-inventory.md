# Takolio Domain Integration - Source Inventory

## Verified source

- Repository: `hello-tako/Takolio`, GitHub repository ID `1422954151`, public, default branch `main`.
- Verified main source head: `526596a8cd857984ad2b69901a8c7b0e9d6bccc2`.
- Working branch: `feat/takolio-app-domain-integration`, based directly on verified `origin/main`.
- Existing Admin draft PR is separate and is not included in this branch.
- Current live production Worker version was inspected through Wrangler metadata and reports the same main SHA. Source identity is therefore `VERIFIED` for the inspected version.

## Runtime architecture

- React/Vite frontend and Hono API are shipped as one Worker named `frigo` with Workers Static Assets.
- Staging uses the same combined Worker shape under `frigo-staging`, with separate D1, R2, KV and Queue resources.
- API routes are `/api/v1` and `/api/v2`; SPA fallback is served by the same Worker.
- Authentication is host-origin based with HttpOnly Secure SameSite=Lax session cookies, CSRF origin checks, Google GIS credential verification and OTP routes.
- PayOS initiation derives return/cancel URLs from the trusted `APP_URL`; webhook verification remains server-side.
- `admin.takolio.app` is not routed or activated.

## Source classifications

| Area | Finding | Classification | Risk | Required test |
| --- | --- | --- | --- | --- |
| `wrangler.jsonc` | Production Worker/bindings and old custom domain | FOUND | Domain cutover can change auth/payment callback origin | JSONC parse, binding identity, staging isolation |
| `wrangler.staging.jsonc` | Isolated staging resources and workers.dev URL | FOUND | New custom domain needs DNS/custom-domain access | staging config, noindex, live smoke |
| `src/worker/config/origins.ts` | Trusted-origin and APP_URL validation | FOUND | Wrong APP_URL breaks CORS/CSRF | CORS/CSRF matrix |
| `src/worker/routes/auth.ts` | Session, Google, OTP and CSRF routes | FOUND | OAuth/provider console changes required | unit/integration and real operator test |
| `src/worker/routes/billing.ts` | PayOS webhook and entitlement checks | FOUND | Callback migration must be coordinated | signed/invalid/duplicate fixture tests |
| `src/worker/payment/payos.ts` | Return/cancel URLs from `applicationOrigin` | FOUND | Premature production mutation affects payment | sandbox-only verification |
| `public/manifest.json`, `public/sw.js` | PWA origin-scoped storage/cache | FOUND | Old-origin data does not migrate automatically | PWA install/cache smoke |
| `.well-known/*` | No verified mobile association payloads | NOT_USED | Publishing guessed IDs would bind the wrong app | Operator data required |
| Admin Worker configs | Existing but disabled and isolated | FOUND | Accidental activation would cross a separate gate | route absence and Admin CI |

## URL inventory policy

Legacy `frigo.tungjpstore.net` values in historical docs, fixtures and release tools remain classified as `LEGACY_COMPATIBILITY`, `DOCUMENTATION`, or `TEST_FIXTURE` unless a runtime dependency is proven. Runtime production `APP_URL`, SEO metadata and custom-domain routes are changed through the domain profile only; blanket replacement is prohibited.

## Manually reviewed active URL/configuration surfaces

The compressed URL inventory is path-assisted and query-redacted; it includes tracked and non-ignored new files. It is a discovery aid, not a claim that every historical occurrence has runtime significance. Scheme-free hostname/env references were separately reviewed with rg.

| File / value | Purpose and environment | Proposed behavior | Risk / required test / rollback |
| --- | --- | --- | --- |
| `src/web/services/api.ts` relative `/api/v1`, `/api/v2` | Browser API, all envs | Retain same-origin convention | No sibling-cookie migration; auth/CORS regression; restore previous Worker |
| `wrangler.jsonc` APP_URL and legacy custom domain | Production baseline | Leave default unchanged; new origin only in reviewed candidate | Compare exact live binding/flags/settings; restore version plus route snapshot |
| `wrangler.staging.jsonc` workers.dev APP_URL | Staging baseline | Leave default unchanged; candidate uses staging profile | Isolation and Access checks before deploy; restore staging version/routes |
| `index.html` legacy OG URL | Baseline SEO and source fixture contract | Retain baseline; activated Worker rewrites response OG/canonical/Twitter | Workerd metadata/validator tests; disable fence/restore version |
| `src/web/features/week/WeekExportModal.tsx` old bare hostname | Shopping-list attribution, browser | Current `window.location.host` | Display-only, no sensitive redirect; existing export/UI checks; revert one line |
| `src/worker/utils/oauth.ts` Google tokeninfo and AuthPage GIS | External auth credential flow | Retain endpoints; operator adds exact JS origins | No guessed callback; live login required; retain old authorized origin |
| `src/worker/services/email.ts` the existing configured sender, Resend API | Existing email transport | Retain sender; OTP has no domain link | Approved inbox delivery required; no transport/credential mutation |
| `src/worker/payment/payos.ts` APP_URL + `/plus` | Return/cancel for each env | Derive from reviewed APP_URL as before | Sandbox and pending-order checks; coordinated config/provider rollback |
| `src/worker/routes/billing.ts` PayOS webhook path | Server callback | Exact `/api/v1/billing/payos/webhook` on reviewed API host | Signed/invalid/duplicate tests; retain old endpoint |
| `public/manifest.json`, `public/sw.js` | PWA root-relative assets/cache | Retain relative paths and build-ID strategy | New-origin storage is separate; install/offline tests live pending |
| `public/_headers`, `src/worker/config/csp.ts` | CSP/security and external Google/Turnstile/fonts | Retain provider allowlists; no external API base introduced | Workerd headers; live mixed-content/PWA pending |
| Release scripts/workflows and historical docs/tests | Legacy compatibility and repository-bound authorities | Retain identity pins; reissue only through separate reviewed release governance | Current repo has no deploy secrets/Environments; no authority bypass |

Production observed source matches verified main. Staging SHA `f7386e6a8d9ef8955cc314daebf4d1aeecf4e5a1` is an existing repository commit. Live provider/setting coverage limits are explicit in the infrastructure inventory.
