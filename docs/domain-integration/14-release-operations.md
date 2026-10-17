# Release operations - 2026-10-17

## Access provisioned

Canonical GitHub repository: `hello-tako/Takolio`, ID `1422954151`.
The owner authorized production release, Cloudflare credential creation and saving
both reviewed 30-day tokens in the corresponding GitHub Environments.

| Environment | Cloudflare token | Expiry | GitHub destination |
| --- | --- | --- | --- |
| production | `takolio-github-production-20261017-r2` | 2026-11-16 | production / `CLOUDFLARE_API_TOKEN` |
| staging | `takolio-github-staging-20261017` | 2026-11-16 | staging / `CLOUDFLARE_API_TOKEN` |

Each token limits Workers editing to its named Worker (`frigo` or `frigo-staging`).
Account permissions: D1 Read, Queues Write, KV Read, R2 Read, Account Settings Read.
Zone permissions apply only to `takolio.app`: Workers Routes Write, DNS Read,
Zone Read, Zone Settings Read, SSL and Certificates Read. No Global API Key is
used. The first production token was revoked and replaced after its one-time
value appeared in a tool result; it was never installed in GitHub or used for
resource mutations. Replacement values were handled without emitting them.
Temporary files containing those values have been emptied.

GitHub account-ID secrets are present in both Environments. Deployment credentials
have not yet been proven against the full release path; do not claim that saving
a secret proves every API scope is sufficient.

## Release verification keys

Separate random `RELEASE_VERIFY_TOKEN` values were synchronized into each Worker
and its matching GitHub Environment (`RELEASE_VERIFY_TOKEN` for production and
`STAGING_RELEASE_VERIFY_TOKEN` for staging). No key value is retained here.
Secret rotation deployed new Worker versions containing the same code, bindings,
public variables, runtime settings and assets as their previous versions.
Authenticated recipe-authority checks returned HTTP 200 with the unchanged
source SHA and correct environment in both cases.

| Environment | Current deployment | Current version | Unchanged source SHA |
| --- | --- | --- | --- |
| production | `0ce984e1-0c1a-4221-a271-ff252a279ae1` | `01b81140-3162-47e0-8573-88b679877f8a` | `526596a8cd857984ad2b69901a8c7b0e9d6bccc2` |
| staging | `8724644f-b993-4615-a714-e6beb226a493` | `b4257b5c-dddf-4093-b969-f5bc09888bf6` | `f7386e6a8d9ef8955cc314daebf4d1aeecf4e5a1` |

No JWT, OTP hash, PayOS or email-provider credential was changed. No new-domain
code deployment, domain attachment, DNS change, schema migration or data mutation
has occurred. Admin remains disabled and undeployed.

## Governance and checks

PR #2 merged normally as `304349ea09d542881eb09033327fdd0ff8c2d272`.
PR #3 integrated that main in `6ca4d6e5`. Its earlier approval at `352a4211` was
automatically dismissed by GitHub. A fresh independent approval of the final
PR head is required. Main still enforces `validate`, `validate-admin`, strict
status checks, one fresh reviewer, last-push approval and admin enforcement.
Production Environment still requires `vn-taphoanhatung`, prevents self-review
and does not allow admin bypass.

Hosted run 39019506319 finished with 8,794 passed / 1 failed; the failure was the
Admin test comparing intentional reviewed domain changes with the new main.
The guard now recognizes only the immutable reviewed domain baseline when the
parallel Admin history changed none of its guarded customer files. It still
compares the current files byte-for-byte and rejects unreviewed edits.
Admin CI's public-scan failure was corrected by redacting a sender address from
two new domain documents. No authentication or runtime check was relaxed.

The generated production candidate explicitly keeps workers.dev and preview URLs
OFF. Staging keeps its existing ON state. These are candidates, not deployments;
full operational audit remains mandatory.

## Current read-only audit

