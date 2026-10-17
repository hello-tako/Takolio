TAKOSAN ADMIN V1 — SECURITY REMEDIATION R1

ROLE: PRINCIPAL SECURITY REMEDIATION ENGINEER

Mission: Resolve all release-blocking security, routing, migration and operational defects identified during the Admin V1 review.

0. Authority

Repository ID: 1385308553

Local baseline commit: 3e865d0

Reported review status: ADMIN_V1_REVIEW_CHANGES_REQUIRED

Target status: ADMIN_V1_REMEDIATION_READY_FOR_INDEPENDENT_REVIEW

Use the existing local checkout.

Read the complete 2026-10-12-independent-review.md, all evidence files, affected source files, test cases and deployment documentation before making changes.

If the report is not locally available, reconstruct the findings from the supplied handoff; identify missing evidence explicitly.

The original implementation commit must remain recoverable.

1. Hard execution restrictions

AUTHORIZED:

* Read and modify local source code.
* Add migrations and tests.
* Run local Workers/workerd.
* Run local D1 and SQLite.
* Run local browser E2E.
* Run lint, typecheck, build and regression tests.
* Produce local reports.
* Create a local remediation commit if appropriate.

FORBIDDEN:

* GitHub API calls.
* Git push, fetch or pull.
* Cloudflare remote API calls.
* Wrangler remote operations.
* Production or staging deployment.
* Reading or changing production secrets.
* Mutating production databases.
* Activating Admin Console in production.
* Weakening existing authentication, authorization or deployment gates to make tests pass.

Set WRANGLER_SEND_METRICS=false for local Wrangler execution and verify the offline execution boundary.

Do not claim an independent review PASS for work you implement yourself.

2. P0 — S1: Strict environment fail-closed

Correct all unsafe environment defaults.

Requirements:

* Missing ENVIRONMENT must never imply development.
* Empty, unknown or malformed values must fail closed.
* Production Admin must remain disabled unless explicitly enabled with all required security controls.
* Development authentication must not become available on a public deployment merely because ENVIRONMENT=development.
* Local bootstrap and test login must be restricted to a verifiably local execution context.
* No development bypass may exist in production artifacts.
* No header, query parameter or frontend variable may override the server-side environment decision.
* Never make authorization depend solely on a user-controlled Host header.

Build a configuration decision matrix covering development, test, staging, production, unknown and missing values.

Write adversarial tests for every decision.

3. P0 — S2: Cloudflare static assets bypass

Reproduce the existing /admin/ bypass using workerd before implementing the fix.

Inspect Wrangler static asset routing, SPA fallback, route normalization, worker entry points and deployment configuration.

Choose a secure architectural solution:

* Worker-first asset routing with effective authorization checks; or
* A separately built and independently protected Admin application.

Prefer a separate Admin deployment boundary for future production use if it can be implemented cleanly without breaking the customer application.

If retaining the existing Worker:

* Configure assets.run_worker_first correctly.
* Enforce Admin availability and authorization before returning protected Admin HTML or assets.
* Cover /admin, /admin/, nested routes, redirects and asset URLs.
* Verify path normalization and encoded-path edge cases.
* Prevent SPA fallback from bypassing security.
* Prevent cache or service-worker behavior from serving protected Admin content after disabling the console.
* Ensure Admin CSP is applied on the actual Admin response.
* Ensure public app behavior and assets are not broken.

Consider the risk of shared public JS chunks. Sensitive Admin configuration must never be bundled into publicly retrievable assets.

Acceptance:

ADMIN_CONSOLE_ENABLED=false must make the entire protected Admin surface inaccessible, including direct navigation and refresh.

Test with real local workerd asset routing, not Node preview alone.

4. P0 — S3: Origin, CSRF and cookie isolation

Remove inappropriate trust in the customer application’s APP_URL for Admin authorization.

Introduce explicit Admin origin configuration and strict validation.

Requirements:

* Dedicated Admin origin/hostname policy.
* Exact trusted origin matching.
* No wildcard origin allowances.
* No automatic trust of the customer application origin.
* Correct Origin/Referer and CSRF verification.
* Secure, host-only Admin cookies.
* No unnecessary cross-origin credential sharing.
* Administrative session isolation.
* Separate Admin CSP.
* Correct behavior for browser redirects and authentication callbacks.
* Fail closed on missing or invalid security configuration.

Prefer same-origin Admin UI and Admin API routing on the future dedicated hostname to minimize unnecessary CORS complexity.

Test:

* Legitimate Admin origin.
* Customer app origin.
* Malicious third-party origin.
* Missing Origin where applicable.
* Forged Host and forwarding headers.
* Malformed CSRF tokens.
* Expired sessions.
* Cross-origin requests with cookies.
* Attempted reuse of customer authentication.

Production Cloudflare Access verification must validate JWT signature, issuer, audience and token lifetime.

Use deterministic local test keys for offline verification only. Do not claim real Cloudflare Access certification.

5. P0 — Migration 0042 deployment and rollback

Inspect the exact current deploy.yml, migration workflows, schema gates, migration ledger implementation and Admin migration 0042.

The identified defect is:

* Remote schema validation may block deployments before 0042 is applied.
* Old deployment workflows may also reject the new ledger after application rollback.

Create a safe, evidence-backed deployment sequence.

Requirements:

1. Preserve the complete existing migration history.
2. Keep 0042 additive and backward compatible.
3. Never modify old migration files.
4. Never rewrite production migration history.
5. Preserve strict D1 identity checks.
6. Preserve exact-SHA release authorization.
7. Prevent arbitrary forward schema drift from being accepted.
8. Define a reviewed mechanism for applying 0042 before the application requires it.
9. Document rollback of application code while retaining the additive 0042 schema.
10. Provide a tested recovery path for legacy release workflows where the ledger no longer matches.

