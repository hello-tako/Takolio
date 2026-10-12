# ADR - Brand V3 and backend integrated release

2026-10-12 JST. User explicitly authorizes PR66 integration, merge and production
release. All exact-main/hosted-CI/schema/catalog/environment gates remain required.

Migration0040 is additive and introduces durable strict OTP authority. The previous
production Worker still uses legacy comparison; it is an unsafe rollback after new
strict challenges have been admitted. For the first strict release, upload a named
recovery version from the exact tested candidate before switching traffic. The
recovery retains the same expanded schema, inventory/catalog authority, assets and
strict coordinator, but explicitly refuses all OTP issuance/verification/reset paths
with503 AUTH_OTP_MAINTENANCE before database/provider work. Verified-account password/cookie/Google
and unrelated features retain their own existing guards. Never erase scopes/tickets,
rotate HMAC secrets, down-migrate or re-enable legacy verification during recovery.

The uploaded version must prove exact candidate GIT_COMMIT, canonical D1 identity,
STRICT_OTP_FAIL_CLOSED=true, and unchanged catalog/T20 flags. Upload alone serves
no traffic. Automatic recovery chooses this named verified version only when the
previous source lacks strict coordinator integration; subsequent strict-compatible
releases retain exact-previous rollback. Recovery verifies runtime SHA, active100%
version, D1 binding, catalog evidence and explicit OTP maintenance response. This
is a narrowly required supersession of the prior exact-previous policy for the first
strict cutover. All prior deployment and authority evidence remains in the receipt.

Local/native mocks do not certify inbox delivery or real OCR/provider accuracy. No
new paid provider, billing authority or catalog candidate is activated. Tailwind4
requires maintained browsers Safari16.4+, Chrome111+, Firefox128+; current engines
are tested, lower-device support is not claimed. Synthetic image evidence remains
TEST_ONLY. Production environment reviewer approval remains external to this agent.