The old Staging D1 Runtime Readiness workflow failed at its former repository-ID
guard in run 39020335055, before accessing Cloudflare. Its identity is now updated
to the canonical repository, but its historical 0039-only schema contract remains
unchanged. It cannot certify today's later schema and must not be used for that.
Historical migration/authority approval artifacts remain bound to their original
repository and are not automatically reauthorized by migration.

The new manual `Domain Infrastructure Audit` workflow instead compares the live
ledger with the complete migration manifest of current main. It requires canonical
repository ID/name, dispatched current main, successful exact-SHA hosted CI,
Environment-scoped credentials and a final live-main recheck. It reads runtime
version/bindings, workers.dev/preview settings, schedules, observability, zone,
custom domains, DNS, routes, queue consumers and only the fixed SELECT of migration
names. It refuses incomplete paginated inventory and unexpected secret values.
It uploads sanitized evidence and never deploys, changes DNS, applies migrations
or grants access. Production Environment approval still applies to this workflow.

## Remaining release work

1. Pass exact-final-head CI and obtain fresh independent PR #3 approval.
2. Merge through normal protection and pass exact-main CI. Run the new audit in
   staging; production audit requires the configured Environment reviewer.
3. Resolve audit findings before implementing the actual deployment activation
   path. The default Deploy workflow still uses legacy Wrangler configs and must
   not be dispatched as if it consumed the generated domain candidate.
4. Verify staging data sensitivity/Access, Google authorized origins, approved OTP
   delivery and separate sandbox PayOS flows. The owner supplied an approved test
   inbox privately and confirmed sandbox separation; real delivery/provider
   acceptance remains pending. No real payment is authorized.
5. Review the final activation/rollback delta, accept live staging, then use the
   required production Environment approval, deploy and observe for at least
   15 minutes. Retain legacy host availability and keep Admin reserved.

Current status remains `DOMAIN_IMPLEMENTED_LOCAL_VERIFIED`; new-domain live
staging acceptance and production cutover have not occurred.

## Local validation of this release checkpoint

The canonical macOS `TMPDIR=/private/tmp` full run completed with 388 files and
8,804 tests passing (188.69 seconds). The default macOS temp alias exposed 11
existing `/var` versus `/private/var` fixture failures in two unrelated production
capture suites; no test assertion was relaxed. Audit source fixes overlapped the
full run, so the final focused run separately proves all 44 tests across cloud
audit, candidate config, historical staging readiness and the Admin byte guard.
Final lint and both TypeScript checks passed; lint reports two warnings only in
ignored generated bundles. Migration smoke and the application/Worker build
passed earlier in this checkpoint. The public-change scan and diff whitespace
check pass. Independent read-only review found one queue-consumer identity issue;
it was fixed with realistic script/service response coverage and re-reviewed PASS.
Exact final-commit hosted CI and the fresh human approval are still required.

## Required Admin CI follow-up

At `09d425a1`, CI run 39021612765 passed. Admin CI run 39021612780 passed lint,
types, the full suite, migration smoke and build, then failed its preflight's
fixed pre-domain customer comparison. The exact-head human approval was present.
This follow-up changes the preflight to accept only immutable reviewed domain
baseline `352a4211` with HEAD ancestry and protected parallel-main byte checks;
working/committed edits still fail. The subsequent migration matrix retains the
original 43-file contract and permits descendant main history only if migration
and schema-gate bytes remain unchanged. No branch-name exemption is used.

Focused baseline/config tests pass 16/16, including rejection of unreviewed edits,
parallel-main changes and missing history. Actual local preflight and D1 matrix
23/23 pass; targeted lint, both typechecks, public scan and whitespace check pass.
The local matrix receipt honestly records its dirty scoped source. A new commit
needs new hosted CI and fresh human approval through the existing protection.

Google Cloud's Frigo client details now load in the authenticated browser. Its
current JavaScript origins are localhost and the legacy production host only.
Takolio origins and staging OAuth acceptance remain pending; no client secret was
revealed and no OAuth configuration was saved during this inspection.
The real local multi-Worker boundary check also passes 10/10 scenarios, including
synthetic browser requests and the production-bundle local-auth exclusion.
