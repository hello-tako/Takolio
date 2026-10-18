# Final Acceptance

Current status: `DOMAIN_STAGING_VERIFIED` for source
`d5f2e726f41b4f95f71e2977d00eb177e6a221e2`.
Production remains unchanged. Owner authorization is recorded; independent
Environment approval remains required for every certification/release run.

| Gate | Result | Evidence |
| --- | --- | --- |
| Canonical repository and protected main | PASS | hello-tako/Takolio, ID 1422954151; PR #13 merged normally |
| Exact-main CI/Admin CI | PASS on d5f2e726 | 39095997716 / 39095997634; 8,989 tests plus boundaries |
| Staging HTTPS/API/CORS/assets/source | PASS | Canonical release 39098613336, version 53b3ce38 |
| Staging Access/isolation | PASS | Audit 39101311454; exact-path provider webhook exception approved separately; app/health remain protected |
| Google login | PASS, same-SHA first upload | Actual GIS sign-in and authenticated profile; not a synthetic provider |
| OTP delivery | PASS, approved inbox | Actual forgot-password email received; password reset completion not claimed |
| Session lifecycle | PASS | Refresh persistence and actual logout, rechecked on final active version |
| PayOS sandbox | PASS within test scope | QR, real verification callback, invalid signature rejection, signed synthetic replay with one grant; no bank settlement or real money |
| Journeys/mobile/PWA smoke | PASS within browser scope | Recipe/planner/shopping/settings, queue/mock-AI scan confirmation, mobile 390x844; no model-accuracy/native-app/offline-device claim |
| Live paired rollback | PASS | Owned API detached, old version restored, audit 39098518311, canonical re-release |
| Production read-only certification | PASS on d5f2e726 | 39101415582, independently approved, checked 05:44:39Z; freshness limited to 45 minutes |
| First protected production attempt | FAILED SAFELY | 39101591421 prepared; no upload or traffic/hostname mutation |
| Production adapter build correction | Locally verified | See 24-production-build-guard.md; exact-head CI/review pending |
| Production cutover/error window/browser acceptance | PENDING | No production verified claim |
| Android/iOS association | PENDING | App identities/fingerprints unknown, endpoints intentionally 404 |
| Admin | RESERVED | Disabled and undeployed; separate gates required |

Detailed executed staging checks and qualifications:
https://github.com/hello-tako/Takolio/pull/13#issuecomment-6245968702

Next: protected adapter-fix merge, new canonical staging evidence/acceptance on the
new SHA, fresh production certification/release approval and final live verification.
Existing legacy host, resources, feature flags, schema and payment-provider settings
remain preserved. Historical failed runs and earlier evidence keep their original identities.
