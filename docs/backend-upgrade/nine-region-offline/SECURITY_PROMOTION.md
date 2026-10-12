# Security workflow promotion candidate

The new backend-security workflow is local source only. Hosted execution and
independent review are PENDING_EXTERNAL_EVIDENCE. It has no production Environment,
secret access, deployment step or write permission; existing deploy/migration/
certification workflows are byte-preserved. No required-check or protection changes.

Pinned Semgrep, Gitleaks, zizmor and Syft are exercised with positive, negative,
malformed/failure and coverage fixtures before a full source scan. Fresh full and
production dependency audits reject malformed/incomplete output and findings.
Reports with secret candidates remain private; only sanitized status receipts are
uploaded with seven-day retention. Raw Gitleaks findings remain FINDINGS even when
exact source context is adjudicated. No scanner-engine suppression or broad path
allowlist has been added.

The context gate requires all four scanners, receipt/report SHA and count agreement,
full redaction, an exact reviewed location and whole-file/source-provenance hashes
for each finding. Source drift, new/duplicate/unredacted findings or missing tools
fail. Current 17 inherited candidates are documented identifiers/checksums/errors/
synthetic fixtures; local context verification is not an independent audit.
Four proof entries were re-bound after reviewing the SQLite helper's additive 0041
ledger update. Their actual flagged source locations remain unchanged.

For pull requests, workflow adjudication reads the context file from the immutable
PR base SHA, never the PR's replacement context. An introduced or changed context
cannot authorize itself. The first promotion PR has no reviewed context in its
base and therefore fails closed at that step. An independent maintainer must review
and approve this initial policy through the repository's normal protections before
a subsequent hosted source scan can be adjudicated; this task does not bypass that
review or claim hosted CI PASS. Manual dispatch uses the selected source SHA;
operators must use reviewed main for release evidence. All executed PR code remains
untrusted in an unprivileged job, so its outputs never alone certify a release.

The existing production schema fingerprint test is re-bound only after reviewing
the expand-only 0041 table/column/index additions to the single read-only schema
query. Shell/render/query modules and production workflow executable surface remain
unchanged. A 0040-only database is explicitly rejected by the new local gate.
