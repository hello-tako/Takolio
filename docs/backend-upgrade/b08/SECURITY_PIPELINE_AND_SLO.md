# Security pipeline and measured SLO handoff

Status: LOCAL_SECURITY_CANDIDATE_EXECUTED_WITH_BLOCKING_FINDINGS; hosted pipeline
and SLO not certified. This document consumes fresh audit/scanner evidence and
bounded local telemetry. No candidate workflow is enabled by files under docs.

## Separate security workflow proposal

The concrete `security-workflow.candidate.yml`, pinned scanner installer and
fixture runner under `security/` received independent local review. Promotion to
.github/workflows is a later isolated B08b change and must preserve
existing deploy/migration current-main/CI/approval/ancestry checks. Its validation
job uses contents:read, no deployment/account secrets, no pull_request_target,
no untrusted shell interpolation and a bounded runner timeout. Pin third-party
actions by independently verified full commit SHA. Fork input is data only; never
run it with privileged repository credentials. Do not modify the release workflow
to pass unresolved vulnerability findings.

Required artifacts: fresh full and production audit JSON with lock SHA, dependency
SBOM from the exact frozen install, SAST findings and secret-scanner findings
(metadata only, never matched secret bytes), and workflow-permission analysis.
Each scanner is version-pinned with immutable rule/config/source receipts. Test
synthetic positive and negative fixtures so an unavailable scanner cannot be
reported as a clean result. Scan new and modified code; a scoped baseline needs
explicit reviewed owner/expiry, not an unlimited allowlist. Exclude generated
private fixtures from public artifact upload; secret findings redact match values.

Gate rules: scanner unavailable/nonzero malformed output blocks certification.
Any unreviewed critical/high runtime vulnerability blocks release. Tooling findings
remain reviewed gates because test/build/image tools execute in local/CI. The
current41 full findings and2 production findings are unresolved; no exception was
approved. Remediation owners/actual version floors are in SECURITY-REMEDIATION.md.
Branch-protection/GitHub security settings and hosted checks are separate remote
changes. Local Gitleaks, Syft, Semgrep and zizmor were actually executed using
version/archive/package hashes. Positive/negative/failure fixtures check detection,
malformed output, exact SAST coverage and runtime-integrity rejection. Exact final
receipts, source hashes and limits are in `security/README.md` and the aggregate
program receipt. The repository scan remains blocked by secret/workflow findings
and incomplete Semgrep parsing; no clean certificate is issued.

The declared dependency SBOM covers manifests/lock data (786 library components
in the local run), excluding node_modules. It does not attest every installed
runtime/binary. Semgrep currently contains three narrow local rules; even a future
successful run of those rules is not an exhaustive OWASP or application-security
review. Gitleaks scans the current source snapshot, excluding generated artifacts,
known intentionally unsafe scanner fixtures and Git history. Findings remain
unreviewed until evidence-backed triage; no global allowlist or suppression is
applied. Reports containing source/secret locations remain private; exported
receipts contain hashes, bounded categories/counts and status only.

The candidate GitHub job has a 25-minute limit, contents:read, no persisted checkout
credentials, immutable action SHA pins, Python3.12/Node24 and frozen pnpm10.33.2.
It uploads sanitized scanner receipts for seven days and preserves audit failures.
Independent local zizmor found zero candidate-workflow findings. Eleven synthetic
audit-output cases validate strict JSON/count/exit/lock binding. Neither local
result proves execution on an Ubuntu hosted runner or enables the workflow.

## Metric contract and baseline collection

HTTP denominator is all completed invocations with event schema1, grouped by trusted
route template and deployment SHA. Report total count,2xx/3xx/4xx/5xx, internal error,
sampled/unsampled estimate and exclusions by window. Authentication and validation
4xx do not become service availability5xx, but remain visible independently.
Percentiles require sample count and the actual sampling ratio; low-count series
remain INSUFFICIENT_SAMPLE rather than invented p95. SPA/unmatched/gated events
remain a separate bounded category. DB/provider/queue metrics use separate phase
measurements and cannot be inferred from total HTTP duration.

For queued scans, count unique durable jobs admitted, terminal ready/failed/cancelled,
redeliveries, attempts, oldest pending/processing age and DLQ outcomes. Cancelled
jobs are a distinct outcome; never count them as usable OCR. Cost uses all primary/
repair/retry/shadow admissions and known/unknown billing provenance. UNKNOWN charge
is reported separately. No estimate receives a BILLED label. Email accepted/delivered/
bounced/unknown and payment local/provider states require restricted evidence joins;
HTTP200 or accepted message ID does not prove delivery/payment.

Collect a seven-day approved observation window with UTC boundaries, deployment
identity, route/task mix, n, exclusions, sampling, retention and read access. Store
only bounded events; source evidence and correlation maps stay restricted. Verify
collector permissions and alert delivery with actual operator evidence. Do not
copy raw IDs, emails, paths, cookie, OTP, images, provider bodies or payment data
into dashboards. Test absence with deliberate sensitive marker fixtures.

## Target decisions before a canary

Observed production baseline is unavailable in this local run. Therefore numerical
latency/error/queue-age/cost targets remain UNSET and must be fixed by the operator
and product owner using the measured route/task baseline before canary. Record
p50/p95/p99 target, error denominator, minimum n, permitted cost/job and observation
window per route/task. Hard stop remains any verified cross-household access,
quota/stock/grant duplication, unknown-to-known fabrication or stale publication.
A candidate release cannot treat absent numerical targets as a passed SLO gate.

Use existing local adversarial fixtures for D1 rollback/down, KV unavailable,
provider timeout/outage, email ambiguity and duplicate/cancelled queue delivery.
Their receipts prove deterministic local outcomes. They do not prove hosted load,
edge multi-isolate transactions, alert delivery or interrupted-deploy recovery.
Run approved staging synthetic load/chaos only with controlled fixtures and exact
SHA, then retain baseline delta and rollback receipts. No production7day or remote
chaos measurement has been performed by this checkpoint.
