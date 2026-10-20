## Admin live acceptance continuation - 2026-10-21 JST

The live evidence remains bound to exact source `c7417120f6226d3a52d25e900af5b82bb8f311b3`; no newer source has been deployed. The working tree contains a scoped responsive CSS fix and its local E2E evidence. The owner authenticated through the real Cloudflare Access staging application and completed a read-only smoke over the Admin surface. The owner acceptance harness recorded 26/26 PASS: 13 API reads returned HTTP 200 with `Cache-Control: no-store` and zero forbidden credential-field names, missing/wrong CSRF returned `403 ADMIN_CSRF_FAILED` without state change, self-grant and self-revoke returned `403 ADMIN_FORBIDDEN`, a preference round-trip succeeded and was restored, and the corresponding success/denial audit rows were present. A small read load of 12 requests at concurrency 3 returned 200; max and p95 latency were 6.307s, so this is a bounded smoke measurement rather than a capacity certification.

Authenticated static-boundary checks on the real host passed 10/10: canonical Admin asset served, encoded asset/traversal/unknown route/customer asset variants returned 404, and the responses remained no-store. Real-host axe coverage now includes overview, users, households, billing, AI, recipes, system, audit and settings with zero reported violations and no horizontal overflow. Private cookie metadata confirms the Admin session cookie is HttpOnly, Secure and SameSite=Strict; values remain private.

Local exact-source validation also passed: focused Admin tests 124/124, R2 auth/facade/race tests 19/19, workerd scenarios 10/10, migration matrix 25/25, lint exit 0 with two existing warnings in ignored generated bundles, and TypeScript typecheck passed. These results strengthen ST10, ST13, ST16 and ST18 evidence, but do not close the live foreign issuer/audience/expiry cases, separate unauthorized/no-role identity, authenticated hostile-origin test, internal facade negatives, live recovery/concurrency, or full customer/load/JWKS certification.

The staging Access policy remains owner-only after QA cleanup. Production Admin remains untouched; no all-PASS ST01-ST20 certificate exists, so no production execute dispatch is safe or permitted by the release adapter.
Responsive real-host coverage remains partial. The earlier DevTools probe requested a 320px toolbar but measured `innerWidth=373`, `clientWidth=320`, and `visualViewport.width=160`; it is not a valid real-host 320px certification. A local synthetic E2E run now passes axe and client-width overflow checks for 10 Admin screens at 320, 390, 820 and 1440px after a scoped CSS fix; this does not promote the live ST18 row.

## Controlled QA cleanup and current release gate - 2026-10-21 JST

Exact source `c7417120f6226d3a52d25e900af5b82bb8f311b3` remained unchanged throughout this continuation. Emergency OFF `39466213701` and disabled rollback restore `39467865294` were approved through the protected `admin-staging` Environment and verified PASS. Five separate signed `revoke-staging-test` operations then passed: auditor `39469415829`, content `39470282640`, ops `39470824179`, support `39471359186`, and unprivileged `39472092782`. Each receipt proves `consoleEnabled=false`, `productionDeployed=false`, zero active Admin roles/sessions after the atomic ceremony, and one success audit.

The five Access identities' active sessions and devices were revoked in Cloudflare Users. The staging Access policy was edited and saved to retain only the enrolled owner email; all five `+takolio-qa-*` entries were removed. Staging was re-enabled owner-only by `39473100906`, verified PASS with productionDeployed=false. The sanitized aggregate and digests are in `evidence/staging-qa-cleanup-20261021.json`; private screenshots/readbacks remain ignored.

The real live role checks captured 60/60 PASS rows across four roles: 48 resource GETs, 8 missing/wrong-CSRF denials and 4 forbidden role-grant denials. Recursive credential-field scans found no forbidden keys in the observed payloads. Saved observations were also cross-checked against the documented role/resource allow list; the live harness originally derived expectations from the runtime settings matrix. The auditor alias later failed Cloudflare OTP re-login despite the policy entry; this remains FAIL and the role evidence explicitly records that the auditor role was tested via the content identity after a role switch. Three saved real-host axe pages have zero violations; this is not a complete responsive matrix.

