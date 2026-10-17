# Auth and OTP Migration

## Verified flow

`src/web/pages/AuthPage.tsx` initializes Google Identity Services with a JS credential callback. It posts the signed credential through the existing client to `POST /api/v1/auth/google`. `src/worker/utils/oauth.ts` checks Google tokeninfo audience, issuer, expiry and verified email; auth routes create the existing opaque server-side session. No authorization-code redirect handler was found. Redirect URI, OAuth state and PKCE are NOT_USED by this observed GIS credential flow; do not invent a callback URL.

Existing public client ID is in runtime evidence. Before live testing the operator must review that client's Google Console authorized JavaScript origins: production `https://takolio.app`, restricted staging test client/origin `https://staging.takolio.app`. Retain the old origin during transition. Do not register the API POST URL as a redirect URI. Domain ownership/consent-screen requirements remain operator verified.

Sessions use `__Host-` host-only, Path=/, HttpOnly, Secure, SameSite=Lax cookies. Existing apex, legacy and API-host cookies are separate; new-origin sign-in is required. The same-origin frontend avoids sharing cookies across siblings. CORS and CSRF accept exact app plus explicit legacy origins, reject staging/production crossover, and vary Origin. Expiry, renewal and logout mechanisms remain unchanged.

## OTP and email

`src/worker/services/email.ts` builds numeric OTP emails with no app-domain link. The existing sender remains configured; moving the app does not require moving the sender. Production has SEND_EMAIL and RESEND_API_KEY names; staging has neither in the inspected version. This proves configuration presence, not deliverability. No email has been sent by this task.

OTP request/resend/verification/recovery retain expiration, rate limiting, hashing and replay controls. Do not change strict-mode or delivery flags as a domain workaround.

## Operator acceptance

Real Google sign-in, approved-inbox delivery, session renewal/logout, OTP expiry/resend/replay and password recovery on staging are NOT RUN. Provider-console access, a restricted test client and an approved test inbox are required. An authorized operator must verify staging isolation before any real provider request. No credentials, OTPs or cookie values belong in the evidence.
