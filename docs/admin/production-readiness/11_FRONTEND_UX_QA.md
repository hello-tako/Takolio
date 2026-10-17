# Frontend and UX QA

Runtime source: `9395f0e31ea599f1eb7780a8eba36964fed7c483`. Main baseline: `526596a8cd857984ad2b69901a8c7b0e9d6bccc2`.
Prepared by implementation owner `/root` (Codex); independent reviewer is
`/root/independent_admin_review`. Evidence environment: local macOS arm64,
Node v24.16.0, pnpm 10.33.2, Python 3.9.6, `TMPDIR=/private/tmp`.
Evidence timestamps are UTC. Commands, exit codes, log digests and limitations
are in `evidence/verification.json` and `12_REGRESSION_RESULTS.md`.
No live Cloudflare operation or operator approval is implied.

Current route authority is `src/admin/App.tsx`: nine main destinations (overview,
users, households, billing, AI/OCR, recipes, system, audit, settings), two detail
routes (user/recipe), plus login and denied/not-found/session states. The earlier
"nine-screen" label counts primary navigation, not all route surfaces.

The Vietnamese UI and accepted Takolio identity are preserved. R2 corrects
three-operator governance text, independent Admin labels and typed failure states.
Sensitive mutations never auto-retry; query retries refuse permanent auth,
validation and rate-limit statuses. Billing remains read-only and no subscription
or PayOS authority is added.

Browser QA exercises actual built frontend served with Admin Worker/API in a
local SQLite preview. A separate real multi-Worker workerd scenario visits the
main surfaces against local D1. E2E covers auth/denial, data navigation, PII
permissions, governance, empty/error states, session expiry, keyboard navigation,
focus/axe and widths 390/820/1440. These are synthetic local fixtures, never
production metrics. Deep-link tests include accepted dot/colon IDs and deny
traversal/unknown routes. Table keyboard tests poll eventual scroll position;
no arbitrary wait replaces the assertion.

Generated screenshots and accessibility/overflow JSON are in
`evidence/frontend/`; current run identities and digests are in
`evidence/artifacts.json`. Tracked `docs/admin/screenshots` remain historical
references and are not overwritten. Visual review observations and exact test
counts are in 12. Automated axe/overflow checks do not prove complete accessibility
or complete visual acceptance on all devices. Staging browser QA is OPEN.

AI requests are not durably instrumented by the runtime writer. Summary data
reports `aiRequestsWriter=not_wired`, provenance and partial/unavailable status;
recorded local rows cannot be treated as complete production cost. Future
instrumentation needs an independently scoped durable event writer, provider
usage reconciliation, retry/deduplication policy, retention and cost validation.
It is not silently added to customer runtime by Admin remediation.

Current limited manual inspection is recorded in evidence/frontend/manual-9395f0e3.json, binding desktop overview (1440) and mobile settings (390) to their SHA256. The implementation owner observed coherent fixture labels and layout, with bounded horizontal tables on mobile. Retained visual-qa.json/contact-sheet files named 066c35ad belong to the prior candidate, preserved in evidence/historical-066c35ad; they are not fresh acceptance for this source.
