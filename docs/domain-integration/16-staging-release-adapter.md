# Staging domain release adapter

## Current verified state

PR #4 merged normally as `6fc3f3ffa4d5230610acff6e51cf097400652443`.
Exact-main CI `39030256282` and Admin CI `39030256276` both succeeded.
The approved Cloudflare Access Service Auth policy
`fca82fb1-9554-45e5-90c1-3cca94c607f3` is saved alongside the existing approved
email Allow policy on application `bd0bae35-56b4-4766-a3b5-9de378ba93ad`.
Its 30-day credential values are stored only in the staging GitHub Environment.
No value is retained in this source or its receipts.

Read-only audit `39031638646` failed before any mutation with HTTP 403/code
10000 on the account Workers Domains inventory. Cloudflare documents Workers
Scripts Read or Write for that endpoint. The current token's per-Worker Editor
and zone Workers Routes Write scopes do not satisfy that account inventory call.
The owner is being asked to approve the smallest additional legacy read scope;
no token scope has been saved while that confirmation is pending.

## Explicit staging lane

`Domain Staging Release` is manual, defaults to no activation and has no
production job. It uses the same `frigo-deploy-staging` concurrency group as
existing deployment/audit jobs. It checks out trusted main, matches it to the
requested SHA and dispatched workflow before dependency installation, and requires
both exact-main push CI workflows, canonical repository ID/name, the approved
hardening ancestor and staging Environment credentials. No existing branch or
Environment protection is modified.

The adapter captures a complete same-SHA live audit and verifies the migration
ledger without applying a migration. It derives paired planner/composition and
recipe authority settings from the current Worker, rejecting disagreement rather
than accepting a flag or authority change. Existing storage bindings, secrets,
queue/DLQ, schedules, observability and subdomain exposure are retained. Only
APP_URL, domain routing, source SHA, run-worker-first and the already approved
public staging Google client ID change. Email provider configuration is not
created by this adapter; real OTP delivery remains a separate acceptance gate.

The build is checked against the paired composition flags. Wrangler 4.149.0
`versions upload --strict` uploads assets/code without activating traffic or
reconciling custom domains, schedules, queue consumers, observability or
subdomains. The uploaded version's public variables, complete typed bindings,
secret names and asset/runtime settings are compared with the candidate before
a 100-percent staging deployment is requested. A fresh audit must remain equal
immediately before upload and traffic activation. Unknown drift stops execution.

The original Access-protected Worker URL must prove readiness SHA, service worker
SHA/cache policy through both fetch and native curl profiles, and recipe authority
before new hostnames can be attached. Each hostname uses the existing individually
owned operation primitive and durable intent/returned-ID receipts. Wrangler's bulk
`replace_state` domain publisher is never called. The adapter then checks new app
SHA/assets/authority, API JSON, API rejection of SPA routes, credentialed CORS and
preserved operational settings.

## Credential and recovery boundary

Access credentials are restricted to the three explicitly approved staging
origins, never followed across redirects, and sent to native curl through stdin.
The staging transport permits only read-only requests and suppresses raw process
errors. Receipts contain public runtime metadata and secret names, never values.

A failed operation attempts recovery from the recorded uploaded version and
attachment IDs. The workflow has a separate recovery step after failure or
cancellation. Newly owned attachments must be removed in reverse order before
restoring the original Worker. Recovery refuses uncertain ownership, ambiguous
attachment outcomes, changed traffic or operational settings, and receipts from
another source/environment. An uncertain activation is never treated as proof
that nothing happened. Such outcomes require operator reconciliation of the
retained receipt; mutations are not blindly retried.

Recovery verifies previous version, variables, bindings, operational settings,
zone records and recipe-authority fields. The lane makes no database, payment,
provider URL, production hostname or Admin deployment mutation. GitHub runner loss
can prevent any automatic recovery; retain the workflow receipt and Cloudflare
audit trail for that operational case.

Infrastructure proof is explicitly not full staging acceptance. Real browser
Google sign-in, approved-inbox OTP, PayOS sandbox, session lifecycle, user journeys,
mobile/PWA behavior and live rollback rehearsal remain required. Production still
requires a separately reviewed adapter, accepted staging and independent
production Environment approval.

## Validation

- Focused config/Access/hostname/adapter tests: 26/26 PASS.
- Final focused release/domain regression: 9 files / 348 tests PASS.
- Syntax, targeted ESLint, both TypeScript checks, Admin preflight, migration smoke, public scan and whitespace checks PASS.
- Full `TMPDIR=/private/tmp pnpm check`: 8,836 PASS / 2 timeout failures; no
  combined PASS is claimed. The two affected pre-existing suites pass 74/74
  with `--maxWorkers=1`, retaining their assertions and timeout settings.
- Build and migration smoke pass separately. Exact-final-head hosted checks and
  independent review remain mandatory before this lane may run.

No Worker application upload, traffic activation, hostname attachment, DNS,
database, payment or Admin mutation has been performed with this adapter.
Status remains `DOMAIN_IMPLEMENTATION_IN_PROGRESS`.
