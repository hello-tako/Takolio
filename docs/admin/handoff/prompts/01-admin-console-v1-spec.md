# TAKOSAN ADMIN CONSOLE V1 — FULL-STACK LOCAL-FIRST DELIVERY

## ROLE & OBJECTIVE

You are the **PRINCIPAL FULL-STACK ENGINEER, SYSTEM ARCHITECT AND SECURITY IMPLEMENTATION AGENT** for Takosan.

Your mission is to implement a complete, locally executable, production-oriented administrative console for Takosan.

This assignment includes frontend, backend, database, authorization, analytics, observability, automated testing, and deployment readiness.

**Do not stop after creating a technical specification or a UI prototype. Deliver working code.**

Work through the entire implementation scope in one substantial engineering batch. Organize internal checkpoints yourself; do not request operator involvement for ordinary design decisions, local implementation, tests, or bug fixes.

---

## 0. SOURCE AUTHORITY & RESTRICTIONS

Project: Takosan

Repository ID: `1385308553`

Last inspected repository: `hello-tako/Tako-san`

Reference SHA: `186a9cf05de7c91ed3289e13130feb3b38a264ac`

The reference is contextual. Verify the actual local checkout and current code before changes.

Use only the local source checkout and locally available development tools.

### FORBIDDEN

- GitHub API operations.
- Git remote fetch, pull or push.
- Cloudflare API operations.
- Remote Wrangler commands.
- Staging or production deployments.
- Production database access.
- Reading or changing production secrets.
- Production feature flag modification.
- Modifying external infrastructure.
- Using live customer information as test fixtures.
- Creating authentication bypasses for convenient testing.
- Declaring production readiness from local testing alone.

A local commit is optional, but no remote publishing is permitted.

If a dependency or external integration cannot be verified offline, implement its interface, document the limitation, and continue completing independent work.

## 1. ARCHITECTURE AUDIT

Before implementation, inspect:

- Frontend app routing, stores, services, styling and build configuration.
- Existing Hono API and middleware.
- Session cookie, CSRF and authentication contracts.
- Household tenancy and user authorization.
- D1 schema and migration history.
- Billing, PayOS, subscriptions and entitlements.
- Recipe catalog and recipe authority.
- AI runtime, OCR jobs, usage logging and provider configuration.
- Health endpoints, request telemetry, queues and feature flags.
- Existing unit, integration and E2E testing patterns.

Create an architecture map, identify reusable components, and implement without unnecessarily duplicating existing systems.

Preserve existing application behavior and compatibility.

## 2. APPLICATION STRUCTURE

Build a separate administrative frontend application within the existing repository.

Suggested organization:

`src/admin/`

- Application entry point and routing
- Admin authentication/session handling
- UI components and design tokens
- Feature pages
- Typed API clients
- Error boundaries
- Loading/empty states
- Accessibility support

Backend organization:

`src/worker/routes/admin/`

- Admin route registration
- Administrative services
- Authorization middleware
- Audit service
- Analytics repositories
- Zod schemas
- Data transfer objects

Adapt paths to existing conventions when necessary.

The customer-facing app and Admin Console must not share unrestricted navigation or authorization assumptions.

Local entry point: `/admin` or a separate local development port.

Plan for a dedicated admin hostname during deployment, without requiring its configuration now.

## 3. ADMIN AUTHENTICATION AND RBAC

Implement real server-side administrative authorization.

Roles:

- `SUPER_ADMIN`
- `OPERATIONS_ADMIN`
- `CONTENT_EDITOR`
- `SUPPORT_AGENT`
- `READ_ONLY_AUDITOR`

Implement a permission matrix using explicit permission identifiers.

Never equate household ownership with platform administration.

Never trust localStorage, a client-supplied role, an unverified email header, or an unsigned JWT claim as administrative authority.

Existing cookie sessions may be reused after proper validation, but admin role grants must be verified against server-side authority.

Required functionality:

1. Administrative session verification.
2. Server-side permission evaluation.
3. Deny-by-default behavior.
4. Proper 401 and 403 responses.
5. Session revocation and expired-session handling.
6. Protection against privilege escalation.
7. CSRF and origin protection.
8. Audited administrative actions.
9. Rate limiting for sensitive endpoints.
10. Separate permission checks for every administrative operation.

Provide a local-only, one-time administrator provisioning command.

