# Offline operations and fault evidence

Classification: LOCAL_CANDIDATE. Runtime activation, hosted load/alerts/recovery and
seven-day production SLO acceptance are PENDING_EXTERNAL_EVIDENCE.

## Run a synthetic SLO report

Run `node scripts/offline-slo-report.mjs --input FILE --output FILE` from the
repository root with Node 24. Inputs accept only SYNTHETIC or UNVERIFIED_IMPORT,
a forty-character source SHA, an explicit half-open UTC observation window,
sampling ratio, route-template allowlist, minimum sample count and nullable targets.
Every event has a unique opaque UUID, template, status, duration, timestamp and
internal-error flag. Extra fields, raw routes, duplicate IDs or out-of-window events
are rejected. Do not import cookies, emails, image/OCR contents, account details or
provider output. The input SHA binds a source context; it is not proof that those
synthetic observations came from a deployed version.

The denominator is all supplied completed invocations, including 4xx. 5xx or
internal errors count once against availability; 4xx remain a separate visible
count. Undersampled series have null availability/p95. Sufficient series with no
approved targets are TARGETS_UNSET. TARGET_MET on an imported or synthetic series
never sets productionSloCertified. Missing/incomplete collector traffic must be
accounted for separately before a real certificate; this reporter cannot infer it.
The retained local seven-day synthetic window proves report arithmetic only.

## Local recovery

Run `python3 scripts/offline-d1-recovery.py --output FILE`. It replays all repository
migrations into memory, creates 1,000 synthetic stock rows, clones a SQLite backup,
rolls back an interrupted command, deliberately mutates only synthetic stock, then
restores and compares the stock fingerprint, foreign keys and quick_check. It also
records 100 local query samples and EXPLAIN QUERY PLAN. No Cloudflare Time Travel,
production bookmark, remote export, edge latency or multi-isolate claim follows.

`tests/integration/checkout-local-d1.test.mjs` separately replays 41 migrations in
actual local workerd D1, creates a local ledger, executes the complete read-only
schema gate and exercises durable ready/uncertain checkout replay and integrity.
No remote database binding is used. Existing migration 0040 is never reapplied to
production in this packet; 0041 remains local and additive.

## Offline fault matrix

| Fault | Executable evidence | Expected boundary |
| --- | --- | --- |
| Email native/API acceptance ambiguity, ignored abort, late response, body loss | tests/unit/email-lifecycle.test.ts; tests/unit/email-privacy.test.ts | No duplicate fallback after ambiguity; deadlines and private logs; no delivery certificate |
| OTP replay, concurrent scope, transaction failure, cooldown/lockout | tests/integration/auth-otp-coordinator.test.ts; tests/integration/auth-hardening.test.ts | Existing strict OTP admission/grant invariants retained |
| Turnstile callback rerender, unmount, site-key replacement, SDK timeout | tests/unit/turnstile-lifecycle.test.tsx; tests/unit/turnstile-loader.test.tsx | Latest active consumer only; no old generation publication |
| Checkout concurrent retry, crash, provider/DB response loss, expired identity, hung/late provider, invalid QR, paid race | tests/integration/checkout-admission.test.ts; tests/integration/checkout-local-d1.test.mjs | One dispatch per owner/key, immutable offer, ready replay or reconciliation; no automatic replacement/grant |
| Checkout client transport retry, plan switch, close/reload, owned resume | tests/unit/payment-checkout.test.tsx; scripts/nine-region-browser-check.mjs | Frozen key/plan after dispatch; reopen without creation; late owner results fenced |
| Scan transient/permanent outage, ignored abort, lease replacement, cancellation | tests/integration/scan-queue-retry-policy.test.ts; tests/integration/scan-queue-fencing.test.ts; tests/integration/scan-cancellation.test.ts | Bounded retry, stale result fencing, no cancelled confirmation/inventory write |
| AI runtime budgets/outcomes | tests/unit/ai-runtime-governance.test.ts; tests/unit/ai-task-provider.test.ts | Mock providers, current authority unchanged; dormant V3/budget candidate does not gain production authority |
| Stock revision/idempotency, whole-week constraints, shopping/cooking loop | tests/integration/inventory-lot-authority.test.ts; tests/integration/backend-whole-week.test.ts; tests/integration/backend-shopping-cooking.test.ts | No negative/foreign stock, sequential projections and existing command authority |
| Local interruption and restore | scripts/offline-d1-recovery.py | Same synthetic stock fingerprint after rollback/restore |
| Scanner engine failure, new/changed context, duplicate/unredacted finding | docs/backend-upgrade/b08/security/runner.py selftest; tests/unit/security-context-gate.test.mjs | Fail closed; raw findings retained, never relabelled as zero |

Exact full-suite result and receipt hashes are recorded in RESULT.md and
validation.json. A test filename is a coverage reference, not proof of real provider,
inbox, hosted queue, payment transfer, alert delivery or production recovery.
