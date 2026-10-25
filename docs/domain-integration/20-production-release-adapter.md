## Owner-authorized PayOS test waiver; protected release continuation - 2026-10-26 JST

Status: `OWNER_WAIVER_IMPLEMENTED_REVIEW_PENDING`. The owner explicitly waived repeating PayOS settlement/callback testing because existing production PayOS works, and authorized completing the remaining work and production deployment. This supersedes the earlier production hold below. PayOS is `OWNER_WAIVED`, never PASS; the expired unpaid test order proves no settlement/callback/Plus grant. Payment implementation remains unchanged.

The release adapter now accepts only the `payos-sandbox` row with result `OWNER_WAIVED`, reason `existing-production-payos-owner-accepted`, canonical repository evidence, and a separate boolean owner-waiver confirmation. It preserves the actual result in receipts. Every other acceptance row still requires PASS. Existing exact-source CI, staging, fresh production certification, independent Environment review, compatible recovery, and 15-minute observation gates remain mandatory. No security protection or payment/auth/application/migration/asset/dependency file changed.

Executed: `PATH=/opt/homebrew/opt/node@24/bin:$PATH TMPDIR=/private/tmp pnpm test tests/unit/domain-production-release.test.mjs tests/unit/domain-production-build.test.mjs tests/unit/production-certify-workflow.test.mjs` PASS (3 files / 74 tests); `pnpm lint` PASS; fresh `pnpm typecheck` PASS. Waiver regressions reject missing/false/string authorization, wrong reason, NOT_RUN, external/query-string evidence, and waiving any other check. Hosted exact-head checks and live deployment are still pending; no production mutation occurred at this checkpoint.

Next: normal protected PR/reviewer approval and exact-head CI/Admin CI, normal merge and exact-main checks; new same-SHA staging certification/release and bounded browser refresh, truthful canonical acceptance with OWNER_WAIVED; protected production ledger/bookmark/migration, fresh certification, Environment approval and monitored release. Original Argon workspace and verified private recovery remain preserved. Historical checkpoints retain their original observation-time claims.

# Current operational checkpoint - 2026-10-18

The adapter is merged and staging is accepted on d5f2e726. Production attempt
39101591421 was independently approved, then failed safely at prepared because
its composition command incorrectly selected the staging-only config guard.
No upload/traffic/hostname mutation occurred. The correction and real reproduction
are documented in 24-production-build-guard.md. Production remains unchanged;
new exact-head CI/review and new-SHA staging/certification evidence are required.
Historical implementation notes follow and do not override this checkpoint.

---

# Protected production domain adapter

This adapter is prepared for independent review. It has not run, and no production
application, traffic, hostname, provider, database or Admin mutation has occurred.
Staging acceptance is still pending. Do not dispatch it with invented PASS fields.

## Required source and evidence

`Domain Production Release` is manual and all confirmation inputs default false.
It uses the existing protected production Environment and production deployment
concurrency group. Trusted main must equal the dispatched workflow SHA and full
requested SHA before dependency installation. The provider rechecks canonical
repository ID 1422954151, current main, approved hardening ancestry, successful
latest exact-main CI and Admin CI, account identity and release credentials before
upload, activation and subsequent source/traffic fences. No protection is changed.

The adapter downloads evidence only after verifying successful canonical
workflow_dispatch runs on the exact SHA/main and their current attempt. It
requires a unique non-expired named artifact; incomplete artifact inventories
fail closed. Two independent evidence sources are mandatory:

- `Domain Staging Release`: infrastructure-verified receipt, attached staging
  hosts, exact readiness/assets SHA and valid API/CORS/HTTPS proof.
- `Production Read-Only Certification`: PASS no more than 45 minutes old, no
  production mutations, verified existing Worker identity, full catalog/runtime
  certification and successful foreign-key/quick checks. Production must still
  have the certified version and deployed source.

Real staging acceptance is a separate public operator attestation, at most 24
hours old, bound to the same SHA, staging run and uploaded version. It contains
exactly the required check names: dns-tls, access, google-login, otp-delivery,
session-lifecycle, payos-sandbox, user-journeys, mobile-pwa and rollback-rehearsal.
Every check requires PASS and a canonical repository Actions/artifact or PR
comment evidence URL, except an explicitly owner-waived `payos-sandbox` check.
That exception requires `OWNER_WAIVED`, fixed reason
`existing-production-payos-owner-accepted`, canonical evidence, and the separate
`confirm_payos_owner_waiver=true` input. The receipt retains OWNER_WAIVED; it is
never converted to PASS. No other check can be waived. Query strings and external
evidence destinations are rejected.
Only these public fields are retained; arbitrary supplied fields are discarded.

