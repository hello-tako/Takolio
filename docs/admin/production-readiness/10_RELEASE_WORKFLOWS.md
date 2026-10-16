# Release workflows

Runtime source: `066c35ad670bc877756150c2055e3844dd7a17ce`. Main baseline: `526596a8cd857984ad2b69901a8c7b0e9d6bccc2`.
Prepared by implementation owner `/root` (Codex); independent reviewer is
`/root/independent_admin_review`. Evidence environment: local macOS arm64,
Node 24.19.0, pnpm 10.33.2, Python 3.12.14, `TMPDIR=/private/tmp`.
Evidence timestamps are UTC. Commands, exit codes, log digests and limitations
are in `evidence/verification.json` and `12_REGRESSION_RESULTS.md`.
No live Cloudflare operation or operator approval is implied.

`.github/workflows/admin-ci.yml` prepares full regression, lint/types/build,
customer+Admin migration smoke, actual local workerd, migration matrix, Admin
browser E2E, ten keyboard repetitions, tracked screenshot integrity, public
change scan and configuration/source manifest validation. External actions are
pinned by immutable digest and token permission is contents:read. CI checks the
checked-out GitHub SHA; hosted execution on this candidate is unavailable.

Four separately named manual workflows are deliberately offline plans:
admin-staging-deploy.yml, admin-production-deploy.yml, admin-d1-migrate.yml and
admin-breakglass.yml. They require an exact source SHA, perform offline preflight
and builds/dry-run packaging, and have no Cloudflare credentials or remote
execution adapter. They cannot deploy, migrate or recover a live service. An
offline plan artifact is not a production release pipeline certification.

`admin-release-preflight.mjs` rejects source mismatch and unsafe bindings,
validates disabled production template/local-auth exclusion, checks protected
customer paths and emits exact source/migration SHA256 manifests. For nonvalidate
operations it requires a clean checkout. Its result always declares
`readyForDeployment=false` and `remoteExecuted=false`.

## Live adapter acceptance before activation

The missing adapters are a technical blocker, independent of operator permission.
A new reviewed change must implement and test: reviewed/protected source ancestry;
successful required checks on the exact deployment SHA; explicit operator
identity/dispatch; protected environment with self-review prevention; exact
Worker/account/environment and dedicated DB identity allowlists; migration hash
and current ledger verification; pre-deploy audit; flag-off health/asset/auth
smoke; separately authorized enablement; release version receipt; post-enable
smoke; reversible compatible Worker switch and fast fail-closed disablement.
No workflow input may be used as arbitrary SQL or an unchecked shell fragment.
Bootstrap/recovery must carry two independent approvals and current roster/key
validation in addition to the environment gate.

Observed protection gaps at initial source verification: main requires validate
but zero approving reviews; production environment has self-review allowed and
no branch restriction; staging has no protection rules. Current settings cannot
be refreshed because GitHub returns HTTP 403/account suspended. The owner must
resolve and reverify them; no policy was changed here.

Customer deployment workflows are unchanged. No Admin migration is inserted into
the customer release path. Do not merge PR #77 or #82 based on local checks or
an offline plan.
