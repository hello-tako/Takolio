# B08b local security scanner candidate

Status: reproducible local candidate; security gate is FAILED. This packet does
not certify release readiness, production SLOs, licenses, or absence of secrets.
The candidate workflow lives at `../security-workflow.candidate.yml`; it is not an
installed `.github/workflows` pipeline.

## Pinned external engines

| Engine | Version | Purpose and limit |
| --- | --- | --- |
| Semgrep | 1.180.0 | Three local JavaScript/TypeScript AST rules: dynamic eval, Function construction, disabled TLS verification. No taint/complete OWASP coverage claim. |
| Gitleaks | 8.30.1 | Full pinned builtin secret rules, redact100, no custom allowlist. Findings require private human triage. |
| zizmor | 1.30.1 | Strict offline GitHub workflow auditing, ignores/config disabled. Online audits are unavailable by design. |
| Syft | 1.54.1 | CycloneDX 1.7 declared manifest/lock graph. A nonempty SBOM is not a vulnerability or license attestation. |

`tool-manifest.json` records official release URLs/SHA256 for Darwin arm64 and
Linux amd64 and official PyPI release metadata. SHA256 values were verified
against official GitHub release API asset digests/PyPI metadata. No independent
signature/transparency attestation is claimed. Semgrep transitives are frozen in
`semgrep-requirements.lock`; installation requires hashes and binary wheels.
Python 3.12 is required. Darwin arm64 was executed locally; Linux amd64 is a
pinned candidate and has not been executed in this packet.

## Reproduce from repository root

Use a fresh output directory per run; existing output directories fail closed.
Installation downloads only official pinned scanner distributions/Python wheels.
Scans use local files/rules, metrics/version updates disabled, zizmor offline,
Syft update checks disabled, and no registry rules or remote repository ingestion.

```bash
python3.12 docs/backend-upgrade/b08/security/install-tools.py \
  --tools-dir .artifacts/b08-tools
python3.12 docs/backend-upgrade/b08/security/runner.py selftest \
  --tools-dir .artifacts/b08-tools --output-dir .artifacts/b08-selftest
python3.12 docs/backend-upgrade/b08/security/runner.py scan \
  --tools-dir .artifacts/b08-tools --output-dir .artifacts/b08-scan
```

The installer writes only under repository `.artifacts`; it does not alter
project dependencies, package locks, global tool installations, or workflows.
The toolchain receipt binds archive hashes, executable/version hashes, Semgrep
requirement lock, Python executable, and the installed Semgrep runtime file tree
(excluding bytecode, with child Python bytecode reads redirected to a new private
cache prefix and writes disabled). The runner verifies these before each child execution.
This detects accidental drift against the local receipt; an actor able to
rewrite both the receipt and scanner directory remains outside this trust model.

Exit 0 means every requested gate passed; exit 1 means findings or a failed
selftest/gate; exit 2 means a runner error. Missing tools, version/hash mismatch,
timeout, malformed output, nonzero exit inconsistent with findings, parser
errors, empty source/workflows, partial SAST coverage, and empty package inventory
cannot produce a clean gate. Scanner stdout/stderr is captured privately.

## Source and privacy boundaries

The scan snapshots Git-tracked and nonignored current worktree files once,
including uncommitted files, and hashes each copied content into a tree receipt.
It excludes operational/generated `.hoplite`, `.artifacts`, `node_modules`,
`dist`, `.wrangler` and this packet's deliberate positive/negative fixtures.
Deleted worktree files are counted separately. Symlinks, unsupported nonregular
inputs, and source files above 20 MiB fail the snapshot. No Git history or
installed `node_modules` inventory is scanned. Semgrep receives every snapshot
JavaScript/TypeScript file explicitly and checks exact `paths.scanned` coverage.
zizmor receives current `.github/workflows` files; the candidate workflow needs
its own targeted review. No real provider request, email, deployment, or remote
D1/R2 operation is part of this candidate.

Outputs stay in ignored `.artifacts` directories with private permissions. Raw
Semgrep/zizmor outputs and snapshots contain source text; SBOMs contain paths and
package metadata. Gitleaks masks detected secrets, but raw reports still contain
context and must remain private. Never print, attach, commit, or upload raw
reports/logs/snapshots. Only `receipt.json` has public metadata: bounded statuses,
versions, counts, known rule IDs (unknown IDs are hashed), and content/report
hashes. It contains no matched values, source lines, or untrusted error messages.

## Local evidence and remaining work

Real engine selftests cover positive/negative fixtures, known Semgrep rules,
synthetic secret detection/redaction, unsafe/safe workflows, known SBOM package,
empty SBOM, malformed workflow/output, unavailable tools, receipt integrity drift,
revalidation after a prior success, partial SAST coverage, exit disagreement, and
unredacted report rejection. Fixtures never contain a real credential.

The actual local repository scan preserves these unresolved results:

- Semgrep: ERROR, one PartialParsing diagnostic in an existing frontend test;
  841 source files observed. No parser-error suppression or clean SAST claim.
- Gitleaks: FINDINGS, 16 `generic-api-key` matches; private triage required.
  These are candidate matches, not a claim that 16 real secrets exist.
- zizmor: FINDINGS, 72 findings: 67 `unpinned-uses`, 2 `cache-poisoning`,
  2 `template-injection`, 1 `artipacked`.
- Syft: PASS inventory generation, 786 library components in CycloneDX 1.7.
  Vulnerability audit and license approval remain separate requirements.

Do not baseline/suppress findings to obtain a green gate. Review each secret
candidate privately, fix actionable workflow findings in a separately reviewed
change, resolve SAST parser compatibility, and rerun the same pinned engines.
Root owns dependency audit remediation, candidate workflow validation, full
checks/build, and program status. Production SLO evidence remains external.