The adapter does not perform these browser/provider checks or infer their truth
from a confirmation checkbox. The operator must execute them and publish sanitized
evidence first. The independent production Environment reviewer must inspect the
attestation and its evidence before approval. Missing/failed checks must remain
pending; no acceptance attestation has been issued for this task yet.

## Activation and recovery

A fresh same-SHA live audit verifies the exact existing bindings, secrets by name,
all migrations without applying any, Queue/DLQ, cron, observability, exposure and
runtime settings. Candidate preparation preserves flags, recipe authority,
storage, email and payment configuration. Only domain routing, APP_URL, source
SHA and worker-first assets change. Complete D1 authority additionally requires
the existing source/dependency/catalog continuity proof.

Build flags and generated assets are checked together. Strict version upload
happens before traffic and does not publish custom domains or operational
settings. Complete uploaded bindings, secret names, variables and runtime/assets
must match the audited candidate before activation. Drift stops execution.

The existing legacy production hostname proves readiness, service-worker content
through fetch and ordinary/revalidated native curl profiles, and recipe authority
before the three production hosts are attached individually. The retained intent
and returned-ID receipts own only newly created attachments. Bulk replace_state,
DNS mutation, schema/data migrations, provider callback changes and Admin exposure
are outside the adapter.

Apex/API/WWW HTTPS, API JSON, rejected API SPA routes, credentialed CORS and WWW
path/query preservation are checked. The adapter then probes source/assets,
recipe authority, live traffic and operational invariants repeatedly for at least
15 real minutes, persisting intermediate observations. Its terminal state is
`infrastructure-observed`; production browser/provider acceptance and error-window
inspection remain separate evidence before DOMAIN_PRODUCTION_VERIFIED.

Failed activation/proofs/observation trigger paired recovery. Only newly owned
hostnames are detached, in reverse order, before restoring the original version.
A separate workflow recovery step covers failure/cancellation. Changed traffic,
uncertain domain ownership, ambiguous mutation responses or operational drift
stop automatic recovery for receipt reconciliation. No uncertain mutation is
blindly retried. Restored version, bindings, variables, operations, zone inventory
and legacy recipe authority must match the original snapshot.

## Validation checkpoint

The initial ten production-specific tests pass, including negative provenance,
acceptance, certification, mutation/recovery targets, failed proof recovery and a
clock-controlled fifteen-minute observation test. They make no remote mutation.
Full regression, lint, types, migrations, build, independent review and exact-head
hosted checks remain required before merge. Live activation is NOT RUN.

## First live staging attempt and privacy follow-up

PR #8 merged normally as 0a9f63ca5e92eab649e4745961a6fcc7bb70c225 after both
required checks passed (395 files / 8,885 tests each; Admin also passed its Worker,
migration and browser gates). Both exact-main checks, CI 39045489657 and Admin CI 39045489679, succeeded.

Before that merge, the fresh same-main staging audit 39045069392 passed at
02337f88 with all 43 migrations, active account/zone, original isolated bindings,
paired planner/composition flags ON, D1 authority and empty new-zone DNS/routes.
Staging release 39045380675 stopped at preflight with `Staging Access request
failed`. Its retained receipt records mutationAttempted=false and no traffic or
hostname mutation. No upload or email send occurred. Cloudflare dashboard now
requires login, so the Access credential/policy cause remains unresolved.

The account-wide hostname baseline could otherwise expose unrelated account
hostnames and Worker names in public receipts. Both adapters now replace every
non-target entry with a full-metadata SHA-256 commitment. Recovery privately
matches those commitments against the live account inventory before any mutation;
missing/changed/duplicate metadata stops reconciliation. Intended Takolio targets
and individually owned attachment IDs remain available. The in-memory baseline
is not changed, and the existing email-recipient redaction remains in force.

The staging fetch transport still sends credentials only once to the three
approved origins. It now rejects manual redirect responses with only their HTTP
status; it never follows the destination or logs its URL/body. A regression proves
that a credential placed in an untrusted Location value is not disclosed.

Validation after these changes: 12 related files / 388 tests PASS. Earlier full
production-tooling run passed 8,894 tests but had four timeout failures while
macOS recorded a 901-second clamshell sleep; it is not reported PASS. The four
original assertions/timeouts are unchanged. The final full run failed as documented below. Static/build and final hosted
review gates remain recorded separately; no live production acceptance attestation has been issued.

The final local full-suite attempt did not pass: continued macOS sleep caused six
failures and a worker-pool timeout (8,892 tests passed, incomplete 396-file coverage,
4376.41 seconds). It does not establish complete validation. All 388 focused tests
and static/build gates pass. Publish as a draft and require exact-head hosted
CI/Admin CI on an awake runner, followed by independent review. Do not retry the
old staging publisher before the unrelated-domain privacy fix merges. The Mac
unlock/dashboard login and actual staging acceptance remain pending.
