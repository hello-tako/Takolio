# ADR-B08-LOG-001 - Remove unbounded exception log payloads

Date: 2026-10-12 JST. Status: ACCEPTED_FOR_LOCAL_IMPLEMENTATION.
Base: efffb4f84b52eb42979c69547b6bd7263963099a.

ADR-B08a-001 only bounded HTTP completion/global-error telemetry. Existing route
and legacy provider catch paths still passed original exceptions to console.error;
D1/provider exceptions can contain private values and custom serialization hooks.
Scheduled cleanup truncated arbitrary error text, then the unchanged scheduler
serialized the complete report. Catalog shadow used mutable Error.name.

Remove only the raw exception argument at the identified static-message callsites.
A trusted literal operation message preserves diagnostic context without redacting
or inspecting payloads. Do not introduce an unused logger abstraction or attempt
to infer safe text from arbitrary thrown objects. Cleanup reports use a constant
failure category plus their existing task/status/count. Shadow failure categories
are bounded both where produced and where formatted for logging; caller-supplied
error text cannot bypass the formatter.

Only diagnostic payload compatibility changes. HTTP success/error DTOs, statuses,
retry/idempotency decisions, tenancy, DB/retention, catalog and provider authority
remain unchanged. No payment/auth logic, Worker/config/workflow/package/schema
change. Regression checks must exercise adversarial thrown values and keep errors
observable, rather than hiding the log sink or failure status. Rollback is the
reviewed parent implementation; no data migration or catalog cutover is involved.

This decision does not certify Cloudflare invocation logs, retention/access,
production behavior or Git-history secrecy. Source review and synthetic tests
cannot substitute hosted privacy/operational acceptance.

Public recipe-media diagnostics also accepted arbitrary shape-valid path IDs before
catalog confirmation. The emitter now omits recipeId and explicitly projects only
allowlisted event/code, closed role and validated version, retaining the window cap.
Media lookup, status/body/cache and R2 access remain unchanged.
