# Owner public key review - 2026-10-18

Record: `owner-key-review-20261018`.
Status: `OWNER_KEY_CREATED_POLICY_REVIEW_PENDING`.

The owner explicitly requested a new local Ed25519 key. The key pair was created
outside this repository under the owner's macOS account. The private key and
local recovery copy use mode 0600 in mode-0700 directories; no private key was
uploaded to GitHub/Cloudflare or included in a workflow secret. A random challenge
signed with the restored local copy verified against the public key.

Proposed signer ID: owner-20261018.
Public-key SHA-256 fingerprint (SPKI DER):
be0258713682a00e18a218e6523994716446a1c28e18935d7a2a34f6158cb316.
Only the public key appears in admin/release-policy.json for both dedicated Admin
environments. Both enabled flags remain false. The approvalRef points to this
review record; it is a proposed trust entry until the PR is independently reviewed
and merged. Key creation does not enroll an Access identity, grant an Admin role,
authorize an Actions run or enable the console.

The local recovery copy passed a cryptographic restoration check. It is on the
same computer and does not certify an independently recoverable offline backup.
That custody evidence remains PENDING_EXTERNAL_EVIDENCE. The actual verified
Access issuer/subject enrollment and GitHub metadata token are still pending.

## Review scope

PR #16 contains observed dedicated resource IDs, a protected main-only GET audit,
sanitized credential/infrastructure receipts and this proposed owner public key.
It does not change customer/payment runtime, apply migrations, upload Admin
Workers, bootstrap a user or enable runtime access. New source requires its own
hosted CI/Admin CI. Historical successful CI remains attributed to its old SHA.

Next: independent review of the new PR head, exact-main checks after merge,
protected credential audit, verified identity/custody and a separately reviewed
activation policy. Execute the signed protected staging sequence and actual
ST01-ST20 before a production release.

## Executed validation for the key proposal

- Focused configuration/release/audit regression: 4 files / 92 tests PASS.
- Both disabled target gates still reject release execution.
- Both policy public keys match the newly created local owner public key.
- In-memory candidate target contract validation PASS; no file was enabled.
- Lint and both TypeScript checks PASS.
- pnpm dependency audit reports 0 high / 0 critical (all severity counts zero).
  GitHub's separately reported default-branch Dependabot findings are not thereby
  resolved or relabeled; the views have different attribution.
- Public patch scan and git diff --check PASS.

Hosted checks on the earlier source are not evidence for this proposal.
