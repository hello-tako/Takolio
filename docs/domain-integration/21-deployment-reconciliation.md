# Deployment acknowledgement and recovery reconciliation

## Observed staging outcome

PR #10 merged normally as b773431cad032e9bcf385a6abad780e7659aa8c2 after
independent approval of a18f2b2b. Approved-head and exact-main CI/Admin CI passed
398 files / 8,910 tests each; Admin also passed its Worker/migration boundaries,
12 browser cases and ten keyboard runs. Main runs: 39079573250 and 39079573261.
Read-only staging audit 39081283100 passed before the next release.

Staging release 39081376589 uploaded f69f62e9-3fc2-464a-b287-e3a9bad7b1c6,
then activated deployment 3b69330a-62b1-4b00-b177-adc0f30ff706. Its direct POST
response failed the full stable-deployment parser. Recovery activated the original
version in deployment ce74eb29-95d3-4b42-8200-604fde7b6f27, but failed the same
response parser. The raw POST payloads were not retained, so the exact missing or
incompatible response fields cannot be established from that run. Do not describe
an ID-only response as an observed payload; it is a deliberately supported
acknowledgement shape, independently checked through live reads.

The separate recovery step found the original version, then falsely rejected
operational equality. Queue capture explicitly added undefined optional service/
environment fields. JSON serialization omitted them; a fresh in-memory capture
retained them, so strict equality failed despite identical provider metadata.
Two focused regressions reproduced this failure before the fix.

Read-only deployment history and version reads, authenticated readiness and fresh
audit 39081624560 independently confirm the original version
b4257b5c-dddf-4093-b969-f5bc09888bf6 at 100%, source
f7386e6a8d9ef8955cc314daebf4d1aeecf4e5a1, healthy database, unchanged operational
settings and all 43 migrations. No new Takolio hostname, DNS record or route was
attached. No browser/provider acceptance or production release is asserted.

## Verification change

Both domain providers now require a canonical deployment ID from a successful
mutation response and save it before subsequent reads. Any supplied strategy or
version metadata must remain consistent with the requested single-version 100%
deployment. The response itself is never accepted as traffic proof.

A deployment-specific GET must independently prove that exact ID and target
version at 100%. A separate current-deployment read must prove that the same
mutation still owns live traffic. Missing IDs, contradictory metadata, splits,
unrelated responses, unavailable reads or newer traffic fail without another POST.
The same protocol covers staging/production activation and recovery. Existing
source, metadata, operational, hostname-ownership and Environment gates remain.

Queue capture omits only undefined optional projected fields. Present values,
including service/environment changes, settings and dead-letter identity, remain
subject to strict equality. No comparison ignores or normalizes actual drift.
Receipts from earlier runs can therefore reconcile against fresh captures.

## Release boundary

The fix is not authorized for live execution until independent review, protected
merge and exact-main CI/Admin CI. No retry of the failed activation is allowed
before reconciliation. Production remains unchanged. Live staging Google/OTP/
sessions, PayOS sandbox, user/mobile/PWA journeys and rollback acceptance are still
pending. PayOS checkout is currently disabled in the audited staging variables;
credential presence alone is not sandbox checkout acceptance.

## Executed validation

Final targeted release regression: 15 files / 439 tests PASS. Lint exits zero
with two existing ignored generated-bundle warnings; both TypeScript checks,
customer/Admin migration smoke and Web/Admin/Worker build PASS. Build retains
existing Admin font resolution warnings. Node syntax and whitespace checks PASS.
The initial optional-consumer tests failed twice before the fix as intended.
One negative UUID fixture initially contained only digits, so uppercasing did not
change it; the fixture now includes hexadecimal letters and passes without
weakening the rejection. No local full-suite PASS is claimed for this patch.

The new reconciliation helper also confirmed the original live deployment using
two read-only Cloudflare endpoints without posting another deployment. Independent
hosted PR checks and human review remain required before protected merge.
