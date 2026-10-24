# WKD01 runtime review

Scope: `src/web/lib/sync.ts`, `src/web/services/http.ts`, `src/web/services/api.ts`.
Source hashes after activation:
- sync.ts: 36abafa5ef1f03d9664062b74231a693cbb588391f5e97d047a0701e0812be12
- http.ts: f3a528db219202901127a827f5c0e0c9f7e4821334f42fa874895c1d0dbdfa45
- api.ts: 393d44c2c3becf98741b2289708c57d9f9d6da688de595429010042eedbe4dd3

No concrete new defect identified in this bounded review.

- Missing key alone becomes []; unreadable, malformed, non-array, invalid or unowned
  sibling records throw without writing. Diagnostic count returns null.
- Native setItem is the acceptance boundary. All listener calls are isolated;
  diagnostic read errors cannot revoke the returned receipt. Dedupe returns the
  existing exact owner-scoped record. Caller body/path validation remains required.
- Validation runs before persistence, including owner-rebind targets. Failed
  native rebind/removal writes preserve prior raw bytes and throw.
- Replay classification catches replay only. Successful replay increments before
  removal; removal is outside classifier catch. Permanent-error removal failure
  likewise escapes. Existing auth/409 classifier and in-tab serialization remain.
- API uses strict pending snapshot; finally reconciles accepted current-session
  paths even when removal fails. Session checks remain before every read and
  invalidation. All best-effort checks are inside catches, avoiding replacement of
  the persistence rejection. No return in finally.
- Automatic online/load retry rejection is consumed with emit(), preserving
  current numeric/null diagnostic rather than creating an unhandled rejection.

Checks executed by this subagent:
- Default Node25 intermediate sync suite: 36 tests,32PASS4FAIL while root-owned
  callers still old. Transcribed summary: domain-runtime-intermediate-sync.log.
  This is not raw/final Node24 gate evidence.
- `pnpm exec eslint src/web/lib/sync.ts src/web/services/http.ts src/web/services/api.ts`
  exit0 on default Node25 and Node24.16.0; final scoped log:
  domain-runtime-eslint-node24.log.
- Node24.16.0 `pnpm typecheck` intermediate exit2 solely from the not-yet-updated
  OfflineBanner/LogoutDialog null types; domain-runtime-typecheck.log retained.
- Final focused/full tests and fresh typecheck belong to root/test agent. No final
  gate success or browser/Worker acceptance claimed here.

Limits retained: localStorage is not a cross-tab transaction; global identity-key
storage failures keep existing auth behavior; no auth source or production change.
