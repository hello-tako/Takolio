# Initial Admin install containment and restoration

Status: `INITIAL_INSTALL_PARTIAL_RESTORATION_REVIEW_REQUIRED`.

## Observed release and failure

PR #19 was independently approved at 08f21068 and merged normally as
5c44cc5d199113c1346a80509ae5920c06420b73. Exact-main CI 39237659372 and Admin CI
39237659377 succeeded. Fresh protected credential audits 39238475637 (staging)
and 39238479727 (production) observed all seven metadata sections and matched
the policy. Their archive digests were checked; neither audit performed writes.

Protected staging initialize-disabled run 39240631059 had a verified offline
plan, an owner signature and independent Environment approval. Authorization
passed and the immutable pre-action artifact was uploaded before the Cloudflare
credential became available. Execution then failed with `fetch failed` at
2026-10-19T10:56:04Z. Its receipt correctly remains FAIL /
UNKNOWN_REQUIRES_OPERATOR_INSPECTION; do not reinterpret it as a successful run.

- Plan artifact 12181476149: SHA-256
  3494f8e38c3c111d57c208d0c7ec0cd3b73eafc7de3a01a65aacae53d36b85f0.
- Pre-action artifact 12181561208: SHA-256
  5feefd6bb8f4859616c6704b555a2f4db1bbc90a3860ec36bb59e35bf99a655b.
- Failure receipt artifact 12181461497: SHA-256
  05dd7ef7ad52b823b60da787defc6ce2f3c1419fd60110e6a77e8154449a98b8.

GET-only inspection run 39241507968 succeeded after independent approval.
Artifact 12181702217 has verified ZIP SHA-256
89d942e2b9ba911d9e74908fa16ecb32484efcf4d32b4181d4e735bd59048ca3.
At 2026-10-19T11:05:07Z it observed the dedicated staging Admin/facade and
hostname, all with the expected target/source. Admin enabled=false and its
exported bindings contain no data/service binding; its normal schema metadata
is absent. This is consistent with the compensating shutdown upload. The old
audit did not export ADMIN_SHUTDOWN or asset bindings, so the exact containment
marker must still be checked before restoration. This change adds that safe
marker to the audit allowlist. Customer Worker sources/bindings matched the
pre-install audit. Production Admin resources remain absent from the inspection.

At 2026-10-19T11:22Z, curl probes of /admin, /admin/login, /api/v1/admin/me and
/admin/favicon.svg each returned 302 to the exact configured Access tenant login.
Customer /api/v1/health returned status=ok. These limited anonymous probes do not
certify the complete live ST01-ST20 matrix. An earlier Python probe followed the
Access redirect and received 403; that final response is not anonymous edge
redirect evidence and has been superseded by explicit no-follow curl probes.

The original runner log has no error cause/phase. The exact failed transport
(API versus public-host smoke, DNS versus connection) is not proven. Two Worker
uploads and the observed contained state narrow the failure to subsequent
verification/compensation. No migration, HMAC, owner enrollment, bootstrap,
console enablement or production Admin release was dispatched in this attempt.

## Guarded first-install restoration

Existing initialize-disabled still requires absent Workers/DNS/hostname.
Existing rollback-disabled still requires a complete compatible schema and
identity. Neither guard is weakened to work around the interrupted first install.
The new fixed restore-initial-disabled action accepts only an empty signed
payload through the normal staging/production release workflow. All exact-main
review/check, owner signature, expiry, independent protected Environment and
pre-action artifact checks remain required. Production additionally retains the
completed exact-source staging certificate requirement.

Before either upload, the provider verifies:

1. Dedicated account, zone, Access issuer/audience, custom hostname, D1/KV and
   facade mapping, with no alternate public routes/preview/subdomain exposure.
2. Admin is Access-only, OFF and marked ADMIN_SHUTDOWN=true, with plain-text
   bindings only; facade has only plain-text and its exact customer-read D1 binding.
   Existing HMAC/secret/data/service/asset capabilities on Admin refuse restoration.
3. Contained Admin source is a 40-character SHA in the current reviewed ancestry
   with a successful exact-source main push Admin CI. Facade source is that SHA
   or the current source during the interval between the two guarded uploads.
4. Admin D1 has no user-defined schema objects, including d1_migrations. Only
   exact Cloudflare _cf_METADATA and SQLite sqlite_sequence system tables are
   excluded; application objects with similar prefixes are rejected. This is a
   fixed SELECT of schema metadata against dedicated Admin D1, with no row read
   from customer D1 and no migration/schema/data write.

The final GitHub authorization/expiry check follows those resource checks and
precedes each fixed Wrangler upload. The provider uploads the internal facade
and default-disabled Admin, verifies mapping/source/denial and records versions.
Failure attempts narrow containment and remains FAIL, including if verification
cannot prove its outcome. It never migrates, provisions HMAC, enrolls/bootstraps
an owner or enables the console. An already migrated or previously used Admin
must use the existing reviewed rollback/recovery procedures.

Public-host smoke now retries only GET transport failures with allowlisted
transient DNS/connection codes, at most three attempts with 1s/3s delays. Invalid
HTTP responses, foreign Access redirects and TLS/certificate failures fail
immediately. API writes are never automatically retried. Diagnostics distinguish
GitHub/Cloudflare transport from public smoke and suppress raw provider details.
The retry handling is not evidence that transient DNS caused the original run.

## Verification and next action

- Before the implementation, the new provider regressions failed for missing
  restoration support and missing transient GET handling: 17 FAIL / 81 PASS.
- Focused release adapter/provider/real-CLI/audit/workflow suite: 5 files /
  198 tests PASS, including real in-memory SQLite and a newly occupied DB between
  the two uploads. All provider credentials/identities in tests are synthetic.
- Whole-project lint PASS with two existing generated-bundle warnings; both
  TypeScript checks PASS. Admin build PASS with existing font resolution warnings;
  all three font files are emitted. Public added-text scan and whitespace PASS.
- Dependency audit: 438 dependencies, zero vulnerabilities at every severity.

Next: independent exact-HEAD review, candidate CI, normal merge and exact-main
checks. Run the updated GET-only staging audit, verify the actual shutdown marker,
then dispatch fresh restore-initial-disabled with a new run-bound signature and
Environment approval. Inspect its receipt before migrate -> provision-hmac ->
verified direct-owner Access identity -> enroll-owner -> bootstrap -> disabled
baseline -> enable -> actual ST01-ST20. Keep every incomplete acceptance row
PENDING_EXTERNAL_EVIDENCE. Only a complete exact-source staging certificate can
open the protected production sequence. Do not rerun the failed initialize job.

Supplementary full local run: `pnpm test -- --maxWorkers=2` ran 407 files /
9,093 tests, with 9,081 PASS and 12 FAIL. The extra separator did not supply the
intended Vitest worker limit. Failures were in three existing customer tooling
files: one 5-second Wrangler timeout plus /var versus canonical /private/var
path/mock-executable assertions. Re-run with
`TMPDIR=/private/tmp pnpm exec vitest run tests/unit/staging-d1-catchup-check.test.mjs tests/unit/t21rc2-production-capture.test.mjs tests/unit/t21rc2t-production-capture.test.mjs --maxWorkers=2`
passed all 3 files / 125 tests. No customer tooling source/test was changed.
The initial full-run failure is retained; exact-HEAD hosted CI must independently
pass the complete suite on Linux before merge. All current Admin release tests
passed in that full run as well as the dedicated 198-test suite.