The provisioning procedure must not operate as a public endpoint and must fail closed outside local development.

Prepare an integration interface for Cloudflare Access. Do not fake successful Access verification in production mode.

## 4. DATABASE FOUNDATION

Use the current migration system.

Create additive migrations for:

- Admin role assignments
- Role permissions or their durable authorization representation
- Administrative audit events
- Administrative action approvals, where applicable
- AI usage aggregation when existing durable data is insufficient
- Administrative configuration metadata where appropriate

Do not edit historical migrations.

Do not replace or mutate established payment, entitlement, recipe, household or inventory authority.

Implement indexes, pagination, query bounds and database constraints.

Test migration replay against a fresh local D1 database and an appropriate local upgrade fixture.

## 5. FRONTEND — COMPLETE UI DELIVERY

Build a polished, responsive administrative dashboard consistent with Takosan brand identity.

Design direction:

- Professional, modern SaaS interface.
- Light neutral backgrounds with Takosan brand accents.
- Clear information hierarchy.
- Collapsible navigation sidebar.
- Responsive desktop/tablet/mobile behavior.
- Vietnamese as the default interface language.
- Reusable cards, tables, charts, forms and dialogs.
- Accessible color contrast, keyboard navigation and focus states.
- Loading, empty, error and permission-denied states.

### Screen 01: Authentication

Administrative entry and secure sign-in experience.

Display session errors and permission-denied states correctly.

### Screen 02: Overview

Show:

- Registered users
- Active users
- New registrations
- Active Plus subscriptions
- Confirmed revenue
- AI usage
- Scan jobs
- System health
- Recent operational incidents

Implement timeframe selection and charts.

Clearly define every KPI and its data source.

### Screen 03: Users & Households

Implement searchable and paginated user lists.

Support filters, account details, subscription status, household summaries and appropriately scoped activity information.

Mask sensitive information by default.

### Screen 04: Billing & Subscriptions

Show:

- Confirmed payment totals
- Pending payments
- Failed payments
- Active Plus subscriptions
- Checkout states
- Reconciliation exceptions

Use authoritative existing payment records.

Do not add direct entitlement mutation in V1.

### Screen 05: AI & OCR Operations

Show:

- Requests by task
- Model/provider usage
- Estimated token costs
- Latency
- Error rates
- Retry statistics
- OCR activity
- Available queue status

If a metric has no durable data source, return an explicit unavailable state instead of fabricated statistics.

### Screen 06: Recipe Management

Implement catalog browsing, filtering, detailed inspection and provenance/status displays.

Prepare draft/review/publish workflow architecture.

Where safe local editorial operations can be implemented without violating current recipe authority, implement them with validation and audit.

Do not silently modify canonical production recipe authority.

### Screen 07: System & Infrastructure

Show service health, database status, feature configuration, release identity and operational warnings.

Provide provider adapter interfaces for future Cloudflare/GitHub integration.

Clearly distinguish locally observed status from information requiring remote access.

### Screen 08: Audit & Security

Display administrative audit history, action types, timestamps, outcomes and actor identities.

Support filtering and pagination.

### Screen 09: Admin Settings

Display role assignments, permission descriptions and administrative preferences.

Protect sensitive actions with explicit permissions.

## 6. ADMIN API

Implement typed and validated endpoints under:

`/api/v1/admin/*`

Minimum API contract:

- `GET /me`
- `GET /overview`
- `GET /users`
- `GET /users/:id`
- `GET /households`
- `GET /billing/summary`
- `GET /billing/transactions`
- `GET /ai/summary`
- `GET /ai/usage`
- `GET /recipes`
- `GET /recipes/:id`
- `GET /recipes/summary`
- `GET /system/status`
- `GET /audit`

Add authorized local editorial endpoints only when necessary and when existing authority constraints permit them.

Requirements:

- Explicit RBAC enforcement
- Input validation
- Strict query bounds
- Deterministic pagination
- Sanitized errors
- Structured responses
- No-store caching for sensitive responses
- No cross-tenant data exposure through ordinary user routes
- No unintended secrets, OTPs, payment credentials or raw scan images in API responses

## 7. LOCAL DATA & ADAPTERS

Use locally emulated Cloudflare bindings wherever practical.

Separate:

**Real local implementation:** API, RBAC, SQL queries, validation, authorization, business rules and UI rendering.

