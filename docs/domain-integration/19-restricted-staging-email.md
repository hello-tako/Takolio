# Restricted staging email preparation

Staging currently lacks both native email and a Resend secret. The existing
Cloudflare Email Sending domain is enabled/configured, and the existing app uses
the supported structured native send method. OTP delivery cannot be accepted
until a provider is deployed and the approved inbox actually receives a message.

This change adds an opt-in `enable_staging_email` input to the existing protected
staging lane. Its default is false. When true, the candidate may add only
`SEND_EMAIL` with one `destination_address`, supplied by the private staging
Environment secret `STAGING_OTP_TEST_RECIPIENT`. It rejects production targets,
an alternate Resend provider, missing/non-canonical recipients, wider restrictions
and any unrelated binding transition. No application or payment logic changes.

The secret stores the owner-approved test inbox; it is an address, not a new API
credential. No value is committed. Native sending needs no additional API token.
The actual recipient appears only in runner-local upload configuration and live
Cloudflare binding metadata, where the existing authorized operators can read it.
Command output is captured rather than printed; GitHub also masks the secret.
Only the sanitized receipt is uploaded. Its nested binding metadata, serialized
config bytes and failure text replace the recipient with a fixed marker.

The read-only audit accepts only the exact restricted staging binding in addition
to the original binding baseline, with the same private secret. It still compares
all other bindings/storage identities and rejects an alternate provider. Production
continues to require its original exact binding baseline. A subsequent staging
release preserves the existing recipient restriction instead of dropping it.

Version upload verification proves the original storage bindings, secret names,
flags, authority and runtime settings, plus only the approved email addition,
before traffic activation. Recovery rehydrates its private marker from the same
Environment secret and verifies the original full-config SHA-256 commitment.
Missing/different recipients or changed bytes stop recovery before mutation.
A preflight failure without a plan remains a no-mutation recovery case. Restoring
the previous version also restores its prior email-binding state.

## Validation

- Domain/release/service-worker regression: 10 files / 369 tests PASS.
- Full lint: exit 0; two existing warnings in generated ignored bundles.
- Both TypeScript projects, migration smoke and Web/Admin/Worker build PASS.
- Strict Wrangler version-upload dry-run accepts the restricted native binding;
  it uses a synthetic example.test address and makes no upload or activation.
- Public added-text scan and whitespace checks PASS.
- The audit fixture now deep-clones runtime metadata so its negative D1 test
  cannot mutate the shared baseline and corrupt later positive tests. No assertion
  or timeout was relaxed.

Live restricted binding activation, actual OTP inbox delivery, session lifecycle,
real Google sign-in, PayOS sandbox and rollback rehearsal remain pending. This
preparation does not authorize production or certify staging acceptance.

Official references checked October 17, 2026:

- https://developers.cloudflare.com/email-service/api/send-emails/workers-api/
- https://developers.cloudflare.com/email-service/configuration/send-bindings/
