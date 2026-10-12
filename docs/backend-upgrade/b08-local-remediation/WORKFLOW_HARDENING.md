# Existing workflow security delta

Baseline: `2c42984b2839d1b03c3b0ccfb89998d3535a48d8`. Local source edits only.
No workflow run, push, settings change, deployment or remote operation occurred.
The docs-only security workflow candidate remains disabled.

Ten existing workflow files receive 67 immutable action pins. Official GitHub
ref APIs resolve each former v4/v3 tag; annotated pnpm tags are peeled to their
commit. API response hashes and exact action.yml hashes are recorded in
`workflow-action-provenance.json`. Existing immutable pins remain unchanged.

CI checkout now disables credential persistence. Two post-deploy smoke steps
receive the same verified release SHA through `DEPLOY_SHA` and quote that shell
variable, removing template expansion from the executable shell body. Two existing
Wrangler actions pin their supported `wranglerVersion` input to4.149.0. Deployment
Node setup explicitly sets its supported `cache` input to the empty string.

All other workflow bytes match the reviewed baseline after reversing these
controlled edits: event triggers, permission scopes, protected Environments,
immutable-SHA/ancestry/CI checks, schema/migration/corpus authority, paired build
flags, approval conditions, rechecks and rollback/proof steps are preserved.
No release condition or operational command is relaxed.

Five existing workflow policy tests update exact expected action refs, credential
and quoted-SHA contracts. Four additional assertions verify SHA env binding,
immutable Wrangler action, exact CLI version and explicit empty cache. Existing
negative mutation tests and authority checks remain. Focused local validation:
5 files /356 tests PASS under Node24 and Vitest4.1.11. Source reversal/hash proof is
recorded in `workflow-test-delta.json`; command evidence lives in
`.artifacts/backend-b08-local-remediation/b08-workflow-policy-focused-final.json`.

## Actual scanner result and cache model discrepancy

Pinned zizmor1.30.1 runs offline with no config, no ignores and strict collection.
The result decreases from72 findings to2: 67 unpinned uses,2 template-injection and
1 artipacked finding are removed. Both remaining findings are `cache-poisoning`
against the staging/production setup-node steps. Exit14 remains a scanner failure;
no suppression or green whole-workflow gate is claimed.

The exact pinned setup-nodev4 action supports opt-in `cache` only. Its reviewed
source reads `core.getInput('cache')` and calls restoreCache only under
`if (cache && isCacheFeatureAvailable())`. Empty cache therefore disables restore.
Its action.yml and source contain no `package-manager-cache` input. In contrast,
zizmor's generic setup-node control applies the default-enabled
`package-manager-cache` model without distinguishing v4; its source comment says
that input was added withv5. This version mismatch explains both remaining
findings. `workflow-cache-model-review.json` records official URLs, SHA256 hashes
and bounded source-line evidence. Adding an unsupported v5 input to v4 would not
change actual execution, so the workflow does not use it.

Raw targeted scanner reports stay private with hashes/modes in the bounded
`.artifacts/backend-program-20261011/b08-local-workflow-agent/receipt.json`.
The initial command incorrectly used `--strict`; it failed before scanning and
its raw log is retained separately. The corrected `--strict-collection` command
is the only scanner-result receipt. Gzip or hashing is not redaction; raw reports
are not export candidates.

## Wrangler import-output compatibility

The installed4.149.0 bundle reorganizes handler and renderer declarations, so an
existing test that sliced3.114.17 vendor internals failed before exercising the
parser. Its fixture now extracts and executes the actual installed handler,
executeSql/import state machine and non-TTY renderer in an isolated VM. Provider,
auth/config, signed-upload and filesystem boundaries are stubbed. No live Wrangler
command or provider request executes.

All27 existing assertion/rejection lines are preserved except the exact owner
version. The strict production parser file is byte-identical; both legacy frame
acceptance and adversarial rejection remain. Actual vendor upload/cached/query
control paths pass all106 existing tests. Evidence and vendor/source hashes are
in `wrangler-import-fixture-delta.json` and the unique command receipt
`.artifacts/backend-b08-local-remediation/b08-wrangler-import-output-focused.json`.
Hosted execution, actual remote response/CLI contracts and release promotion
remain separate unperformed gates.
