# Independent compatibility and security review

Review baseline: `2c42984b2839d1b03c3b0ccfb89998d3535a48d8`.
Scope is the local B08 change, without hosted execution or deployment. The final
read-only report is bound to the exact implementation SHA in the exported packet.
Earlier scope artifacts remain historical snapshots and are not rebound to it.

## Source and assertion conclusions

Independent working-tree review validates 794 protected tracked files and modes
under src/packages/scripts/migrations/public plus Wrangler configs and AGENTS.
The sole approved runtime source delta is App's BrowserRouter scheduling prop;
reversing it reconstructs the baseline blob. All 40 migrations, payment code and
payment assertions, provider configuration, resource IDs, runtime date, generator
source and public assets remain byte-identical.

The compatibility review checks 23 existing test files before the separately
approved PNG reproducibility migration. Twelve future-flag wrappers retain
transition opt-in via useTransitions=true; two old unflagged auth test wrappers
retain urgent scheduling via false. Seven StaticRouter imports use Router7's root
export. Existing assertion lines are preserved apart from sharp's exact pinned
owner version. Mock signature narrowing has no runtime effect. Font encoding uses
the equivalent Node fs base64 overload. Local-D1 helper uses the new boolean
persistence plus explicit persistTo directory.

App's urgent scheduling prop restores the original unflagged Router6 updates;
Router7's default uses startTransition. Auth callbacks, tokens, OTP/Turnstile
protocols, data authority and navigation targets are unchanged. Browser evidence
is separate from wrapper tests and is scoped explicitly in the final packet.

The PNG gate is an approved semantic migration. All 24 SVG exports still require
exact bytes. All 12 PNG exports require exact decoded pixels and matching
format/dimensions/channels/color space/depth/alpha, including false alpha. Other
brand tests remain unchanged. Independent generated evidence checks all 36
exports: 30 remain byte-identical, and the six small PNGs with changed compression
retain identical inflated filter scanlines and decoded pixels. Generated checksums
are recorded separately. The original byte-identity failure is retained and is
not retroactively classified PASS; generator source and public bytes are preserved.

The parser refactor changes one async mock region and preserves all 80 existing
assertion lines. Its five linked receipt hashes are verified, including retained
failed attempts and the final pinned Semgrep PASS for exactly one source. All 16
Gitleaks location hashes are unique and map to captured findings; current source
hashes and producer/provenance hashes match. Categories reconcile to 9 checksums,
1 reachable commit identifier, 2 static error codes and 4 synthetic fixtures.
Historical overlay bytes are not re-fetched and no credentials are validated
against services. Raw findings are retained without suppression.

The Wrangler import-output fixture executes actual installed 4.149.0 vendor
handler/import/renderer slices in a VM with stubbed external boundaries. All 27
original expectation/rejection lines remain except the owner version; 106 tests
PASS. The production parser and all legacy strict framing/summary checks remain.
No arbitrary provider text, duplicate key, failed/malformed summary or query-style
result is accepted by weakening parser validation.

Ten workflow edits reverse to exact baseline bytes after removing only the 67
immutable refs, 2 quoted SHA env substitutions, 1 CI credential flag, 2 explicit
empty cache inputs and 2 exact Wrangler-version inputs. Release and migration
conditions, permissions, Environments, rechecks and operational proof bodies
remain. Five focused workflow policy files pass 356 tests; four additional
security assertions strengthen the new contracts. No new workflow is enabled.

## Actual local compatibility evidence

Isolated Wrangler4 replay verifies the exact 40 migration source hashes and ledger,
reapplication/pending counts zero, schema gate and foreign-key results empty,
quick_check=ok, and all six strict OTP tables. All six command log hashes and the
replay script hash are independently verified. Its disposable config uses a local
resource ID, allowlisted credential-free environment and isolated global config;
project dotenv and remote commands are excluded.

The local CLI probe verifies ten consumed help/flag contracts, fixed-date runtime
type generation and a dry-run bundle. Its 13 command log hashes and script hash
match. The unchanged Worker sources also compile with the generated 2024-11-01
nodejs_compat declaration replacing current package globals via --types. Worker
skipLibCheck remains the project's existing default. This validates the source API
surface, not edge execution or the semantics of remote command responses.

Native evidence, actual App routing, installed Router adversarial fixtures, built
custom service-worker/offline checks, and final CSS parity are separate receipts.
Their exact scope, source hashes and limitations require the final read-only
committed-SHA review; none substitutes for hosted or provider acceptance.

## Remaining gates

- Full dependency audit remains FAIL: one high GHSA-vfj7-8cjw-p6xm in
  Tailwind3.4.19 > chokidar3.6.0 > braces3.0.3. Affected <=3.0.3; registry patched
  range `<0.0.0`. Registry latest braces is 3.0.3. No published fixed version exists
  in the inspected metadata. Tailwind also consumes micromatch/fast-glob, so a
  chokidar major override alone is not a safe complete fix. No waiver is inferred.
- Production audit PASS is separately observed after Router7.18.3. The initial
  historical 7.18.0 floor produced a fresh RSC high finding and was corrected.
- Pinned zizmor retains 2 actual cache-poisoning findings/exit14. Official pinned
  setup-nodev4 action, source and distributed entrypoints prove empty supported
  cache disables restore/save; zizmor applies v5's default cache model to v4.
  The version mismatch is documented, not suppressed or presented as a green scan.
- Hosted Wrangler-action resolution, Node22/native install, consumed remote CLI
  JSON/text/error fixtures and actual edge behavior remain separate gates. Local
  VM output, fixed-date compile and dry-run proof do not authorize deployment or
  certify remote commands, queues, email, AI, rollout, rollback, SLO or billing.

## Evidence references

The source-only and App-aware scope snapshots are retained at
`.artifacts/backend-b08-local-remediation/independent-transaction-scope-review.json`
and `independent-transaction-scope-review-v2.json`. Workflow action/test/cache
contracts and the vendor fixture hashes are in this packet's corresponding JSON
records. Initial and semantic brand receipts plus the generated checksum manifest
are separate artifacts. Focused command logs/receipts are immutable under
`.artifacts/backend-b08-local-remediation`; raw scanner reports remain private.

## Read-only committed-SHA checklist

1. Resolve the supplied exact implementation commit and confirm it matches HEAD.
   Read working-tree status before/after; verify package/lock/source/workflow hashes
   against final receipts, with explicit allowance for later docs-only commits.
2. Reconstruct every approved delta against baseline: App scheduling, test API/pin
   changes, PNG semantic migration, selector overrides, scanner parser region and
   workflow refs/quoted env inputs. Verify untouched business authority, payments,
   all applied migrations, public/generator bytes, configs/date and IDs, and modes.
3. Inspect final receipt commands/exits/log hashes and source binding for frozen
   install, lint, both type projects, full tests, migration smoke, sequential build,
   isolated Wrangler4 D1, fixed-date Worker compile, meaningful native/browser/
   CSS/SW checks and fresh audits. Compare totals to logs; preserve initial failures.
4. Inspect pinned scanner selftests and repository coverage/tool/source hashes.
   Reconcile parser errors, raw Gitleaks counts with adjudication and exact workflow
   findings; Syft is a declared graph, not vulnerability/license certification.
   Confirm no raw secret/report/pointer/snapshot source is exported. Historical
   discovery path references are separately disclosed if present in parent logs.
5. Review final docs for truthful accepted vs unresolved status: braces stays high,
   cache findings stay actual scanner failures, external/human/provider/paid/hosted
   prerequisites remain unperformed, and no all-plan or production PASS is claimed.
   No tests/builds/install/remote commands are rerun by this read-only closeout.
