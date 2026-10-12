# Remaining independent acceptance

Integrated backend and Brand V3 are merged and deployed on release SHA
0c0f9933dcd1af2296d8033709ea3bf5ceec30f2. These items require evidence beyond this
release's isolated synthetic tests and bounded public smoke.

| Work | Required next input and acceptance |
| --- | --- |
| Email/auth | Controlled real recipient and delivery evidence, real login/registration/reset/Google/session journeys and direct WebKit Cloudflare Turnstile iframe-error acceptance; production readiness currently reports deliveryVerified=false. |
| OCR/Scan V3 | Permitted real VI/JA invoice/fridge assets, independent labels, provider capability/privacy/token/output/pricing evidence and approved spend cap; candidate writer stays dormant until quality and compatibility gates pass. |
| Ingredient/data | Independent review of the prepared ingredient/source/nutrition/unit pilot and full consumer gates; existing four Ingredient V2 release blockers remain. |
| Protected billing | Explicit payment-owner scope and finance/sandbox acceptance for any future reconciliation work; this release changes no protected payment/billing implementation and certifies no real transaction. |
| Devices | Physical supported-device/browser-floor acceptance; Tailwind4 floor Safari16.4+/Chrome111+/Firefox128+; current Playwright engines pass. |
| Operations | Approved alert/load/chaos/multi-isolate/retention/access checks, seven-day SLO baseline and independent acceptance; current public health samples are bounded only. |
| Recovery | Approved rehearsal on isolated resources or controlled future release to prove runtime strict OTP maintenance and recovery; inactive production recovery metadata is certified, no traffic switch rehearsal claimed. |

Existing packet decisions and historical failed attempts remain available. Synthetic
images solve repeatable local regression coverage, not real-data/provider acceptance.
No paid call, real message, payment or promotion is implied by this document.
