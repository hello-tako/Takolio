> R2 CURRENT AUTHORITY: production-readiness/00_EXECUTIVE_STATUS.md and 03-18.
> The material retained below is historical original/R1 documentation; its source,
> customer binding/password authority, schema version 1, two-person/bootstrap,
> per-email throttling and rollout directions are superseded. Do not execute
> historical release or SQL instructions. Current Admin authority is independent
> issuer/subject enrollment, three operators, ADMIN_DB schema 3 and internal
> read facade. Live workflows are offline plans; staging/production are blocked.

# Admin Console V1 — security assessment (local, self-assessed)

> **Status:** Superseded by `remediation-r1/REPORT.md` (R1). The 2026-10-12 review found S1–S11 in this design; the controls and residual risks below describe commit `3e865d0` only.

This is an implementer's self-assessment from local testing. It is **not** an independent review and
**not** a production certification.

## Controls implemented and how they are verified

| Threat | Control | Evidence (automated) |
|---|---|---|
| Anonymous access | Every non-public admin route requires an admin session → 401 | integration: `denies anonymous access to every read endpoint`; E2E unauthenticated test |
| Customer user / household owner escalation | Authority only from `admin_role_assignments`; household roles never read; generic 401 on login | integration: `refuses regular users, household owners, unverified, guest and revoked admins…`, `household ownership never grants platform admin`; E2E owner refusal |
| Client-asserted identity | Forged `x-admin-role`, `x-user-id`, `X-Frigo-Expected-*`, Bearer, fake Access header, and customer `__Host-frigo_session` are all ignored | integration: `ignores forged identity headers, bearer tokens and customer session cookies`; E2E forged header check |
| Frontend-only hiding | Every route declares its permission server-side; deny by default | integration: role × endpoint matrix test (5 roles × 15 endpoints); E2E content editor direct API calls → 403 |
| Session theft/replay | 32-byte random tokens, SHA-256 at rest, HttpOnly + Secure + SameSite=Strict, 8h absolute / 30 min idle, revocation on logout/role loss | integration: cookie attributes, logout, absolute + idle expiry, revoked-role tests; E2E logout → 401 |
| CSRF | Trusted Origin + session-bound `X-Admin-CSRF` (hash compared in constant time) on every mutation; denials audited | integration: missing/wrong token, cross-origin, absent Origin → 403 with no write; E2E |
| Privilege escalation | No self-grant/self-revoke; SUPER_ADMIN grant needs a second, distinct SUPER_ADMIN (DB CHECK enforces requester ≠ decider ≠ target); last SUPER_ADMIN cannot be revoked (guarded UPDATE); DB CHECK forbids grants without a granting admin outside bootstrap | integration: four-eyes test, grant/revoke test, DB constraint test |
| Unauthorized mutation | Permission check before any write; writes and audit in one D1 batch | integration: auditor grant / support review → 403 with no rows |
| Data exposure | Emails masked by default; reveal needs `users.pii.reveal` and is audited; order codes last-4; no hashes, tokens, salts, Google IDs, provider references, checkout instructions or image keys in any DTO | integration: redaction scan across 7 endpoints + reveal/deny audit |
| Input abuse | Strict Zod schemas (unknown params rejected), page ≤ 1000, pageSize ≤ 100, q ≤ 100 chars, LIKE wildcards escaped, parameterized SQL | integration: 10 malformed inputs → 400; `%` search matches nothing |
| Brute force | Login limited to 5/min per IP; writes 20/min; reads 120/min; login and writes fail closed in production without KV | integration: 6th login → 429 |
| Audit integrity | Append-only table (UPDATE/DELETE triggers abort); metadata allow-listed, `@` stripped, IP stored as HMAC | integration: append-only + audit correctness tests; migration smoke asserts triggers |
| Error leakage | Admin router error handler returns a generic 500 without stack, even in development | integration: `sanitizes internal errors without stack traces` |
| Local bootstrap misuse | No HTTP bootstrap endpoint (404); CLI refuses `--remote/--env/--preview`, non-development, CI, and a present `CLOUDFLARE_API_TOKEN`; one-time SQL guard | integration: bootstrap paths → 404; unit: 16 tooling tests incl. CLI exit codes |
| Production misconfiguration | Production serves nothing unless `ADMIN_CONSOLE_ENABLED=true`; then requires Cloudflare Access config, otherwise 503; password login impossible in production; dev sessions unusable in production | integration: three production fail-closed tests |
| Cloudflare Access | RS256/JWKS verification of aud/iss/exp/nbf on login **and every request**, plus email match with the session user | integration: verifier (valid, wrong aud, wrong iss, expired, bad signature, missing, unconfigured) and production Access flow |
| Clickjacking/XSS surface | `frame-ancestors 'none'`, `script-src 'self'` only, no inline scripts, React escaping | integration: admin CSP header test |
| Cross-app caching | Customer service worker bypasses `/admin*`; admin documents use `no-store` | code review + integration header test |

## Residual risks / not verified

1. **Cloudflare Access was not verified against a real tenant.** Only local RSA keys were used.
2. **Production bootstrap procedure is undefined.** It needs a reviewed operator process (see the integration plan).
3. Password login exists for development/staging (`ADMIN_PASSWORD_LOGIN_ENABLED`). It has no MFA. Staging should use Access.
4. Rate limiting relies on non-atomic KV, consistent with the existing limiter (abuse control, not a guarantee).
5. Users with `users.read` can search by email substring and get masked results; this reveals whether
   a matching account exists. Accepted for support workflows; review it with the PII policy.
6. The audit log has no retention/export policy yet, and an append-only table grows without bound.
7. `ai_requests` is not written by the runtime, so AI metrics reflect only existing rows (labelled `partial`).
8. Admin JS/CSS are public static assets on the customer host unless `ADMIN_HOSTNAME` plus Access are used. They contain no secrets.
9. No independent penetration test, dependency audit, or SAST run was performed for this change.
