# Admin staging live acceptance and rollback correction

Status: `ADMIN_STAGING_CONTAINED_ROLLBACK_FIX_REVIEW_REQUIRED`.
Observed runtime source: `24cf5d45c6b46e9008f489e4141e0e93ea8ee045`.
Candidate branch: `codex/admin-active-version-bindings-20261020`.
Evidence times are UTC; the operator's local date is 2026-10-20 JST.
This checkpoint supersedes older statements that no staging enrollment,
bootstrap or enablement has occurred. It does not certify the candidate source.

## Actual staging commissioning

All operations used exact-main owner signatures, fresh first-attempt dispatches,
protected admin-staging approval by vn-taphoanhatung and verified artifact
archive digests. No production Admin operation was executed.

| Operation | Run | Actual result |
| --- | --- | --- |
| Restore initial disabled | 39263643965 | PASS |
| Apply four Admin migrations and bind DB identity | 39264710973 | PASS; schema 4 |
| Provision initial facade/audit HMAC | 39265478697 | PASS; secret values not exported |
| Enroll actual owner Access identity | 39267458567 | PASS; console OFF |
| First bootstrap attempt | 39268037530 | FAIL before provider execution: immutable pre-action artifact validation; later metadata passes unchanged validation, original transient response unavailable |
| Fresh owner bootstrap | 39268687115 | PASS; console OFF |
| Deploy compatible disabled baseline | 39269250607 | PASS |
| Enable staging | 39270091042 | PASS; owner dashboard subsequently observed |
| Emergency disable rehearsal | 39273582548 | PASS |
| Paired rollback rehearsal | 39274064739 | FAIL/UNKNOWN; compensating containment observed |
| GET-only post-failure audit | 39274956899 | SUCCESS; seven metadata sections observed; settings describe containment |
| Instrumented fresh rollback rehearsal | 39275962070 | FAIL/UNKNOWN; active version/settings discrepancy reproduced; compensation observed |

The schema-4 disabled baseline is Admin
`e5edbdbd-a912-498b-863e-88bb1f4d1d7e` and facade
`f8c39deb-1542-4812-8f9c-37e84721d8cf`, both at the runtime source above.
At 2026-10-19T15:24:03.985Z the candidate provider's GET-only live probe found
Admin `4f105c43-e6da-4bca-97a2-9568c2179bf2`, console OFF, and the same facade
baseline. This probe validates metadata response handling only; it does not turn
failed release receipts into PASS or certify an actual corrected rollback.

Real owner login, overview, users, households, AI/OCR, recipes, system, audit and
settings were observed in Chrome. System displayed the exact runtime SHA and
schema health. Users' emails were masked by default. Audit displayed actual
owner enrollment, bootstrap and login. Logout returned to /admin/login;
/api/v1/admin/me then returned ADMIN_UNAUTHENTICATED behind a valid Access login.
No password entry was offered. Screenshots and private identity evidence remain
outside Git. A stale Access session produced the generic unavailable screen;
ordinary Access sign-in restored reads. Worker-negative JWT and Access expiry
UX testing remain incomplete.

AI request metrics explicitly report partial measurement; remote Analytics,
Queues and customer binding adapters report unavailable. These are not measured
zeroes or validated remote health. Recipe catalog mode mirror is unset and the
UI reports unknown. No paid AI API or actual OTP delivery was used.

## Confirmed rollback failure

Cloudflare's /workers/scripts/{worker}/settings can describe the latest uploaded
Worker even after a previous version is deployed. The release provider treated
that response as the active runtime binding set.

A read-only observer during run 39275962070 recorded the disabled baseline
receiving 100% traffic at 2026-10-19T15:16:18.021381Z while /settings still showed
ADMIN_SHUTDOWN=true and no data/service/assets bindings. The guard then raised
Existing Worker binding mismatch, and compensation deployed a shutdown version
observed at 15:16:29.468130Z. The first failed run's deployment history shows the
same rollback-then-containment sequence. Baseline version metadata has the
reviewed Admin D1/KV/facade bindings, source and schema 4.

The candidate reads the latest deployment, requires one UUID version at numeric
100%, fetches that exact version's resources.bindings, rejects duplicate/missing
binding names, and confirms the same deployment ID/version before using them.
All provider binding, disabled/enabled, secrets, containment and rollback checks
use this serving-version observation. Receipts use the same verified version
selection. There is no fallback to /settings, no new mutation endpoint, retry,
credential scope, role grant or approval bypass. Existing target/schema/Access,
owner signature, audit and GitHub protection checks remain in force.

## Current ST01-ST20 evidence