The staging certificate remains unsigned. ST03/ST04/ST05, ST06/ST07, ST09, ST12 and ST15 are still `PENDING_EXTERNAL_EVIDENCE`; ST08/ST10/ST13/ST16/ST18/ST19 remain partial. Production Admin was not mutated. Do not deploy production until every exact-source ST01-ST20 row is genuinely PASS and the protected certificate is accepted.

Production plan-only run `39474465306` PASS on the same source; execute SKIPPED. Artifact `12289305865` archive SHA256 `4ebd4aa375077af61d69fb35a555e3db3eaa1af5f98098427aaee308b726c319` was verified. JSON syntax, aggregate assertions, `git diff --check` and `python3 scripts/admin-public-scan.py` passed.

This checkpoint supersedes the historical checkpoints below.

---

# QA rollout continuation - 2026-10-20 JST

PR #23 is merged at `96c4236e572a94df4977a686e20e31312191a321`.
Both exact-main checks passed: CI `39425624695`, Admin CI `39425624726`.
GitHub records two approvals by `vn-taphoanhatung` on HEAD `0008bed9`;
the agent observed those existing approvals and merged through the reviewer
browser session under the owner's delegated authority. This is not a claim
of a new independent human audit performed during this continuation.

The staging policy is saved with the owner and five QA aliases. The owner
also confirmed One-time PIN for staging and delivery to the owner mailbox.
OTP is not enabled or sent yet: the organization has only Cloudflare IdP,
and seven Access apps include production and unrelated systems. Scope must
be preserved before any organization-level provider is created.

A rollout regression was reproduced offline: after emergency containment,
`migrate` failed on missing Worker data bindings, while restoration required
the complete five-migration ledger. The contained-migration correction permits
only migration/rollback to accept the exact mapped shutdown target; migration
retains console OFF, isolated Admin D1 identity, signed manifest, protected
Environment, pre-action audit and complete post-migration schema validation.
Ordinary deployment, enablement and identity ceremonies still require full
bindings; rollback still requires full restored bindings at its final check.

Validation: initial regression FAIL 1 / PASS 94; after correction release
adapter/provider/CLI tests PASS 209/209, targeted ESLint PASS, typecheck PASS,
public scan PASS and diff check PASS. These are offline release-tool results,
not completed live staging acceptance. No Cloudflare migration or production
operation was executed. Existing source-specific live results remain historical.
Next: review/merge the correction and await exact-main CI, then emergency OFF,
contained migration 0005, verified schema-4 disabled rollback, new-source
disabled pair, real QA identity ceremonies and complete ST01-ST20 evidence.

---

# Latest production request checkpoint - 2026-10-20 JST

Status: `PRODUCTION_NOT_DEPLOYED_STAGING_CERTIFICATE_MISSING`.
Release source: `0307fc1032624f38321a894b164c030b73849faa`; main and Admin CI PASS.
This current checkpoint supersedes the historical checkpoints retained below.

Production run `39333366228` is plan-only: plan SUCCESS, execute SKIPPED.
No production Admin mutation or new execute dispatch was performed. The
`admin-production` Environment has its release credentials but no
`ADMIN_STAGING_CERTIFICATION` or current run-bound release authorization.
The adapter requires a signed exact-source ST01-ST20 all-PASS certificate for
all production operations except emergency disable. Current evidence is
unsigned and incomplete: 6 PASS, 6 PARTIAL, 8 PENDING_EXTERNAL_EVIDENCE.
The missing separate Access test identity remains an external prerequisite;
the owner's existing deploy and Environment-approval authorization is retained.

Read-only recheck: main SHA, CI/run job states, Environment protection rules,
secret names and artifact metadata verified. The production Admin hostname
was not resolvable from this machine; customer web/API health returned HTTP
200. This hostname observation is not a substitute for a Cloudflare inventory.
The latest owner staging session was logged out; a subsequent `/me` navigation
returned the Cloudflare Access sign-in page. The previous Mac-lock/logout
uncertainty is resolved. Screenshot: ignored local
`.artifacts/admin-live-20261020/resumed/logout-confirmed-20261020.png`.

Checks: `git diff --check` and `python3 scripts/admin-public-scan.py` PASS.
No source, gate, protection, customer database, payment, OTP or AI API change.
Next: complete actual missing staging evidence, package/sign the protected
exact-source certificate, then perform protected production commissioning.
A gate change would need an explicit reviewed release-policy change; this
request did not fabricate PASS or silently remove the certificate gate.

