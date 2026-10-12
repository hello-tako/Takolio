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
