# Initial restoration: Cloudflare D1 system table

Status: `REVIEW_REQUIRED_BEFORE_RESTORE_RETRY`.

## Observed failure and boundary

PR #20 was approved by vn-taphoanhatung at d87cd50d and merged normally as
`e18b12e13f991bebd62366004d6f6ea07dfa993e`. Candidate CI 39245236433 and Admin CI
39245236297 succeeded; Admin CI ran 407 files / 9,093 unit tests, 12 browser
cases and 10 keyboard repetitions. Exact-main CI 39248785032 and Admin CI
39248785249 also succeeded before the protected restoration was dispatched.

Fresh GET-only audit 39249116174 succeeded after Environment approval by
vn-taphoanhatung. Its artifact 12185141174 has verified archive digest
`276015f0244eb2518c48d12f5960dfd2c856dbd101d00b361f933804e07d6b38`.
All seven sections were OBSERVED; Admin staging remained OFF with the exact
ADMIN_SHUTDOWN=true marker and contained source 5c44cc5d. An offline target-valid
plan on e18b12e1 and the hosted run-bound plan were checked before approval.

Staging restore-initial-disabled run 39252519153 had a fresh owner signature,
verified plan and independent Environment approval. Authorization and pre-action
artifact upload succeeded. At 2026-10-19T12:35:20Z the provider refused with
`Initial restoration requires an unmigrated empty Admin database`.

- Plan artifact 12186063012, archive SHA-256
  eea1a8bdcc58755657deb776d3eef8cf8f6b34c1288de166e4aa062e709b6ecb.
- Pre-action artifact 12186481449, archive SHA-256
  2ef124b0d62b3d202c89db31334fe6fe2d083872e2c7f4c9aa0b70432acde5b2.
- Failure receipt artifact 12187300661, archive SHA-256
  6a03d5c88aaa0c2e3a10a7c5fc5584682c963aa66fd8235afeae437fb788cf24.

The refusal is in the first verifyInitialRecoveryTargets call, before either
Wrangler upload and before its compensating-write try block. The receipt remains
FAIL / UNKNOWN_REQUIRES_OPERATOR_INSPECTION; do not rewrite it as PASS or infer
new deployment versions. No migration, HMAC provisioning, owner enrollment,
bootstrap, enablement or production operation was dispatched.

## Read-only diagnosis

Local Wrangler's fixed SELECT attempt failed with Cloudflare authentication
code 10000. No local credential scope was widened. The existing logged-in
Cloudflare dashboard was then used for these two read-only schema queries on
the policy's dedicated Admin staging D1, never customer D1:

```sql
SELECT type, name, tbl_name, sql
FROM sqlite_schema WHERE sql IS NOT NULL ORDER BY type, name;
SELECT replace(replace(sql, char(10), ' '), char(13), ' ') AS definition
FROM sqlite_schema WHERE name = '_cf_KV';
```

The first returned exactly one schema object: table _cf_KV, tbl_name _cf_KV.
The second returned:

```sql
CREATE TABLE _cf_KV ( key TEXT PRIMARY KEY, value BLOB ) WITHOUT ROWID
```

No application schema or d1_migrations was observed. No system-table row or
customer row was read. The private screenshot and release artifacts remain
outside Git; this document contains only sanitized schema/release metadata.

The former query excluded only _cf_METADATA and sqlite_sequence, so a fresh
Cloudflare database with this current system table was rejected. This confirms
a provider-contract mismatch; it does not establish the original initialize
run's transport failure cause.

## Narrow correction and verification

The provider now reads schema definition metadata and accepts _cf_KV only when
its type, name, owning table and whitespace-normalized SQL exactly match the
observed Cloudflare definition. All other objects still refuse. Existing
source/ancestry/CI/Access/disabled mapping checks and the recheck before each
upload remain required. No prefix allowlist, deletion or database repair is added.

Real SQLite regressions reproduce two failures on the old provider. The final
provider suite passes 108 tests, including fresh internal table, internal table
with metadata, same-name application table, same-name view, existing authority,
migration ledger and a system-like application table. The broader five-file
Admin/provider/CLI/audit/workflow suite passes 205 tests. Whole-project lint
passes with two existing generated-bundle warnings; both typechecks and Admin
build pass with existing font resolution warnings and all font files emitted.
Whitespace validation passes. No full local-suite PASS is claimed for this change.

Next: exact-HEAD hosted CI, independent review, protected merge and exact-main
checks; inspect the post-failure GET-only audit, then a fresh run-bound signed
restore. Never rerun the failed job. Continue migration/HMAC/real owner Access
identity/enrollment/bootstrap/disabled baseline/enablement and actual ST01-ST20.
All incomplete live rows stay PENDING_EXTERNAL_EVIDENCE. Production requires the
completed signed exact-source staging certificate and its own protected sequence.
