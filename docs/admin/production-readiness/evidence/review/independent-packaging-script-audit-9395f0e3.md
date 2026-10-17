# Independent packaging-script audit

Reviewed at 2026-10-16 UTC by `/root/independent_admin_review`.
Runtime source under audit: `9395f0e31ea599f1eb7780a8eba36964fed7c483`.
Scope: read-only review of task-local `prepare-final-evidence.py`, `refresh-final-artifacts.py`, `verify-final-package.py`, and `package-final-deliverables.py`. This is a script audit before the final documentation/evidence packet is generated, not certification of a resulting archive. No repository file was changed and no source validation command, build, deployment, or provider request was executed.

## Findings

1. [P2] Refresh the current public package-verification receipt. `prepare-final-evidence.py:20` preserves the old `evidence/package-verification.json` in `historical-066c35ad`, but the current file is neither overwritten nor invalidated. `verify-final-package.py:44` writes only `work/final-package-verification.json`, while `refresh-final-artifacts.py` excludes the current package-verification file from hashing. At review time, the current public receipt still claims runtime/package SHA `066c35ad670bc877756150c2055e3844dd7a17ce`, 14 commands, and PASS. Following the scripts as written would ship that historical receipt at the current evidence root beside the 9395 candidate evidence. Refresh it with clearly attributed current-source comparison evidence, or explicitly mark it historical at that path; retain the original historical copy. Ensure the public receipt cannot silently bypass artifact validation.

2. [P2] Bind delivery PASS claims to the actual source and packaging audit. `package-final-deliverables.py:31` reads a verification document but never checks its `sourceSha`, `pass`, `sourceUnchanged`, 15 successful commands, or raw-log digests. Lines 39-40 unconditionally emit source-byte-comparison PASS and independent-review PASS; lines 59-60 similarly state that the package contains documentation-only changes whose bytes were compared. The script archives `final-package-verification.json` without checking its `result`, `sourceSha`, or `packageHead`. A stale/failed or pre-commit audit can therefore produce a clean-looking receipt for a later checkout. Require the audit to pass and match both supplied source and current HEAD, validate the frozen run, and bind independent-review attribution to the retained exact-source report before writing these claims. This is an attribution gap in the packaging script; no assertion is made that the parent will skip its planned audit.

## Positive observations and limits

- Current packager retains all files under `.artifacts/admin-r2`, including failed and interrupted raw runs, with SHA-specific paths. It does not relabel those runs as the current pass.
- ZIP CRC validation, bundle verification, source-manifest byte comparisons, raw log digests, artifact digests, customer protected-path comparisons, 19 required documents and 20 NOT RUN staging cases are explicitly checked in the planned flow.
- Delivery text correctly distinguishes the tested runtime SHA from the packaging SHA, targeted local agent review from external approval, offline checks from real staging, and local preservation from blocked GitHub persistence.
- The helper scripts' original absolute paths are explicitly documented as requiring adjustment for restoration on another machine.
- All real ST01-ST20 remain NOT RUN; no staging or production certification or authorization is provided.

Disposition: CHANGES REQUIRED for the two packaging-attribution issues above before final archive acceptance. A separate generated-packet audit remains pending.

## Follow-up on script revision

After the initial report, the parent revised `package-final-deliverables.py` so that it executes `verify-final-package.py` immediately on the clean final HEAD; requires PASS with the requested source and current packaging HEAD; requires the source-delta and digest flags; validates the raw frozen-run source/pass/sourceUnchanged; checks the retained exact-source review's scoped PASS text; and records that report's SHA256. Read-only inspection confirms these changes resolve finding 2. Finding 1 is pending the planned current public receipt refresh and generated-packet audit.

## Follow-up: failed concurrent run and serial rerun provenance

Read-only review of the updated retry/verification/delivery flow confirms that the first default-concurrency full-suite failure is retained with its original disposition and raw log, while `retry-admin-r2-full-serial.mjs` runs the complete suite with `pnpm test --maxWorkers=1` on the same clean frozen source. The script leaves assertions and individual timeouts unchanged, records exact start/end/exit/signal/log hash, retains both `fullSuiteAttempts`, and requires the source to remain unchanged. The package verifier hashes both attempts and explicitly requires the final full-suite command to be the serial command. The receipt and correction script qualify the serial result and retained concurrent failure without claiming default-concurrency or hosted stability.

At this audit stage, the serial run is still in progress, so no passing result is independently asserted. The original raw failure reports 10 failed/374 passed files and 10 failed/8758 passed tests. Read-only digest/content checks verified that `timing-isolation.json` matches its retained raw log, and its exact ten-file command covers all ten failed files. The isolation log reports 10 files/170 tests passing and native D1 at 2862ms. The metadata candidly records that filesystem timestamps were recovered after the experiment rather than presenting them as captured process ISO timestamps. The resulting evidence supports a local resource-contention inference; it does not certify default-concurrency stability.

No new blocking script finding from these revisions. The historical public package-verification refresh and completed generated-packet audit remain pending.
