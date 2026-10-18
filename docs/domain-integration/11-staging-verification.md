# Staging Verification

Verified source: d5f2e726f41b4f95f71e2977d00eb177e6a221e2.
Canonical release [39098613336](https://github.com/hello-tako/Takolio/actions/runs/39098613336)
activated frigo-staging version 53b3ce38-45b2-415e-89b4-44c116348fd0.
Both staging.takolio.app and api-staging.takolio.app passed HTTPS/API/CORS/asset
and source verification. Audit [39101311454](https://github.com/hello-tako/Takolio/actions/runs/39101311454)
confirms the same active version after owner-confirmed staging checksum rotation.
No new checksum was read; two real PayOS verification callbacks returned 200.

Executed operator checks and exact qualifications:
https://github.com/hello-tako/Takolio/pull/13#issuecomment-6245968702

- Real Google GIS sign-in, actual approved-inbox OTP delivery and session lifecycle.
- Actual sandbox QR and provider verification, invalid-signature rejection, signed
  synthetic sandbox settlement replay with one 31-day grant; no money transferred.
- Recipes, planner, shopping, settings and queue/mock-AI fixture scan confirmation.
- Desktop/mobile browser smoke and manifest/install UI; no native-app or production
  model-accuracy claim.
- Actual paired hostname/version rollback, restoration audit 39098518311 and
  canonical same-SHA re-release.

Google/OTP checks were on the first same-SHA upload before rollback; final upload
identity is independently proven. Final active-version session refresh/logout was
checked again. All staging storage/queue resources remain isolated, email delivery
is restricted to the approved inbox, and ordinary staging paths retain Access.
The separately approved webhook-only path exception still enforces Worker signatures.

The production build-guard correction needs new canonical staging evidence on its
new source SHA after protected merge. This historical receipt is not relabeled.