---

# Current Admin staging checkpoint - 2026-10-20 JST

Status: `ADMIN_STAGING_OWNER_SMOKE_ROLLBACK_PASS_PRODUCTION_BLOCKED`.
Exact source: `0307fc1032624f38321a894b164c030b73849faa`; exact-main CI
`39289222795` and Admin CI `39289223049` remain PASS. No runtime, customer,
payment, OTP or AI-provider code changed in this continuation.

Fresh protected staging evidence remains PASS: emergency disable
`39331453601`, paired rollback `39331742184`, and re-enable `39332174066`, all
approved by `vn-taphoanhatung` with run-bound signatures and verified artifacts.
Owner SSO smoke resumed on the exact source and a logout event was verified.
A later login was opened for more GET coverage; macOS locked during logout, so
the latest session logout remains UNCONFIRMED. See latest browser limitation.

Additional read-only evidence under ignored `.artifacts/admin-live-20261020/resumed/`:

- `api-read-scan-0307fc10.json`: six owner-authenticated GET payloads (`me`,
  users, overview, settings, audit, sessions) scanned; no forbidden credential
  field names found. The session-bound CSRF field is expected. This is payload
  evidence only and does not close every ST13 path.
- `boundary-extended-valid-preflight.json`: 60 anonymous/forged-header edge
  checks PASS. GET/POST redirect to the exact Access tenant; valid hostile-origin
  OPTIONS preflight returns the exact Cloudflare 403 denial body with no CORS
  headers. These are edge checks, not authenticated Worker CSRF/RBAC evidence.
  The original malformed OPTIONS probe omitted Access-Control-Request-Method,
  returned HTTP 400 and remains a retained failed harness. Its intermediate
  status-only reinterpretation is superseded and not acceptance evidence.
- `owner-final-logout-recheck.png`: an earlier verified logout at `/admin/login`;
  a subsequent session logout is unconfirmed because macOS locked.

Focused validation: release/provider/auth/concurrency tests `213/213` PASS;
T21RC2 capture files `93/93` PASS with `TMPDIR=/private/tmp`; Admin build and
both TypeScript checks PASS. Lint exits 0 with two warnings in generated ignored
bundles. Public scan and diff check PASS. An inadvertently unscoped full-suite
run reported 11 failures in two macOS temp-path/identity-fixture tooling files
(9105 tests passed); all 93 tests in those files passed on the focused corrected
temp-directory run. The failed full run is not reported as all-suite PASS.

The exact staging certification gate still has only 6 PASS (ST01/ST02/ST11/ST14/
ST17/ST20), 6 PARTIAL (ST08/ST10/ST13/ST16/ST18/ST19), and 8
`PENDING_EXTERNAL_EVIDENCE` (ST03-ST07/ST09/ST12/ST15). Missing evidence includes
validly signed foreign/expired JWTs at the live Worker, an actual separate Access
identity and role matrix, authenticated negative CSRF, internal facade negatives,
concurrency/key recovery, complete audit/action matrix, real-host axe/load/JWKS
and full customer regression. No all-PASS report or certificate was signed.

Production plan-only run `39333366228` remains SUCCESS with execute SKIPPED,
artifact `12224599448` (archive SHA256
`0a75a03d8db02fcaf22a6363eb783360bee0e63e483789efbbe87c60f2d76713`).
`productionMutationExecuted=false`; production Admin remains untouched.
Next: complete the missing real staging evidence, package the protected exact-SHA
certificate, then perform the signed production commissioning sequence. Existing
owner authorization for deployment and Environment approvals remains valid;
this blocker is evidence, not a new permission request.

## Latest browser limitation

After the successful logout screenshot below, the owner session was opened once
more to continue the remaining GET coverage. The Mac then locked during the
logout attempt. The new session's logout is UNCONFIRMED; the earlier screenshot
proves its own completed logout event only, not the final current session state.
Do not reuse that image as proof that the latest session is logged out. No
browser lock bypass was attempted. Native Chrome access must resume on an
unlocked Mac for further authenticated acceptance work.

---

# Current Admin staging checkpoint - 2026-10-20 JST

