# B08 local dependency selection

Date: 2026-10-12 JST. Classification: official registry research, not installation
or runtime compatibility certification. Baseline program checkpoint: `2c42984b`.
The coordinator owns package, lockfile and configuration changes. Metadata is
recorded in `dependency-registry.json` with exact response hashes and URLs.

## Selected and retained owners

| Owner | Exact candidate / retained version | Selection and required proof |
| --- | --- | --- |
| Wrangler | 4.149.0 | Stable published owner uses official Miniflare 5.20261006.1-alpha, Undici 7.29.1, ws 8.21.0, sharp 0.35.5 and esbuild 0.28.2. Preserve runtime date `2024-11-01`; prove local emulator, config and consumed CLI contracts. Alpha transitive dependency is disclosed, not certified by registry metadata. |
| Workers types | 5.20261006.1 | Exact lower bound of Wrangler peer range. Major5 publishes root/experimental types only; no dated subpaths. Root types represent latest runtime. Local `wrangler types` against a sanitized config with fixed date/flags is the separate exact-date type proof. |
| Vitest | 4.1.11 | Admits Vite6 and React18 stack; no Tinypool dependency. Remove `test.poolOptions`, use `test.execArgv: testExecArgv`; preserve setupFiles and test discovery. Run full suite. |
| React Router DOM | 7.18.3 | Initial historical floor7.18.0 introduced a fresh RSC high finding (GHSA-qwww-vcr4-c8h2, affected >=7.12.0 <7.18.2); latest stable patch 7.18.3 selected, React >=18. `future`/v7 flags removed from MemoryRouter/BrowserRouter; preserve transition intent through reviewed `useTransitions` props and validate splat navigation, auth redirects and route aliases. |
| sharp | 0.35.5 | All three recorded native advisories meet their patched floors. Node >=20.9; verify native loading and representative image decoding/output dimensions. |
| jsdom | retain 26.1.0 | Permits ws ^8.18.0; fresh compatible lock resolution to 8.21.0 or newer removes recorded ws findings without a DOM major upgrade. Verify resolved graph and DOM tests. |
| ESLint | retain 9.39.5 | Latest maintenance9, no major migration needed. Refresh compatible minimatch3/brace-expansion1 resolution to floor1.1.21. |
| TypeScript ESLint pair | 8.71.1 | Stable same-major parser/plugin pair; admits ESLint9 and TypeScript5.9.3. Estree uses minimatch ^10.2.2, whose brace-expansion5 can resolve patched5.0.12. Full lint/types required. |
| Vite PWA | remove unused direct devDependency | Repository-wide import/usage search found only package declaration. Actual service worker is `public/sw.js`, with existing Vite build-token injector. Removal drops unused Workbox owner graph; verify custom SW build token and offline/client tests. |
| PostCSS | 8.5.29 | Same-major stable, source-map-js ^1.2.2. Refresh graph and verify CSS/build. |
| Tailwind | retain 3.4.19 | Latest v3 LTS. No published patched braces version; selector-parser patched7.1.6 is outside owner range ^6.1.2. Do not claim same-major owner refresh fixes either finding. |

## Rejected automatic selections and remaining compatibility work

Latest stable Wrangler with stable Miniflare4 is 4.116.0, using Miniflare
4.20260730.0 / sharp0.35.2 / Undici7.28.0 / ws8.21.0. Its pinned sharp is below
recorded floors0.35.4 and0.35.5, so this graph is not fully patched. Selecting
4.149.0 retains the official owner graph instead of forcing a Miniflare major
inside an older owner. Package metadata alone does not prove any candidate's
resolved audit or emulator behavior.

Wrangler4 still exports `unstable_dev`, `unstable_splitSqlQuery`, forceLocal,
watch, local-only flags and D1 experimental bindings. Its unstable_dev persistence
contract is `persist?: boolean` plus `persistTo?: string`. The local-D1 helper's
old `persist: { path }` must migrate to boolean and explicit directory, with
restart/persistence/isolation proof. No operational remote command is authorized
by this local change.

PWA alternative if the owner is retained: existing0.21.2 supports Vite6 and
Workbox ^7.3.0, permitting7.4.1 without a plugin major. Workbox7.4.1 removes the
old ejs/jake path, but fresh graph/audit still matters. Direct use was not found,
so removal is narrower than introducing a new plugin lifecycle.

Tailwind3 cannot remove braces merely by updating chokidar: it also uses
micromatch/fast-glob paths. Forcing chokidar3 to4 removes glob-watch semantics and
is not a safe generic override. A reviewed, narrowly scoped selector-parser7.1.6
candidate is plausible: its major change makes insertions during iteration safe,
and Tailwind's deep `dist/util/unesc` import remains available. This is outside
the declared owner range and requires meaningful CSS/build parity validation.
Braces remains an honest blocker unless its owner graph is removed, an actual
reviewed patch is implemented, or a scoped, owned, expiring risk exception is
explicitly accepted. No unavailable published patch is invented.

Vite 6.4.3, React 18.3.1, TypeScript 5.9.3 and runtime compatibility date remain
independent decisions. No Vite8/React19/Tailwind4 migration is necessary for the
first five owner packets. Hosted Node 22, remote Cloudflare, provider calls, email,
paid operations and deployment are outside these metadata checks.

## Research evidence

Read-only official npm registry metadata and tarballs were inspected. Tarball
SHA512 integrity was verified for Wrangler 4.116/4.149, Workers-types 5.20261006.1, Vitest4.1.11, Router7.18 and selector-parser7.1.6. Verified declaration
contracts and tarball SHA256 values are recorded in the JSON metadata.
No packages were installed and no tests/builds were run by the research agent.
Coordinator install/check receipts remain authoritative for actual remediation.

## Reviewed current compatibility deltas

The coordinator selected both exact-owner selector-parser overrides: Tailwind
3.4.19 and postcss-nested 6.2.0 to parser 7.1.6. The fresh full audit now retains
one high braces advisory, with no patched range; production audit is zero.
This is an actual residual and does not become an implicit accepted exception.

App's BrowserRouter explicitly uses `useTransitions={false}`. Router6's original
unflagged default performed urgent updates; Router7 wraps updates in transitions
by default. This one prop restores the prior scheduling behavior, including the
registration Turnstile lifecycle. Two test wrappers that represented that old
default use false; twelve wrappers previously opting into v7 transitions retain
true. No auth protocol, callback, state machine or assertion is removed.
The seven StaticRouter server imports migrate to the root export. Vitest mock
narrowing is type-only; font fixture reads the identical base64 bytes using the
Node filesystem encoding overload. Independent byte/assertion reversal evidence
is recorded separately from runtime/browser validation.