Do not introduce a general-purpose schema-gate bypass.

A temporary or specialized migration compatibility mechanism must be narrowly scoped to the reviewed 0042 migration and exact approved artifact.

Simulate the following offline:

* Database at 0041 + old application.
* Database at 0042 + old application.
* Database at 0042 + new application.
* Failed migration.
* Failed application deployment.
* Application rollback with schema remaining at 0042.
* Unexpected extra migration or schema drift.

Document exact ordering and rollback behavior.

6. P1 — Super Admin governance

Resolve the single-Super-Admin deadlock.

Implement a secure first-administrator bootstrap and controlled transition to the normal two-person authorization policy.

Requirements:

* Initial provisioning through a trusted, auditable operator procedure.
* No public bootstrap endpoint.
* Explicit one-time bootstrap conditions.
* Fail closed against repeated or unauthorized bootstrap.
* Two-person approval for subsequent Super Admin grants.
* Symmetric protection against unauthorized Super Admin revocation.
* Protection against removing the last authorized Super Admin.
* Invalidation of affected sessions after privilege changes.
* Concurrency and replay protection.
* Full audit evidence.

Do not solve this by allowing an existing Super Admin to approve their own sensitive privilege changes.

7. P1 — Session and audit hardening

Address all reported medium-severity findings.

* Revoke appropriate Admin sessions on password change and account security events.
* Ensure administrative security decisions cannot silently proceed without required durable audit records.
* Use transactionally consistent audit behavior where possible.
* When an operation spans database and external side effects, implement explicit durable state transitions and failure handling.
* Apply independent rate limits across account, IP and relevant authenticated identities.
* Prevent multi-IP credential-stuffing bypass.
* Keep error responses sanitized.
* Ensure retry behavior cannot duplicate sensitive operations.

Audit logs must remain append-only through Admin APIs and protected by database constraints or equivalent enforceable controls.

Do not claim database-level tamper-proofing without evidence.

8. P1 — Frontend and API behavior

Resolve:

* Tablet/mobile horizontal overflow in Admin Settings.
* Serious accessibility finding.
* Unnecessary retries of HTTP 4xx and 429.
* Invalid session UX.
* Permission-denied UX.
* Error boundaries and loading states.

Retry policy:

* Do not retry terminal authorization, validation or permission errors.
* Respect explicit server retry guidance and bounded backoff for retryable cases.
* Do not automatically retry sensitive mutations without an appropriate idempotency contract.

Verify on mobile, tablet and desktop viewports.

Do not introduce a new design system unnecessarily.

9. Regression and evidence

Run the previous 51 review PoCs against the original implementation and record expected failures where reproducible.

After remediation, rerun them to verify the defects are resolved.

Extend coverage for newly identified edge cases.

Mandatory commands/checks:

* Full unit test suite.
* Full integration test suite.
* Admin security tests.
* Local workerd execution.
* Local D1 migration from scratch.
* Local D1 upgrade 0041→0042.
* Migration integrity checks.
* Browser E2E.
* Accessibility regression.
* Responsive UI regression.
* Lint.
* Typecheck.
* Production build.

Previous full regression baseline:

339 files / 7799 tests PASS

Do not assume this count remains constant after adding tests. Report actual counts, failures and process exit codes.

Run the full suite after the final source change.

10. Mandatory negative security tests

Ensure tests demonstrate:

* Missing environment cannot enable Admin.
* Production flag OFF blocks Admin.
* Direct static asset access cannot bypass Admin routing.
* Deep-link SPA navigation cannot bypass authorization.
* Customer origin cannot execute Admin requests.
* Hostname spoofing cannot grant Admin authority.
* Unauthorized role escalation fails.
* Single-Super-Admin bootstrap cannot be abused.
* Unauthorized Super Admin revocation fails.
* Password/security changes invalidate appropriate sessions.
* Required audit failures cannot silently authorize actions.
* Failed requests do not create unintended side effects.
* Old customer application behavior remains intact.
* Old application remains compatible with reviewed additive migration 0042.

11. Documentation

Update:

docs/admin/PRODUCTION_INTEGRATION_PLAN.md

Also provide:

* Security remediation report.
* Root-cause analysis for each finding.
* Reviewed diff/file manifest.
* Authorization matrix.
* Cloudflare static asset routing evidence.
* Admin origin/CSP/cookie contract.
* Migration and rollback matrix.
* Full regression summary.
* Remaining limitations.
* Exact local commit SHA.

Clearly distinguish:

LOCAL_VERIFIED

from:

STAGING_NOT_VERIFIED

and:

PRODUCTION_NOT_VERIFIED

12. Stop conditions

Stop and report a blocker if:

* A required security property cannot be implemented safely offline.
* A fix requires weakening existing production authorization.
* A migration change cannot preserve compatibility.
* The implementation requires touching remote infrastructure.
* Full regression reveals a new unexplained security failure.

Do not mask a blocker by using test-specific production bypasses.

13. Final status

Return one of:

* ADMIN_V1_REMEDIATION_READY_FOR_INDEPENDENT_REVIEW
* ADMIN_V1_REMEDIATION_CHANGES_REQUIRED
* ADMIN_V1_REMEDIATION_BLOCKED

The first status means implementation and local verification are complete.

It does not mean independent review PASS or production approval.

14. Execution instruction

Implement all P0 findings first.

Then resolve the identified P1 security and usability defects.

Repeat the adversarial tests and full regression.

Produce the final evidence package.

Do not push, merge, deploy, or connect to GitHub/Cloudflare remote resources.

Stop at the independent-review handoff boundary.