Status: `ADMIN_STAGING_OWNER_SMOKE_ROLLBACK_PASS_PRODUCTION_BLOCKED`.
Exact source: `0307fc1032624f38321a894b164c030b73849faa`; protected main and
exact-main CI `39289222795` / Admin CI `39289223049` remain unchanged and PASS.
This header supersedes the historical checkpoints retained below.

Owner Access login, dashboard/users/AI/recipes/system/audit/settings reads,
preference save, `/me`, logout and post-logout `/me` rejection completed on this
source. Authenticated users JSON contained 21 rows and no forbidden credential
fields; this is one payload path, not full ST13 certification. Credentials and
private data remain outside Git.

Fresh protected staging emergency disable `39331453601`, paired rollback
`39331742184`, and re-enable `39332174066` all PASS with run-bound owner
signatures, actual `vn-taphoanhatung` Environment approvals and verified artifact
digests. Full source-specific ST20 now PASS. Current enabled Admin version:
`e7ed80bd-26cb-4e33-a658-0cf298412af0`; facade:
`4dbf1918-e8cc-4162-b06a-bc377ab23f57`. Disabled baseline Admin:
`e38bfb72-8614-4b9f-b3e3-ef3fdf0824eb`, same facade. Anonymous boundary curl
checks PASS 12/12; customer `takolio.app` and `api.takolio.app` health 200/ok.

Current required matrix: 6 PASS (ST01/ST02/ST11/ST14/ST17/ST20), 6 PARTIAL
(ST08/ST10/ST13/ST16/ST18/ST19), 8 `PENDING_EXTERNAL_EVIDENCE`
(ST03-ST07/ST09/ST12/ST15). Missing actual foreign/expired token, other identity/
role, negative CSRF/facade, concurrency/recovery, full API exclusion, real-host
axe/load/JWKS and full customer regression evidence still prevents certification.
No all-PASS report or certificate was signed. Production plan-only `39333366228`
PASS with execute SKIPPED; no production Admin mutation/deployment occurred.

The Chrome extension still lacks its automation connection; native Chrome was
used through the documented UI API. Initial owner continuation failed under a
stale Access session; ordinary Cloudflare SSO sign-in restored it without OTP.
Initial Python urllib probes returned Cloudflare browser-integrity error 1010;
that failed harness report remains separate from successful curl boundary and
health evidence. An incorrect early `/api/health` path and Access-protected
customer staging health were not treated as runtime outage or successful health.
Preserve earlier release FAIL/UNKNOWN receipts and the checkpoint stash.

Latest ignored evidence: `.artifacts/admin-live-20261020/resumed/`.
`git diff --check` and `python3 scripts/admin-public-scan.py` PASS. Only operational
documentation changed; no runtime code, customer data/schema, payment, OTP or AI
provider change was performed. Next: complete remaining live evidence, then the
protected exact-source staging certificate and production sequence. The owner
already delegated Environment approvals; no renewed deployment permission is
needed for the authorized scope.

---

# Verified staging release checkpoint - 2026-10-20 JST

Status: `ADMIN_STAGING_ENABLED_PRODUCTION_BLOCKED_LIVE_EVIDENCE`.
Release source: `0307fc1032624f38321a894b164c030b73849faa`.
This checkpoint supersedes the earlier candidate/contained status retained below.
PR #22 was independently approved by `vn-taphoanhatung` at HEAD `a167aa53` and
merged normally at 2026-10-19T16:52:19Z. Exact-main CI `39289222795` and Admin CI
`39289223049` both succeeded; no prior PR result was substituted for those runs.

## Protected release results

| Operation | Run | Result |
| --- | --- | --- |
| Early staging rollback dispatch | 39290770177 | FAIL before Cloudflare credential/execution; runner started at 17:06:43Z, authorization secret updated at 17:06:49Z; prior run-bound authorization was rejected |
| Fresh corrected staging rollback | 39292571221 | PASS; exact schema-4 disabled baseline restored and verified |
| New-source staging deploy-disabled | 39293405049 | PASS; source 0307fc10, schema/identity verified, console OFF |
| New-source staging enable | 39294320059 | PASS; source 0307fc10, console ON, owner/bootstrap/secrets/provider guards verified |

