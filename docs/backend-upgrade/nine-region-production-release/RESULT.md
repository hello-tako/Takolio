# Nine-region production release

Status: LOCAL_VERIFIED_HOSTED_AND_PRODUCTION_PENDING.

**Local verification:** pnpm check PASS: 330 files / 7705 tests,166.03s;
lint/both TypeScript projects/41-migration replay/build PASS. Remote gates
explicitly skipped. Focused migration checks18/18 PASS. Full/prod dependency
audits0. Source scan4865 files: Semgrep/zizmor0; Syft504 declaredcomponents;
Gitleaks raw17/exit1 retained, exact-context17matched/0unresolved. Eleven
protected appliedmigration/provider/grant/price/config/lock/deploy paths exact.
All four baseline failure logs retained: plan-capability expectation, quote
syntax, Zod inference and exact workflow migration-list expectation. Browser
attempts preserve port collision, dev-preview empty document and service-worker
interception bypass/401; final mock tests explicitly block service workers.
Public PWA remains a separate deployed check; no actual OTP/provider/payment call.

**Release scope/next:** checkout admission default OFF and scanner workflow
non-executable candidate; real acceptance remains PENDING_EXTERNAL_EVIDENCE.
Push normal PR and wait exact-head then exact-main CI; staging0041/deploy/smoke
before protected production0041/deploy/monitor. No production mutation yet.

Browser boundary: service worker bypassed Playwright request interception in the
first WebKit mock runs and produced unauthenticated401; mock service workers are
now blocked explicitly. Opt-in 6 engine/width cases PASS with12 screenshots.
The default-off WebKit check additionally caught opacity transition during button
enabling (2.21 contrast); stable enabled-button opacity is awaited without hiding
axe findings. Failed artifacts remain retained. This certifies stable appearance,
not zero transient contrast or a real provider/authentication journey. Final
browser receipt follows; no paid/OTP call occurred.

Final local browser acceptance PASS in both modes: Chromium/Firefox/WebKit at
320/1440,12 cases/24screenshots, zero stable axe/overflow/broken/page-errors or
external requests. Default-off calls no recovery API or idempotency header;
opt-in keeps key/reload replacement fence/GET resume. Actual new checkout remains
OFF in staging/production configs. Stable enabled-button opacity resolved the
transient WebKit contrast capture; failed evidence remains retained.
