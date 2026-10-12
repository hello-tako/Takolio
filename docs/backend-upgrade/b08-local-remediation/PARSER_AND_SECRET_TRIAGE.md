# B08 parser and secret candidate provenance

This lane reviews the 16 findings in the immutable prior Gitleaks repository
receipt. It publishes hashed locations, source-content hashes, categories, and
verified context only. Candidate values and matched source snippets remain private.
No rule, baseline, or allowlist is changed; raw scanner findings remain 16.

## Captured Gitleaks findings

- 9 documented checksums: eight historical overlay asset hashes produced by
  SHA256(response bytes), and one migration fixture verified against actual bytes.
  Historical overlay assets were not refetched or independently rehashed.
- 1 documented commit identifier verified as an actual reachable Git commit.
- 2 static error-code arguments, with the credential parameter separate.
- 4 synthetic test-local JWT/OTP binding fixtures in in-memory SQLite/Hono setup.
- 0 unresolved potential secrets in these 16 captured locations; this is not an
  absence-of-secrets certificate for other files, Git history, or real services.

`GITLEAKS_TRIAGE.json` preserves per-candidate proof and provenance hashes. The
location hash includes the file path, start/end line and column, and rule ID,
producing 16 distinct location hashes. All 16 current source files matched the
captured bytes at adjudication. No credential validity check, service call,
rotation, or suppression is performed. Fresh repository scanner results remain
owned by the parent lane and must be read separately from this adjudication.

## Targeted parser remediation

Semgrep 1.180.0 reported PartialParsing for the inline generic import call in the
async router mock in `tests/integration/frontend-ui-integration.test.tsx`.
Moving that same generic call to a local variable still failed in the real pinned
engine. The final minimal refactor awaits `importOriginal()` without generic call
syntax, applies the same `typeof import` module type as a type assertion, and
returns the same spread and mocked hooks. The type assertion has no runtime effect.

All bytes outside that single mock region remain unchanged against Git HEAD
`2c42984b2839d1b03c3b0ccfb89998d3535a48d8`; all 80 assertion lines remain unchanged.
`PARSER_RECHECK.json` records the bounded byte proof, source hashes, attempt
interpretations, and exact receipt references. Final source SHA256:
`b800b0a51a591da8fe44b1d7ae34ee03d64bb1ba5ddad80c16feeec4853596d3`.

| Check | Actual result | Scope |
| --- | --- | --- |
| Pinned Semgrep 1.180.0 with local AST rules | PASS: 0 findings, 0 parser errors | Exact coverage of this 1 complete source file |
| Existing Vitest 4.1.11 test under Node 24 | PASS: 1 file, 34 tests | Existing frontend UI integration assertions |

The retained generic-call attempt is a real parser failure. The intervening
recovery wrapper failed reading a mismatched raw-report filename; its receipt is
not proof of a scanner result. The corrected wrapper reran the engine and captured
its actual successful exit and exact target coverage. Both failures remain
preserved, and no PASS is inferred from their private outputs.

This targeted PASS does not establish whole-repository parser coverage or clear
other scanner findings. Historical program receipts and source freeze remain
unchanged. The parent owns shared dependencies, full validation, fresh
whole-repository scanner runs, and rollout prerequisites.
