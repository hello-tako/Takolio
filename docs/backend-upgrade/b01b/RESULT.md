# B01b A1 - Local implementation result

Date: 2026-10-11 JST. Status: `B01b_A1_LOCAL_VERIFIED`.
Repository: vn-tak/Tako-san, ID1385308553.
Branch: codex/backend-b01b-email.
Base: `98471e10d4b874219b069ec8b38a26fdd719db81`. Implementation: `31d5fd860ef9b65fc38ccdc664074bda348b0a8c`.
Main reverified unchanged at `652e0d7632745e9b77cda4b5b3caac83a3ec1015`.

## Change and outcome

Generic native send exceptions previously fell through to Resend and could send
the same OTP again after an ambiguous native acceptance. The adapter now returns
accepted/rejected/delivery_unknown/not_configured plus bounded evidence, while
preserving sent/provider/error compatibility. Only exact structured sender
rejections authorize same-call fallback; recipient suppression/policy and quotas
terminate. Resend has no automatic retries or redirects.

Each provider has an 8000ms dispatch/metadata deadline. HTTP abort is best effort;
late native/HTTP completion cannot change the published result or start fallback.
Native fulfillment and HTTP2xx prove acceptance even when optional metadata is
unavailable. No sending result proves delivered/bounced. Safe bounded opaque IDs
are hashed; raw IDs, bodies, recipients, OTPs and exceptions never enter adapter
logs. At most 4096 metadata bytes are retained/parsed with 64 read calls; this is not
a transport ingress-byte limit.

Owned runtime change is email.ts only. Existing 16 privacy tests were intentionally
updated, 54 lifecycle regressions added, and one typed auth mock gained state/evidence
without changing its assertions. OTP email copy is byte-identical. Auth routes,
frontend, database/migrations, payments, dependencies/config/workflows are unchanged.

## Executed verification

- Focused final: 4 files / 174 tests PASS; email lifecycle 54, privacy 16,
  auth-hardening 92, browser-security 12.
- Fresh complete rerun: 289 files / 6798 tests PASS, exit0.
- Full lint, typecheck, frozen install, local migration smoke and build PASS.
- Frozen 4 source/test hashes, protected diff, prior ADR/packet preservation and
  git diff whitespace checks PASS.
- Fresh audit exit 1 retained: full 2 critical / 16 high / 19 moderate / 4 low;
  production 2 moderate, 0 high/critical. B08 owns exposure triage/remediation.

Exact command receipts, timing/environment, failures and raw gzip digests are in
[validation.json](validation.json) and [LOCAL_VALIDATION.md](LOCAL_VALIDATION.md).
Source review is recorded in [review-record.json](review-record.json); agent review
is not human PR approval. All source hashes remain pinned to the implementation.

## Failures and recovery retained

The new generic-error regression failed against the original adapter as expected:
Resend returned sent=true after the ambiguous native exception. The first typecheck
then found one existing typed mock missing required state/evidence; that mock was
updated and final typecheck passed.

Initial full suite remains `INTERRUPTED_FAILED`, exit 1. Terminal Vitest output:

```text
Test Files  1 failed | 288 passed (289)
Tests  1 failed | 6797 passed (6798)
Errors  1 error
Duration  741.59s (transform 4.98s, setup 1.20s, collect 40.24s, tests 1312.31s, environment 12.37s, prepare 12.05s)
```

An unchanged catalog test blocked in execFileSync Python stdin transfer. Python
sample waited in json.load(sys.stdin)/read; Node waited in SyncProcessRunner/uv.
No SQLite frame was observed. The exact task-owned blocked child was SIGTERM'd to
unblock and retain the failure; one Vitest RPC onTaskUpdate timeout was also emitted.
An equivalent 1,267,196-byte transfer completed 115ms independently, so the precise
macOS/libuv cause is unproven. This is a harness residual, not an email diagnosis.

Unchanged catalog-only recovery passed 1 file / 163 tests in 50.99s. Then a fresh complete
suite passed separately with the same frozen source and two workers:

```text
Test Files  289 passed (289)
Tests  6798 passed (6798)
Duration  380.97s (transform 4.83s, setup 1.29s, collect 38.32s, tests 649.15s, environment 9.98s, prepare 11.80s)
```

No timeout/assertion/source waiver. The actual public-registry Wrangler 4.149.0
update cache in a task-owned canonical TMPDIR bypasses only the ancillary updater;
installed dependencies are unchanged. Cache origin/time/hash are in validation.
B08 also owns a bounded permanent subprocess harness and ancillary-network isolation.

## Integration limits and next checkpoint

A1 prevents duplicate fallback within one adapter invocation. Legacy auth still
uses sent=false to invalidate a production challenge and resend still clears KV
cooldown on failure. Thus end-to-end duplicate/resend safety remains pending B01a.
No real mail, inbox/bounce event, provider certification, paid AI, remote D1/R2,
push/PR/merge/deploy or production release was performed.

Next is the reviewed B01a ADR, additive schema/typed repository and dormant
coordinator with real comparison-boundary/concurrency/rollback tests, before all
issuance/verify/reset/client integrations. See
[B01a pre-implementation review](B01a_PREIMPLEMENTATION_REVIEW.md).
Unknown recovery, all-state forgot parity, proof expiry replay and durable abuse
history need explicit first-ADR decisions. Inbox runbook remains PREPARED_ONLY.
SQLite local tests cannot certify hosted D1 atomicity or production delivery.

Rollback must retain conservative ambiguity handling; restoring unconditional
native fallback is unsafe. No durable schema/data change exists in A1.