PARTIAL and PENDING_EXTERNAL_EVIDENCE do not satisfy certification. Earlier
local workerd, synthetic JWT, role, browser/axe or concurrency results do not
supply missing live evidence.

| Case | Actual status | Evidence or remaining requirement |
| --- | --- | --- |
| ST01 flag OFF pages/assets | PASS on runtime source | Disabled provider smoke and authenticated Chrome page/favicon/built JS denial before enable |
| ST02 no identity | PASS on runtime source | Five anonymous routes plus forged assertion/role headers redirected to exact Access tenant; logout /me denied |
| ST03 foreign issuer | PENDING_EXTERNAL_EVIDENCE | No distinct validly signed foreign-issuer token exercised against the live boundary |
| ST04 foreign audience | PENDING_EXTERNAL_EVIDENCE | No distinct validly signed wrong-audience token exercised against live Worker verification |
| ST05 expired token | PENDING_EXTERNAL_EVIDENCE | Access timeout/sign-in observed; isolated expired-token Worker verification not executed |
| ST06 unauthorized identity | PENDING_EXTERNAL_EVIDENCE | Only the actual approved owner identity was available |
| ST07 allowed identity without role | PENDING_EXTERNAL_EVIDENCE | No separate approved unprivileged Access identity was available |
| ST08 each role/resource | PARTIAL | Actual owner reads observed; other-role live principals not provisioned or fabricated |
| ST09 CSRF/hostile origins | PENDING_EXTERNAL_EVIDENCE | No authenticated negative-origin/CSRF live request completed |
| ST10 static bypass | PARTIAL | Canonical anonymous page/favicon/JS and flag-OFF checks passed; full authenticated bypass matrix remains |
| ST11 facade public exposure | PASS on runtime source | Protected provider target checks verified account routes/domains and disabled facade workers.dev/preview |
| ST12 invalid facade operations | PENDING_EXTERNAL_EVIDENCE | Internal live facade negative calls not executed; local workerd evidence remains separate |
| ST13 credential-field exclusion | PARTIAL | UI outputs observed with masking; full live API payload field scan remains |
| ST14 atomic owner bootstrap | PASS on runtime source | Separate signed enrollment/bootstrap receipts and actual immutable audit rows |
| ST15 concurrency/recovery | PENDING_EXTERNAL_EVIDENCE | Live concurrency and key recovery not rehearsed; sole active owner intentionally preserved |
| ST16 audit/state correspondence | PARTIAL | Enrollment/bootstrap/login matched UI audit; full sensitive-action negative/mutation matrix remains |
| ST17 migration manifest/identity | PASS on runtime source | Four-migration ledger/schema/integrity/authority identity checks in protected release receipts |
| ST18 real-host browser/axe/load | PARTIAL | Actual owner read smoke and logout completed; automated real-host axe, other roles, representative load and JWKS rotation remain |
| ST19 customer health/regression | PARTIAL | Anonymous customer health OK and customer Worker source/bindings unchanged in metadata; complete live regression remains |
| ST20 rollback/emergency OFF | FAIL | Emergency OFF PASS; two paired rollback attempts FAIL/UNKNOWN; corrected protected rehearsal required after merge |

No staging report/certificate was signed or uploaded. Production remains
PENDING_EXTERNAL_EVIDENCE and blocked by incomplete live certification.
The removed staffing quorum is not being reintroduced: one owner is sufficient
for administration; test identities must not be invented as real people.

## Candidate verification and next action

- Focused release/provider/CLI suite: 4 files / 215 tests PASS, including 16 new
  active-version regression cases and unchanged protection/schema contracts.
- pnpm lint PASS with two existing generated-artifact unused-disable warnings.
- pnpm typecheck PASS for both TypeScript projects.
- pnpm build:admin PASS; existing font URL warnings, all font files emitted.
- Candidate GET-only live metadata probe PASS, 9 reads, zero provider mutations.
- Hosted candidate checks and independent PR review must pass on the published
  HEAD; previous exact-main CI and runtime smoke cannot certify the new source.

After reviewed merge and exact-main CI, dispatch a fresh signed rollback-disabled
against the recorded compatible baseline, approve through the protected staging
Environment and verify receipt plus real flag-OFF smoke. Then deploy the reviewed
new source disabled, record its own baseline and re-enable for remaining live
acceptance. Do not reuse the fresh-install restoration operation on the populated
schema-4 database. Production may proceed only with complete exact-source live
evidence and its separately protected signed release sequence.

Initial HMAC provisioning additionally compares the serving version's normalized
bindings with latest-upload settings before each secret PUT. Cloudflare's secrets
API targets the latest upload; a stale upload must not replace a different serving
configuration. A mismatch stops before writing; no fallback selects that upload.
