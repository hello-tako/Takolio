# R2 regression evidence

Provenance: SOURCE_MANIFEST.md. **R2 final checks are not complete.**

Historical R1 reports remain under reviews/ and remediation-r1/. Current R2
acceptance cannot reuse their counts. WP0 observations and the interrupted
single-worker rerun are documented in REPORT.md. Source-integration checks
run while dependencies were being reconstructed failed; they are not final
regression evidence. A new frozen-source run is required after integration.

The raw historical PoCs intentionally assert defects. Fixing a defect can make
that historical assertion fail; preserve raw outputs and explain each expected
difference rather than removing assertions. New controls must explicitly test
issuer/subject/enrollment requirements that R1 token fixtures did not include.
