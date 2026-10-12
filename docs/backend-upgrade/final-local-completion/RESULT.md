# Integrated backend and Takosan Brand V3 production release

Status: PRODUCTION_VERIFIED_WITH_EXTERNAL_ACCEPTANCE_OPEN.
Deployed main merge: 0c0f9933dcd1af2296d8033709ea3bf5ceec30f2.
Implementation b2fc564f3ff39bcd15dfb6bcb8f32912893b0506; full Brand V3 ancestor6114a43ee6c2798ecd9aebca959dd6496d1a2aea.
Repository transferred to hello-tako/Tako-san with unchanged ID1385308553.
PR https://github.com/hello-tako/Tako-san/pull/67.

## Delivered

Full branding merge retains canonical assets, semantic tokens, Nunito, accessibility,
favicon/PWA/OG and service-worker cache. Official Tailwind4.3.3 removes the vulnerable
braces/chokidar dependency graph; measured compatibility preserves the existing
geometry/focus/shadow/gradient behavior. No advisory suppression or unsafe override.

Backend packets retain strict atomic OTP coordination, truthful email lifecycle,
ScanV3 contracts/cancellation/budget kernels, synthetic invoice/fridge fixtures,
receipt preprocessing, tenant/planner/shopping/cooking regressions and privacy
telemetry. Dormant provider/ingredient candidates are not promoted by this release.

First strict OTP release has an inactive exact-candidate recovery version with
STRICT_OTP_FAIL_CLOSED=true; all OTP paths refuse before DB/provider work during
recovery. Existing D1/catalog/T20 authority is checked before traffic changes.
0040 migration gates certify exact constraints/indexes, bookmarks, counts, ledger,
identity, current main and successful exact-SHA CI before applying. Transferred
repository dispatch requires both its current full name and immutable ID.

## Executed evidence

Latest continuity local/hosted checks: 320 files / 7650 tests PASS, including 40
new continuity tests. Final source-delta Semgrep/zizmor/Gitleaks: 0 findings;
private exact-commit receipt hash is preserved in release-receipt.json. Earlier
continuity-security.json records the pre-final documentation digests.

- Node22 full suite319files/7610tests PASS; lint and both TypeScript checks PASS.
- Frozen install PASS; all40migrations replay PASS; paired T20 production build PASS.
-94isolated production-build E2E tests PASS. The four source E/H failures are fixed;
  OTP assertions now enforce real server cooldown and observable state.
-198responsive screenshots at six widths320-1440:0axe/overflow/broken images.
-40appearance pairs and12state pairs exact in computed styles and pixels.
-18native Chromium/Firefox/WebKit checks PASS;3PWA cache/manifest/offline checks PASS.
- Full declared dependency audit0all severities; production audit0 at integration.
- Pinned Semgrep/zizmor0findings; Syft500declaredcomponents. Gitleaks raw status
  remains findings17; all17context-reviewed,0unresolved. Native SQLite test-helper
  provenance changes explicitly reconciled with prior hashes retained.

Commands, timings, source SHAs/status and log hashes are in validation.json.
Browser receipts retain their earlier build SHAs; runtime files are byte-identical
from e869da7e through the implementation above. They are not final deployed-SHA
certificates. Earlier failures/logs stay private and retained, never counted as PASS.

## Actual merge and deployment

