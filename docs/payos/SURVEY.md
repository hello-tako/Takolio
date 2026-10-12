# Tako-san payOS integration survey - 2026-10-12

## Verified source and isolation

Repository `hello-tako/Tako-san`, immutable GitHub ID 1385308553. Independent
checkout/branch `codex/payos-integration-20261012`, based on reviewed merge
`d63321af13d81a20a3f19f12969030fe353376b9` (PR 69). Other worktrees contain
separate release work and were not edited. The owner explicitly authorizes
payOS, superseding the repository's recipe-task restriction for this task only.

## Project surfaces inspected

React/Vite/Tailwind PWA under `src/web`; Hono API under `src/worker`;
shared contracts under `src/shared`; domain, recipes, AI and DB packages;
D1 migrations, environment bindings, CI and protected release workflows.
Authentication uses server sessions, tenant/owner guards and strict OTP handling.
Inventory, cooking, meal plans, shopping and recipes use independent domain
commands. Scans use R2/KV/queues and governed AI providers. These surfaces retain
their existing behavior; the integration needs only billing/provider/configuration
and tests, not a broad application rewrite.

Billing already has server-owned plan pricing and intent expiry, signed provider
requests/responses, owned payment status, transactional pending-only grants,
replay/reference protection and a UI that verifies fresh server entitlement.
Migration 0018 holds payment intents; 0041 introduces checkout admission, currently
default OFF. The payOS work adds no schema or dependency change and leaves checkout
admission, applied migrations and unrelated release controls unchanged.

## Missing operational connection and delivered code

Before setup both live webhooks return 503 and neither Worker has payOS secrets.
Two dedicated channels were created under the owner's explicit approval; keys
were captured into private files outside the repo. Cloudflare OAuth now grants
only user/account reads and Worker script management, with background refresh.

The webhook now accepts only the signed unmapped payOS registration fixture,
without writing or granting. New checkout is independently default OFF until an
operator enables it. Bounded inbound/outbound payloads and an origin-pinned,
dry-run-default registration CLI make setup reproducible. See ADR-PAYOS-001 and
RUNBOOK for sequencing, outstanding-order handling and pre-flag rollback limits.

## Local validation

Full Vitest: 331 files / 7,719 tests PASS, 468.18 seconds (Node 25; experimental
Web Storage disabled; canonical TMPDIR /private/tmp; two workers). Focused payment
checks: 120 tests PASS across three files. Operator CLI: five tests PASS.
Lint, both TypeScript projects, 41-migration replay and dependency audit PASS
(no high vulnerabilities; audit reported none). Paired planner/T20 production
build PASS after tests finished; git diff whitespace check PASS.

Retained initial failures: broad ACK broke six legacy unknown-order assertions
before narrowing to the documented sample; TextDecoder typings required explicit
ignoreBOM; a build concurrent with build-running tests collided on the service
worker output and passed when rerun sequentially. No failure is a live receipt.

## Deployment state at this checkpoint

Staging migration run 38234283593 and deploy 38234498171 succeeded on d63321af.
Staging Worker version 87013b0a-9a6a-42b0-bf11-3b96e7ed032f serves 100% traffic.
Production still version 820c79ef-2db1-4016-95e8-afad9d61958f on the prior release.
Production migration run 38235082984 is awaiting Environment review by
vn-taphoanhatung; hello-tako cannot approve. payOS secrets are not uploaded,
webhooks are not yet confirmed and no integration deployment/activation is claimed.

## Remaining acceptance

Protected PR/exact-main CI and staging/production deployment, secret upload,
provider confirmation, no-transfer live protocol checks and explicit flag activation.
Real paid settlement/entitlement, late payment/refund policy and retention/support
ownership remain distinct from configuration verification. No bank transfer,
payout, refund or fake entitlement has been executed.

## Live protocol follow-up

A real staging create response exposed an existing digits-only account validation
bug: the signed payOS bank account instruction is alphanumeric (virtual account).
Signature, amount, order identity and expiry were valid. The adapter now accepts
only ASCII letters/digits, 1-32 characters; path separators, query delimiters,
spaces and excessive length remain rejected. Requests reject redirects.
Six regression checks cover virtual QR construction, unsafe paths and processing
outstanding payments after checkout is disabled. Focused four files / 131 tests,
lint, both TS projects and sequential paired-T20 build PASS after this fix.

No-transfer staging protocol smoke PASS: order 11877934005, 49,000 VND,
signed instructions/read verified, provider status CANCELLED, amountPaid 0.
Diagnostic orders 12048240166 and 9581158296 were cancelled after the initial
schema rejection; diagnostic order 9502914089 also cancelled with amountPaid 0.
One transport attempt (9139948807) had no confirmed provider response; subsequent
provider lookup returns code 101 (order not found). No app intent or entitlement
was created by these protocol tests; no money was transferred. Their private
receipts exclude bank identifiers and key values. Final hosted CI still required.

## Deployment and edge-runtime follow-up

PR70 merged as 4fb7c40d01769f0d8d8d043fac0c799b435b3e3e after the
concurrent production release38236084633 completed. Final hosted PR CI38236830274
passed331files/7725tests; merge CI38237818252 passed. Staging38238816115 and
production38239310493 deployments passed; production reviewer vn-taphoanhatung
approved the protected Environment. Both channel credentials were uploaded to
the matching Workers with checkout initially OFF; both exact webhook URLs were
provider-confirmed. Signed probe200/invalid401/malformed400/oversized413/guest401
checks passed. Catalog D1/canary0/paired plannerT20true stayed intact.

Authenticated production issuance then returned502. Actual workerd reproduced
an unsupported redirect:error TypeError before any outbound provider request.
Node-only adapter tests had passed and therefore did not cover this runtime
boundary. The smallest correction is redirect:manual, retaining non-2xx
rejection before body parsing; credentials are never forwarded to a redirect.
Both checkout flags were setfalse pending replacement releases. Checksum-backed
callbacks remain available; no direct subscription or payment state repair ran.

Seven regressions under actual workerd and deployed compatibility2024-11-01
fail before the fix and pass afterward. They cover successful signed issuance,
redirect301/302/303/307/308 without a second request, and signature rejection.
Focused fivefiles/138tests passed. The corrected local Worker created and cancelled
provider-only production order32260934446999 with signed response/PENDING/read
and amountPaid0; no app intent, transfer or entitlement. An earlier large-order
Node diagnostic170712966684685 also passed/cancelled/0 and rules out order-code
size as the cause. The first corrected local diagnostic failed during its own
cancel call because that scratch call still used redirect:error; it was repaired,
then the untouched cancellation diagnostic was repeated successfully.

Final local/hosted CI and replacement staging/production deployment remain
required at this checkpoint. The production end-to-end QR and paid Plus checks
are not yet certified. Historical deployment states above are superseded here.

The first corrected scratch run created order7816263117534 before its cancel
call failed. The operator matched its exact channel/order/timestamp on the payOS
dashboard, verified signed provider read49000/PENDING/amountPaid0, then cancelled
it and verified CANCELLED/0. No diagnostic order remains knowingly payable.