Each successful run has one fresh exact-SHA/run-bound owner signature created
with the reviewed `admin-owner-sign.mjs`, actual protected `admin-staging`
approval by `vn-taphoanhatung`, and verified immutable pre-action and operation
archive digests. The agent used the already authenticated reviewer Chrome
session for these Environment approvals under the owner's explicit delegation.
No branch protection or Environment setting was weakened. No production Admin
operation, paid AI call or real OTP was performed.

Corrected rollback restored Admin `e5edbdbd-a912-498b-863e-88bb1f4d1d7e` and
facade `f8c39deb-1542-4812-8f9c-37e84721d8cf` at previous source `24cf5d45`.
The new SHA's own verified disabled baseline is Admin
`e38bfb72-8614-4b9f-b3e3-ef3fdf0824eb` and facade
`4dbf1918-e8cc-4162-b06a-bc377ab23f57`.
The enabled staging state is Admin `22c714f5-b281-4f9c-8a90-78292df78db4`
and the same new-source facade.

| Run | Artifact | SHA256 archive digest |
| --- | --- | --- |
| 39292571221 | 12206666361 pre-action | 9982d10a91987c842b99930ea5ae28a2b273f5bb0ff2d5e4f76575556654eecd |
| 39292571221 | 12206272305 operation | 43a0ce9188ea15cc313544c97638700075e0d43b783698dd0184fdecf48ad16e |
| 39293405049 | 12205449174 pre-action | 8fc6d6238d879c9256e2dd734b37a8304590146dfd63ee2dc0c9ea3948dc3387 |
| 39293405049 | 12205972975 operation | 0f807952193882d4729c7a42f543da8c5e6838cdeaa3af2397ed5741b93a5286 |
| 39294320059 | 12206672583 pre-action | ceeb6b8e0157df9d776f744c4d9bddcfb2fe60ae92ac34758e1918ff9240fb92 |
| 39294320059 | 12206464540 operation | 4219191cf33882035a0258c41c3f56f86e04d475a56b7290a495f01e60fcac2b |

## Current acceptance scope and blockers

ST20's corrected protected rollback component is now PASS; retain both prior
FAIL/UNKNOWN receipts below. This is not a successful emergency-OFF/new-baseline
rollback cycle on the enabled new-source runtime. The earlier emergency-OFF PASS
belongs to source 24cf5d45. A complete exact-source ST20 rehearsal is still
required before an all-PASS certificate.

The owner entered the real Access login via the existing Cloudflare SSO session,
without OTP, and observed Not Found while the rollback baseline was OFF.
After the new-source enable, the real host displayed the Admin Access-only login
page. The Mac locked before the Continue action could complete, so authenticated
owner dashboard, API scan and logout on source 0307fc10 remain unverified.
The Chrome extension channel also remained unavailable. Do not bypass macOS lock
or infer authenticated evidence from earlier-source observations.

Post-enable anonymous boundary checks passed 12/12, including forged assertion
and SUPER_ADMIN headers; all responses redirected to the exact Access tenant.
These are edge-denial checks, not Worker JWT verification or RBAC evidence.
Both customer health origins returned HTTP 200/status=ok in this recheck; complete
customer regression remains partial.

The owner confirmed no separate test Access account is available. ST03-ST07,
ST09, ST12 and ST15 remain `PENDING_EXTERNAL_EVIDENCE`. ST08/ST10/ST13/ST16/
ST18/ST19 remain partial, and source-specific rows must be revalidated rather
than promoted from the historical 24cf5d45 source. The single-owner staffing
requirement remains removed; separate real test evidence is not a staffing quorum.

No all-PASS staging report/certificate was signed or uploaded. Production remains
`PENDING_EXTERNAL_EVIDENCE`, blocked by the existing exact-source ST01-ST20
certificate contract. Next: resume actual owner smoke when the Mac is available,
complete the remaining live matrix and new-source emergency OFF/paired rollback,
then certify through its protected workflow before any production sequence.
Local receipts, screenshots and sanitized checks are retained under the ignored
`.artifacts/admin-live-20261020` directory; secret bundles and key material stay
outside public Git.

---

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

## Continuation evidence addendum - 2026-10-20 JST

