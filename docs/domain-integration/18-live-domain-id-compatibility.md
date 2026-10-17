# Live custom-domain ID compatibility

## Evidence and failure

Canonical staging audit `39039057157` succeeded at main
`0900b013613fb1da62b0907b04eaf20734a9ac26`, including the active zone,
complete runtime/operational capture and all 43 migrations. That zone has no
custom domains, DNS records or Worker routes.

A supplementary read-only account custom-domain inventory returned 21 entries.
Every domain ID is 40 lowercase hexadecimal characters; zone IDs are 32. The
existing legacy Frigo domain is among them. The previous hostname validator and
staging rollback DELETE allowlist required a 32-character domain ID. Therefore
planning rejected the account inventory; a returned 40-character attachment ID
would also have been rejected after its PUT and could not pass the DELETE guard.
No application upload, activation or hostname mutation was attempted.

The official Workers Domain API defines domain IDs as immutable strings, without
promising a 32-character length. The fix accepts the observed 40-character shape
and retains 32-character receipts. Other lengths, non-hex text, URL/path suffixes,
wrong account/resource/method, duplicate IDs, ownership conflicts and zone-ID
format violations remain rejected. Both inventory validation and rollback use the
same domain-ID validator.

The staging preparation step now validates the complete account inventory and
proposed hostname conflicts before build/upload/traffic, and still repeats the
fenced check immediately before attachment. It does not claim the preflight
snapshot grants ownership; only each successful PUT's returned ID does that.

## Verification

- Before the fix: 1 file / 3 tests FAIL, reproducing the actual 40-character
  legacy domain ID, newly returned IDs and receipt ownership validation.
- After the fix: 10 focused domain/release/asset files / 391 tests PASS.
- Changed-module/test ESLint PASS.
- The actual supplementary 21-entry inventory now validates and plans exactly the
  two staging hostnames with zero mutations.
- Hosted full CI and independent review are still required at the final PR head.

This fix changes release tooling only. It does not add an email binding, change
Access/provider permissions, expose Admin, or enable production deployment.
Real staging Google/approved-inbox OTP/PayOS sandbox/session/mobile/PWA and live
rollback acceptance remain pending. Status: `DOMAIN_IMPLEMENTATION_IN_PROGRESS`.
