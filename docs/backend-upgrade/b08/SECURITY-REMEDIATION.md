# B08 dependency audit and remediation matrix

Date: 2026-10-11 JST. Status: TRIAGED_WITH_RESIDUAL_AUDIT_FAILURES.
Base HEAD: `1963c469e2e3bd4819cda6bb9ef8162101ad523a`.
No dependency, lockfile, Vite, Wrangler or workflow changes are made here.

## Fresh source-bound evidence

The coordinator captured both audits at 2026-10-11T11:13:03Z with Node 24,
`CI=true`, `NODE_OPTIONS=--no-experimental-webstorage`, no remote-check flags,
and `WRANGLER_SEND_METRICS=false`. Both commands exit 1:

| Command | Critical | High | Moderate | Low | State |
| --- | ---: | ---: | ---: | ---: | --- |
| `pnpm audit --json` | 2 | 16 | 19 | 4 | FAIL |
| `pnpm audit --prod --json` | 0 | 0 | 2 | 0 | FAIL |

Counts are advisory finding counts returned by the registry, not independently
reproduced exploit counts. The full audit has 41 findings in 15 package names.
The production audit is a dependency classification, not proof of public
reachability; frontend React Router code is shipped to browsers.

Verified raw log hashes:

- Full: `c302bfc15f4054f45358366dc59293e488497a7a7474eb7b357b1b12fe3f18a6`
- Prod: `bdc7313d26f196c5427205c3ce28110ce5fc9a52ca765c4df3b7456eb7c85c62`

`audit-triage.json` under `.artifacts/backend-program-20261011/b08-telemetry`
preserves all 41 exact advisory URLs, affected/patched ranges, versions and graph
paths, both hashes/counts and protected-file hashes. `registry-metadata.json`
contains read-only metadata for concrete owner-upgrade candidates. Metadata
availability is not a compatibility test, installation or remediation receipt.

## Remediation packets

| Packet / priority | Verified graph and installed version | Findings | Exposure and concrete next gate |
| --- | --- | --- | --- |
| B08-security-1 / P1 | vitest 3.2.7 > tinypool 1.1.1; vitest > @vitest/mocker 3.2.7 | 2 critical tinypool + 2 moderate Vitest/mocker | Local/CI test workers. Tinypool patch floor 2.1.2 and Vitest/mocker 4.1.11. Upgrade direct owner Vitest to a reviewed 4.1.11+ candidate; validate config/worker pools and all tests. Do not override Tinypool 1.x to 2.x inside an old owner. |
| B08-security-2 / P1 | wrangler 3.114.17 > esbuild 0.17.19; wrangler > miniflare > undici 5.29.0 > @fastify/busboy 2.1.1 | 1 moderate esbuild, 13 undici (3 high/7 moderate/3 low), 2 busboy (1 high/1 moderate) | Dev server, local Worker emulator and deployment tooling/CI. Owner upgrade Wrangler4 separately from compatibility date. Floors in this audit: esbuild 0.25.0, Undici 6.28.1, busboy 3.2.2; these floors do not authorize incompatible transitive overrides. |
| B08-security-3 / P1 | react-router-dom 6.30.6 > react-router 6.30.6 | 2 moderate production | Both advisories require 7.18.0+. Upgrade direct router owner in a separate frontend compatibility packet; adversarial browser navigation, auth redirects, planner route aliases and production audit must pass. No blanket runtime waiver. |
| B08-security-4 / P1 | sharp 0.33.5 (direct devDependency) | 3 high native image-library advisories | Image/icon/OCR/media scripts read files; not a Worker runtime import found in this triage. Upgrade owner to 0.35.5+ and verify native install on supported OS/CI plus representative decoding and output dimensions. Treat untrusted images as exposed tooling inputs. |
| B08-security-5 / P2 | jsdom 26.1.0 > ws 8.18.0 | 1 high/1 moderate | Browser-simulation tests. Patched ws floor 8.21.0. Choose a compatible jsdom update or verified same-major ws resolution, then rerun DOM/session/offline tests. |
| B08-security-6 / P2 | eslint > minimatch > brace-expansion 1.1.18; @typescript-eslint/eslint-plugin > type-utils > typescript-estree > minimatch > brace-expansion 5.0.9 | 4 high/2 moderate | Lint/tooling file-pattern parsing. Floors 1.1.21 and 5.0.12. Refresh compatible direct owners/lock graph and validate full lint/typecheck. |
| B08-security-7 / P2 | vite-plugin-pwa > workbox-build > ajv > fast-uri 3.1.7; workbox-build > rollup-plugin-off-main-thread > ejs > jake > filelist > minimatch > brace-expansion 2.1.4; workbox-build > @rollup/plugin-terser > serialize-javascript 7.1.1 | 2 high/2 moderate/1 low | PWA/build pipeline. Floors fast-uri 3.1.8, brace-expansion 2.1.7, serialize-javascript 7.1.2. Upgrade PWA/Workbox owner graph; validate service worker build token, cache rollover, offline writes and paired build/server flags. |
| B08-security-8 / P2 | tailwindcss > chokidar > braces 3.0.3; tailwindcss > postcss-selector-parser 6.1.4; postcss > source-map-js 1.2.1 | 2 high/1 moderate | CSS/source-map build/watch tooling. Floors selector-parser 7.1.6 and source-map-js 1.2.2. braces advisory reports patched range `<0.0.0` (no published patched range); select an owner graph that removes it or obtain a reviewed, time-bounded exception. Do not claim an unavailable patch exists. |

