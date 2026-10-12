# Scan queue redrive and cancellation

This is an operator design, not a remote action executed by this checkpoint.
Use the existing queue ledger, scan quota ledger and claim fences. Never delete
queue/scan/quota/admission rows to retry a failed command. Store DLQ evidence in a
restricted system; application logs use bounded reasons and opaque support handles.

For one DLQ message, identify its scan/job tenant from the authorized ledger, then
check scan terminal state, queue attempts/error, current lease and quota reservation.
Ready/confirmed or SCAN_CANCELLED is terminal: acknowledge duplicate/redrive without
provider execution. An active fresh lease must remain owned. An expired transient
lease may be delivered under the existing max-attempt policy; a new claim invalidates
old workers. Permanent model/license/schema/image errors require a corrected explicit
new request or operator resolution, never blind replay of the original command.

Before future durable-spend integration, inspect immutable job ceilings and all
admissions, including ambiguous calls and shadow. A crash after admission retains
its reservation. Redelivery must not reset counters or replay an admission as another
network-call permission. Missing trusted token/price bounds denies candidate admission.
The dormant schema must receive a new migration and reader/staging proof before use.

Record redrive command identity, operator authority, reason, message version,
original job, attempt/counters, time and final bounded outcome. Same redrive identity
must be idempotent. No raw images/OCR text/cookies/provider bodies in records intended
for general telemetry. A heldout synthetic redrive test does not certify real DLQ
configuration, provider billing or production queue behavior.