**Local test fixtures:** Clearly labeled synthetic users, subscriptions, transactions, recipes, AI events and operational statuses.

**Future production adapters:** Real Cloudflare telemetry, deployment information, remote infrastructure health and external financial reconciliation sources.

Provide deterministic fixture seeds and reset commands.

Never ship a fallback that displays synthetic metrics as if they were live production statistics.

In production mode, missing integrations must return explicit unavailable/configuration-required states.

## 8. SECURITY TESTING

Test at least:

- Anonymous admin access denied
- Regular user access denied
- Household owner cannot become platform admin
- Revoked admin cannot continue accessing endpoints
- Expired admin sessions denied
- Forged privilege headers ignored
- Frontend route hiding cannot bypass backend permissions
- CSRF failures rejected
- Unauthorized mutations rejected
- Restricted roles cannot access higher privileges
- Sensitive data redaction
- Pagination abuse and invalid inputs
- Administrative audit correctness
- Production mode cannot use local development bootstrap
- Production mode fails closed when required security integration is absent

Never weaken existing customer authentication to make administrative tests pass.

## 9. FUNCTIONAL AND E2E TESTING

Implement frontend unit tests, backend integration tests and browser E2E tests.

Use existing project testing conventions.

Required E2E flows:

1. Open local Admin Console.
2. Authenticate as provisioned test Super Admin.
3. Load Overview from the local backend.
4. Navigate all primary screens.
5. Search and inspect a user.
6. Inspect billing summaries.
7. Inspect AI usage.
8. Browse recipes.
9. View system health.
10. View administrative audit history.
11. Verify role-based restrictions.
12. Log out and verify session termination.

Run existing regression tests where available.

Verify typecheck, lint, build, migration integrity and tests.

Fix implementation failures before reporting completion.

## 10. PRODUCTION INTEGRATION READINESS

Prepare, but do not execute, the deployment integration.

Document:

- Cloudflare Access integration contract
- Admin hostname requirements
- Worker routing requirements
- D1 migration sequence
- Required environment variables
- Cloudflare bindings
- GitHub release workflow integration
- Staging verification procedures
- Health checks
- Rollback procedure
- Independent security review gates

Preserve existing production approval mechanisms.

No direct production deployment buttons should bypass GitHub Environment approvals or established release gates.

## 11. ACCEPTANCE CRITERIA

Delivery is accepted locally only when:

- Admin frontend is fully navigable.
- Admin backend actually serves the frontend.
- Administrative authentication works.
- RBAC enforcement works on the server.
- Local D1 migrations succeed.
- Dashboard metrics are backed by real local SQL queries or explicitly labeled unavailable integrations.
- All primary screens function without dead navigation.
- Required security tests pass.
- Browser E2E tests pass.
- Existing customer app regression tests pass, or any failures are explicitly identified with evidence.
- A clean local setup can reproduce the result.
- No GitHub or Cloudflare production resources were touched.

Do not claim production certification.

## 12. FINAL DELIVERABLES

Provide:

1. Complete frontend source code.
2. Complete backend source code.
3. Additive database migrations.
4. Local fixture and administrator bootstrap utilities.
5. Automated tests.
6. Local startup instructions.
7. Screenshots of every implemented administrative screen.
8. API reference.
9. RBAC permission matrix.
10. Security assessment.
11. Migration and compatibility report.
12. Staging/production integration plan.
13. Exact test execution results.
14. List of remaining external integration blockers.

Final status must use one of:

- `ADMIN_V1_LOCAL_COMPLETE`
- `ADMIN_V1_LOCAL_PARTIAL`
- `ADMIN_V1_LOCAL_BLOCKED`

Only use `ADMIN_V1_LOCAL_COMPLETE` if all mandatory local acceptance criteria pass.

## 13. EXECUTION INSTRUCTION

**Implement the full scope now.**

Do not stop after architecture analysis.

Do not deliver placeholder-only React pages or mocked production API implementations.

Proceed through implementation, local execution, automated testing and remediation as one coordinated delivery.

If an external dependency is blocked, isolate it behind a documented adapter and continue with all independently executable work.

Do not connect to GitHub or Cloudflare remote resources.

Stop at the **LOCAL IMPLEMENTATION COMPLETE / READY FOR INDEPENDENT REVIEW** boundary.

Production integration is a later, separately authorized operation.