P1 here means remediate before promoting the backend program; severity remains
the registry's value. Dev/CI findings are supply-chain/tooling risk, even when
excluded from `--prod`.

## React Router applicability

- [GHSA-wrjc-x8rr-h8h6](https://github.com/advisories/GHSA-wrjc-x8rr-h8h6),
  CVE-2026-53669: backslash open redirect in Link/useNavigate. Installed 6.30.6,
  affected `>=6.0.0 <7.18.0`, patch `>=7.18.0`. The application uses Link,
  Navigate and useNavigate, including dynamic route values. Triage did not
  reproduce an attacker-controlled complete redirect target; this uncertainty
  remains a browser validation gate.
- [GHSA-337j-9hxr-rhxg](https://github.com/advisories/GHSA-337j-9hxr-rhxg),
  CVE-2026-53666: deserializeErrors SSR hydration constructor injection.
  Installed 6.30.6, affected `>=6.4.0 <7.18.0`, patch `>=7.18.0`.
  `src/web/main.tsx` uses createRoot and `App.tsx` uses BrowserRouter; no SSR
  hydration entrypoint was found in this inspected path. This narrows observed
  applicability but does not remove the package finding or certify every build.

## Toolchain selection and residual gates

Current installed Vite is 6.4.3; it has no direct advisory in this receipt.
Its major upgrade is not necessary to remove the current Vitest findings:
registry metadata for Vitest 4.1.11 admits Vite ^6/^7/^8 and no longer lists a
Tinypool dependency. Verify the resolved lock graph and actual suite before
accepting this candidate. Current config uses `poolOptions`, which needs
migration review under Vitest4. Do not blindly select the newest Vitest5/Vite8.

Registry metadata for Router7 admits React18; it still requires behavioral
browser validation. sharp 0.35.5 requires Node >=20.9.0. Current hosted jobs
request Node22; local evidence used Node24. Pin and record actual supported
runner versions for future install/check receipts.

Every upgrade packet must capture before/after package and lock hashes, frozen
install, appropriate full gates, both fresh audits and a reviewed remaining-risk
matrix. For Wrangler, include the CLI/output/rollout gates in
`WRANGLER4-FEASIBILITY.md`. Final promotion requires zero unexplained high/critical
findings and a passing production audit, or an explicitly reviewed exception
with owner, reason, scope and expiry. These gates are currently unresolved.
No exploit reproduction, dependency fix, hosted CI, deployment or production
security certification is claimed by this report.