PR [68](https://github.com/hello-tako/Tako-san/pull/68), [66](https://github.com/hello-tako/Tako-san/pull/66) and
[67](https://github.com/hello-tako/Tako-san/pull/67) are MERGED. Normal protected merge
68 produced `0c0f9933dcd1af2296d8033709ea3bf5ceec30f2`; full Brand source is an ancestor.
[Exact merged-main CI](https://github.com/hello-tako/Tako-san/actions/runs/38208731783)
is SUCCESS. Earlier failed/cancelled runs remain historical.

Approved production deploy [38206476316](https://github.com/hello-tako/Tako-san/actions/runs/38206476316)
FAILED before recovery upload, application upload or traffic change: the original
per-SHA policy demanded a shadow reset even for unchanged complete D1 authority.
PR68 added the narrow protected continuity proof; it changed no runtime/catalog
bytes and did not reapply 0040. Final staging and production deploys used the new
main SHA; migration receipts retain their earlier source 6bc1fe96.

| Environment | 0040 migration | Deploy | Exact-SHA public smoke |
| --- | --- | --- | --- |
| Staging | [38204668457](https://github.com/hello-tako/Tako-san/actions/runs/38204668457) PASS | [38209289078](https://github.com/hello-tako/Tako-san/actions/runs/38209289078) PASS | 30 checks PASS |
| Production | [38205975841](https://github.com/hello-tako/Tako-san/actions/runs/38205975841) PASS | [38209910253](https://github.com/hello-tako/Tako-san/actions/runs/38209910253) PASS | 30 checks PASS |

Both production runs have actual GitHub Environment approval by vn-taphoanhatung;
hello-tako did not change or bypass protections. Both D1 ledgers moved 39 -> 40 from migration source 6bc1fe96,
only 0040 applied, FK/quick_check/schema/strict constraints PASS and no aggregate
drift. The production migration bookmark remains in the private receipt.

Production serves [Takosan](https://frigo.tungjpstore.net) on active 100% Worker
`820c79ef-2db1-4016-95e8-afad9d61958f`. Workflow receipt proves canonical D1 binding, d1 authority,
500 recipes/exact release fingerprint/no fallback, paired T20 server/UI true,
exact SHA assets and release-aware service worker. The new application release
retains complete D1 via protected previous-version/source/content continuity proof. Independent read-only browser
smoke passes Chromium, Firefox and direct WebKit at 320/1440; PWA removes the seeded
old cache and renders the offline public shell. No auth submission, real mail,
paid AI call or financial transaction was used.

Production health monitoring passes 11 observations over
301.163 seconds. Runtime readiness remains `degraded` for the explicit D1 authority warning.
The checks cover public readiness,
database, queue, configuration and catalog identity; they do not certify operational
SLOs, authenticated journeys, provider quality or delivery.

## Recovery and limits

Inactive recovery Worker `a300e28d-d304-4dcb-a256-b2495befe72c` was uploaded and metadata-certified
before production traffic changed. It uses the exact candidate, canonical D1,
STRICT_OTP_FAIL_CLOSED=true and matching catalog/T20 flags. It was never activated;
no live rollback rehearsal or live OTP503 proof is claimed. Follow
ADR-INTEGRATED-RELEASE-002.md and the strict OTP section in DEPLOYMENT.md; do not
restore the historical legacy OTP Worker after strict challenges have been admitted.

Retained staging failures include routed WebKit empty HTML (also with identity
encoding), a direct WebKit image-load timeout in continuity smoke1, and an undefined
callback variable in smoke2. Nine direct image diagnostics passed; corrected smoke3
passed 30 checks. The earlier harness API error and urllib monitoring attempt remain
recorded. No underlying intermittent transport cause is certified. Production smoke1 failed
on a direct WebKit Turnstile cross-origin iframe exception. A six-case direct
diagnostic reproduces the exception within the external Cloudflare script stack
at both widths; page images render correctly. Smoke4 records any matching external error separately and still fails application
errors. Its final 30 rendering checks passed with 0 observed external errors during
the bounded capture, while Turnstile requests were still pending at registration
render. The diagnostic reproductions remain valid; this is no challenge/auth certificate. Production smoke2 then failed with no h1 in direct WebKit. An 18-case default/identity
HTML diagnostic passed all page-content checks and retained six external errors;
this does not establish the original intermittent failure cause. Smoke4 records
response bytes/encoding/hash before DOM assertions; no empty content is accepted.
Production smoke3 failed on global networkidle timeout in Firefox. Smoke4 uses
explicit DOM/font/image/geometry assertions and records pending requests rather
than making network-wide quiescence a rendering requirement. Turnstile remains
an independent real-auth acceptance item.

Production monitor1 failed because the harness required status ok; the documented
D1 authority warning deliberately yields degraded. Monitor2 requires precisely that
warning and still rejects any other issue or DB/queue/config/catalog failure. Failed
attempts are excluded from successful product evidence.

Synthetic fixtures remain TEST_ONLY. Real inbox/provider/data/human/device/payment/
SLO acceptance stays open in OPEN_ACCEPTANCE.md. Production deployment completion
is distinct from full masterplan acceptance. Raw scanner findings, private fixtures,
provider content and credentials are not published. Sanitized deployment facts,
approval identities, immutable run links and source receipt hashes are in
release-receipt.json; earlier local commands retain their actual source SHAs in
validation.json.
