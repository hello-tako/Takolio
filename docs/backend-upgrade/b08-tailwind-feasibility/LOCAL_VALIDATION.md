# Exact local validation

Implementation30f1630b63c782de9e6fd37d8726cdadae0fffea, Darwin arm64/Node24.16.0,
pnpm10.33.2. NODE_OPTIONS=--no-experimental-webstorage, CI=true,
WRANGLER_SEND_METRICS=false, TMPDIR=/private/tmp on final-clean gates;
CHECK_REMOTE_SCHEMA/CHECK_WEEK_PARITY_REMOTE unset. Build commit matches source,
timestamp2026-10-12T00:00:00Z; local build planner=true/composition=false.

| Actual command | Result |
| --- | --- |
| pnpm install --frozen-lockfile | PASS; clean committed source; package/lock unchanged |
| pnpm lint | PASS6.359s |
| pnpm typecheck | PASS13.757s; both projects |
| pnpm test tests/unit/braces-depth-guard.test.ts tests/unit/t21rc2-production-capture.test.mjs tests/unit/t21rc2t-production-capture.test.mjs | PASS3files/152tests4.818s command |
| pnpm test | PASS313files/7582tests156.645s command |
| pnpm check:migrations | PASS40migrations0.458s |
| pnpm build | PASS7.680s; CSS exact134861bytes, actual SW SHA token |
| pnpm audit --json | FAIL/exit1;1HIGH unpatched published version remains reported |
| pnpm audit --prod --json | PASS/exit0;0 advisories |
| fresh private pnpm install --frozen-lockfile --offline | PASS; all7 installed patched JS files exact |
| candidate pnpm install --frozen-lockfile / build / both audits | PASS; candidate stays private/unapplied; import warnings corrected |
| paired actual-route CSS browser probe |20style comparisons incompatible;15pixel changes; baseline recovery exact |
| auth focus/hover/forced-color pairs |6incompatible; baseline recovery exact |
| installed/upstream compare_braces.mjs |756differential vectors0mismatches; explicit512KiB control6unpatched stack failures;12patched rejections |
| pinned runner.py scan on clean implementation | FAIL/exit1 retained;4557files/853sources/0Semgreperrors/findings;17unchanged Gitleaks/2zizmor/518Syft |
| current snapshot/candidate-source/provenance reconciliation | PASS; exact source bytes/coverage,17adjudicated unchanged matches;0new/unresolved |
| protected Git blobs | PASS4564base-tracked files; no unexpected changes |

Exact argv/timestamps/durations/source-before/after/package/lock/log hashes for39
commands are in validation.json. Commands with expected findings remain nonzero.
Raw logs are private; the export contains only bounded reviewed metadata.

Retained first full:2files/11fail,311files/7571pass;175.625s command. The new
helper omitted TMPDIR, producing /var vs /private/var path mismatches; prior
canonical pin fixes the93affected receipt tests and later full suite. No assertion
change. First browser pixel-control fail84pixels, missing YAML dependency and
unsupported default-stack crash assumption are retained; corrected probes bound
those limitations. Initial nominal routes redirected; final probes assert actual
route/query identities. Generated patch context-only whitespace warnings are
reviewed separately from applied source. No source/audit/test waiver.

Final docs-only receipt and its scanner/verifier are checked after this export;
they are retained privately because a receipt cannot embed its own final SHA.
No remote CLI/D1, real provider/email, hosted/device/SLO or production action runs.