The Mac/Chrome owner session became available again. On exact source `0307fc1032624f38321a894b164c030b73849faa`, the owner loaded overview, users, AI/OCR, recipes, system, audit and settings; `/api/v1/admin/me` returned the enrolled `SUPER_ADMIN` Cloudflare Access identity, users remained email-masked by default, settings preference save succeeded, logout returned `/admin/login`, and post-logout `/api/v1/admin/me` returned `ADMIN_UNAUTHENTICATED`.

Fresh exact-source ST20 rehearsal is complete: emergency disable `39331453601` PASS with `Not Found` shutdown smoke; paired rollback `39331742184` PASS restored disabled Admin `e38bfb72-8614-4b9f-b3e3-ef3fdf0824eb` and facade `4dbf1918-e8cc-4162-b06a-bc377ab23f57`; re-enable `39332174066` PASS restored Admin `e7ed80bd-26cb-4e33-a658-0cf298412af0`. Each run used a fresh exact run-bound owner signature, protected `admin-staging` approval by `vn-taphoanhatung`, and locally verified artifact archive digest. Anonymous post-restore boundary checks PASS 12/12 and customer health checks for `takolio.app` and `api.takolio.app` returned HTTP 200/status ok.

These results close the source-specific ST20 gap and add owner smoke evidence, but do not create an all-PASS certificate. ST03-ST07, ST09, ST12 and ST15 remain `PENDING_EXTERNAL_EVIDENCE`; ST08/ST10/ST13/ST16/ST18/ST19 remain partial. Production Admin remains untouched until every required ST row has real evidence and the protected staging certificate is signed and accepted.

The owner authenticated `/api/v1/admin/users` JSON was downloaded only to the ignored local evidence directory for a field scan. It contained 21 items and no password, salt, token-hash, session-token, access-token, refresh-token, API-key, HMAC-secret or private-key fields. This closes the credential-output scan for the observed users response only; it does not close all ST13 payload paths.

The offline production plan run `39333366228` completed successfully with execute skipped. It performed no Cloudflare mutation and is not production deployment evidence.

## Production dispatch recheck - 2026-10-20 10:31 UTC

The requested production deployment was rechecked against exact main
`0307fc1032624f38321a894b164c030b73849faa`. Read-only checks passed for branch
protection, exact-main CI references, production Environment reviewer policy and
the existing production plan artifact. Workflow `39333366228` remains
`plan=success` with `execute=skipped`; no production Admin mutation occurred.

The protected release adapter still requires an owner-signed
`ADMIN_STAGING_CERTIFICATION` whose exact-source report has all ST01-ST20 set
to `PASS`. The current unsigned evidence remains 6 PASS, 6 PARTIAL and 8
`PENDING_EXTERNAL_EVIDENCE`; the certification secret is absent from the
production Environment. Therefore no execute dispatch was attempted, because it
would fail closed before Cloudflare credentials or production mutation.

Checks executed: `gh run view 39333366228`, production Environment policy and
secret inventory readback, `git diff --check`, and
`python3 scripts/admin-public-scan.py` (PASS). Next action remains obtaining
real missing staging evidence, signing the exact-source certificate, then
running the protected production commissioning sequence.

## Owner session closure - 2026-10-20

The latest owner-authenticated staging session was explicitly logged out and
returned to `/admin/login`. A follow-up navigation to
`/api/v1/admin/me` redirected to the Cloudflare Access sign-in page, confirming
that the session no longer had an authenticated Admin response. No token,
cookie or credential value was copied into evidence or chat. This closes the
browser-session limitation only; it does not close the remaining live ST03-ST19
evidence or create a staging certificate.

## Staging Access policy save and compatibility recheck - 2026-10-20 JST

The earlier checkpoint statements that the staging policy was unsaved are
superseded. The owner-confirmed staging policy was saved and re-opened in
Cloudflare: the original owner email remains allowed and exactly five aliases
were added (`unprivileged`, `content`, `ops`, `support`, `auditor` under
`+takolio-qa-`). The 30-minute application session setting and production policy
were left unchanged. No OTP or identity subject was obtained by this action.

After the schema-4 compatibility correction, local verification is PASS:
focused tests `219/219`, migration matrix `25/25`, workerd checks `10/10`,
schema smoke, typecheck, Admin build, lint with two existing generated-bundle
warnings, public scan and diff check. This does not promote any live ST03-ST19
row or create a staging certificate.
